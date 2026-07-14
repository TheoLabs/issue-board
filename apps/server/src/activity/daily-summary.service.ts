import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type {
  Activity,
  ActivityEntity,
  DailyReport,
  DailySummary,
} from '@issue-board/shared';
import type { DailySummary as PrismaDailySummary } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from './activity.service';

const DEFAULT_TZ = 'Asia/Seoul';
/** claude CLI 호출 타임아웃 (기본 2분) */
const CLI_TIMEOUT_MS = Number(process.env.CLAUDE_CLI_TIMEOUT_MS ?? 120_000);
/** claude 실행 경로 (PATH에 없을 수 있어 override 허용) */
const CLI_BIN = process.env.CLAUDE_CLI_PATH ?? 'claude';
/** 지정 시 --model 로 전달 (미지정이면 CLI 기본 모델) */
const CLI_MODEL = process.env.CLAUDE_MODEL ?? '';

const ENTITY_LABEL: Record<ActivityEntity, string> = {
  plan: '기획',
  domain: '도메인',
  issue: '이슈',
  wireframe: '와이어프레임',
  design: '디자인',
  project: '프로젝트',
};

const ACTION_LABEL: Record<string, string> = {
  created: '신규',
  updated: '수정',
  status_changed: '상태변경',
  snapshot: '스냅샷',
  linked: '연동',
  deleted: '삭제',
};

/**
 * Claude(CLI)가 그날의 활동 스냅샷을 읽어 서술형 일일 업무 요약을 생성/저장한다.
 * - 수동: POST .../activity/daily/report ('AI 요약하기' 버튼)
 * - 자동: 매일 cron 으로 전 프로젝트 순회 (env DAILY_SUMMARY_ENABLED=1)
 * 프론트 규칙 기반 렌더(dailyReport.ts)와 달리 LLM이 "무슨 작업이 이뤄졌는지" 서술한다.
 */
@Injectable()
export class DailySummaryService {
  private readonly logger = new Logger(DailySummaryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  /** 저장된 요약 조회. 없으면 null. date 미지정 시 tz 기준 오늘. */
  async get(
    projectId: string,
    date?: string,
    timezone: string = DEFAULT_TZ,
  ): Promise<DailyReport | null> {
    const day = date ?? todayInTz(timezone);
    const row = await this.prisma.dailySummary.findUnique({
      where: { projectId_date: { projectId, date: day } },
    });
    return row ? toReport(row) : null;
  }

  /**
   * 그날의 활동 스냅샷으로 Claude를 호출해 요약을 생성하고 upsert(재생성=갱신)한다.
   * 활동이 0건이면 CLI를 호출하지 않고 안내 문구만 저장한다.
   */
  async generate(
    projectId: string,
    date?: string,
    timezone: string = DEFAULT_TZ,
    createdBy: 'manual' | 'schedule' = 'manual',
  ): Promise<DailyReport> {
    const summary = await this.activity.daily(projectId, date, timezone);
    const day = summary.date;
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true, repoPath: true },
    });
    const projectName = project?.name ?? '프로젝트';

    if (summary.total === 0) {
      return this.save(projectId, day, timezone, {
        content: `${day} — 기록된 변경이 없습니다.`,
        model: null,
        status: 'ready',
        error: null,
        activityCount: 0,
        createdBy,
      });
    }

    // 활동 로그(무엇이 바뀌었나)에 더해, 오늘 건드린 실제 작업 항목의 "현재 내용"을 읽는다.
    // 이슈 본문의 완료조건 체크박스 등 실제 근거로 진척도·요약을 평가하게 하기 위함.
    const workContext = await this.gatherWorkContext(summary);

    const prompt = buildPrompt(summary, projectName, workContext);
    try {
      const { text, model } = await this.runClaude(prompt, project?.repoPath);
      const content = text.trim();
      if (!content) throw new Error('claude 응답이 비어 있습니다.');
      return this.save(projectId, day, timezone, {
        content,
        model,
        status: 'ready',
        error: null,
        activityCount: summary.total,
        createdBy,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`일일 요약 생성 실패 (${projectId}/${day}): ${message}`);
      return this.save(projectId, day, timezone, {
        content: '',
        model: null,
        status: 'error',
        error: message,
        activityCount: summary.total,
        createdBy,
      });
    }
  }

  private async save(
    projectId: string,
    date: string,
    timezone: string,
    data: {
      content: string;
      model: string | null;
      status: string;
      error: string | null;
      activityCount: number;
      createdBy: string;
    },
  ): Promise<DailyReport> {
    const row = await this.prisma.dailySummary.upsert({
      where: { projectId_date: { projectId, date } },
      create: { projectId, date, timezone, ...data },
      update: { timezone, ...data },
    });
    return toReport(row);
  }

  /**
   * 오늘 건드린 실제 작업 항목의 현재 내용을 DB에서 읽어 프롬프트용 컨텍스트로 만든다.
   * 활동 로그가 "무엇이 바뀌었나"라면, 이건 "그 대상이 지금 실제로 어떤 상태·내용인가"다.
   * 이슈 본문(완료조건 체크박스), 기획 본문, 도메인 컬럼 등을 근거로 진척도를 평가하게 한다.
   */
  private async gatherWorkContext(summary: DailySummary): Promise<string[]> {
    const idsOf = (type: ActivityEntity): string[] => [
      ...new Set(
        summary.activities
          .filter((a) => a.entityType === type)
          .map((a) => a.entityId),
      ),
    ];
    const issueIds = idsOf('issue');
    const planIds = idsOf('plan');
    const domainIds = idsOf('domain');
    const wireframeIds = idsOf('wireframe');
    const designTouched = summary.activities.some(
      (a) => a.entityType === 'design',
    );

    // 정체 판단 기준: 리포트 날짜로부터 STALE_DAYS일 이전에 마지막으로 바뀐 in_progress 이슈.
    const staleCutoff = new Date(
      dayStartMs(summary.date) - STALE_DAYS * 86_400_000,
    );

    const [issues, plans, domains, wireframes, design, issueStats, stale] =
      await Promise.all([
        issueIds.length
          ? this.prisma.issue.findMany({
              where: { id: { in: issueIds } },
              select: {
                id: true,
                title: true,
                status: true,
                priority: true,
                labels: true,
                body: true,
              },
            })
          : Promise.resolve([]),
      planIds.length
        ? this.prisma.plan.findMany({
            where: { id: { in: planIds } },
            select: { title: true, status: true, content: true },
          })
        : Promise.resolve([]),
      domainIds.length
        ? this.prisma.domain.findMany({
            where: { id: { in: domainIds } },
            select: {
              name: true,
              description: true,
              columns: true,
              status: true,
            },
          })
        : Promise.resolve([]),
      wireframeIds.length
        ? this.prisma.wireframe.findMany({
            where: { id: { in: wireframeIds } },
            select: { name: true, format: true },
          })
        : Promise.resolve([]),
      designTouched
        ? this.prisma.design.findUnique({
            where: { projectId: summary.projectId },
            select: { status: true, tokens: true },
          })
        : Promise.resolve(null),
      // 전체 이슈 진척률(A) 계산용 — 상태별 개수
      this.prisma.issue.groupBy({
        by: ['status'],
        where: { projectId: summary.projectId },
        _count: { _all: true },
      }),
      // 점검 필요(B) — blocked 이거나 오래 정체된 in_progress 이슈(딥링크 포함)
      this.prisma.issue.findMany({
        where: {
          projectId: summary.projectId,
          OR: [
            { status: 'blocked' },
            { status: 'in_progress', updatedAt: { lt: staleCutoff } },
          ],
        },
        select: { id: true, title: true, status: true, updatedAt: true },
        orderBy: { updatedAt: 'asc' },
        take: 12,
      }),
    ]);

    const lines: string[] = [];

    // 전체 이슈 진척률(A용)
    const statMap = new Map(issueStats.map((s) => [s.status, s._count._all]));
    const totalIssues = [...statMap.values()].reduce((a, b) => a + b, 0);
    const doneIssues = statMap.get('done') ?? 0;
    lines.push('## 프로젝트 전체 이슈 현황 (진척률·지표 계산용)');
    lines.push(
      `- 총 ${totalIssues} · done ${doneIssues} · in_progress ${statMap.get('in_progress') ?? 0} · todo ${statMap.get('todo') ?? 0} · blocked ${statMap.get('blocked') ?? 0}` +
        (totalIssues > 0
          ? ` → 전체 진척률 ${doneIssues}/${totalIssues} (${Math.round((doneIssues / totalIssues) * 100)}%)`
          : ''),
    );

    // 점검 대상 이슈(B용) — blocked / 오래 정체된 in_progress. 딥링크 포함.
    if (stale.length) {
      lines.push('## 점검 대상 이슈 (blocked / 오래 정체된 in_progress)');
      for (const s of stale) {
        const note =
          s.status === 'blocked'
            ? 'blocked'
            : `약 ${Math.floor((dayStartMs(summary.date) - s.updatedAt.getTime()) / 86_400_000)}일째 in_progress`;
        lines.push(
          `- "${s.title}" — ${note} · 링크: ${issueUrl(summary.projectId, s.id)}`,
        );
      }
    }

    if (issues.length) {
      lines.push(
        '## 오늘 건드린 이슈 (완료조건 체크리스트로 진척도·잔여 항목을 평가한다)',
      );
      for (const i of issues)
        lines.push(formatIssueDetail(i, issueUrl(summary.projectId, i.id)));
    }
    if (plans.length) {
      lines.push('## 기획');
      for (const p of plans) lines.push(formatPlanDetail(p));
    }
    if (domains.length) {
      lines.push('## 도메인');
      for (const d of domains) lines.push(formatDomainDetail(d));
    }
    if (wireframes.length) {
      lines.push('## 와이어프레임');
      for (const w of wireframes) lines.push(`- "${w.name}" (${w.format})`);
    }
    if (design) {
      lines.push('## 디자인');
      lines.push(
        `- 상태 ${design.status} · 토큰 ${truncate(design.tokens, 300)}`,
      );
    }
    return lines;
  }

  /**
   * claude CLI를 headless(print) 모드로 호출해 순수 텍스트 응답을 받는다.
   * 프롬프트는 stdin으로 주입(인자 길이 제한 회피). MCP/도구는 쓰지 않는다.
   */
  private runClaude(
    prompt: string,
    cwd?: string | null,
  ): Promise<{ text: string; model: string | null }> {
    const args = ['-p', '--output-format', 'text'];
    if (CLI_MODEL) args.push('--model', CLI_MODEL);

    // cwd는 실존 디렉토리일 때만(없는 repoPath면 spawn이 ENOENT). PATH는 GUI/최소 환경에서
    // ~/.local/bin 등이 빠져 `spawn claude ENOENT`가 나므로 흔한 사용자 bin 경로를 보강한다.
    const runCwd = cwd && existsSync(cwd) ? cwd : process.cwd();
    const env = { ...process.env, PATH: augmentedPath() };

    return new Promise((resolve, reject) => {
      const child = spawn(CLI_BIN, args, {
        cwd: runCwd,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill('SIGKILL');
        reject(new Error(`claude CLI 응답 시간 초과 (${CLI_TIMEOUT_MS}ms)`));
      }, CLI_TIMEOUT_MS);

      child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
      child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));

      child.on('error', (e) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(
          new Error(
            `claude CLI 실행 실패: ${e.message}. CLAUDE_CLI_PATH로 실행 경로를 지정하세요.`,
          ),
        );
      });

      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (code === 0) {
          resolve({ text: stdout, model: CLI_MODEL || null });
        } else {
          reject(
            new Error(
              `claude CLI 비정상 종료 (code ${code}): ${stderr.trim() || '출력 없음'}`,
            ),
          );
        }
      });

      child.stdin.write(prompt);
      child.stdin.end();
    });
  }

  /**
   * 매일 정해진 시각에 전 프로젝트의 오늘 요약을 자동 생성한다.
   * DAILY_SUMMARY_ENABLED=1 일 때만 동작. 활동 0건 프로젝트는 건너뛴다.
   */
  @Cron(process.env.DAILY_SUMMARY_CRON ?? '0 19 * * *', {
    timeZone: DEFAULT_TZ,
  })
  async scheduledDaily(): Promise<void> {
    if (process.env.DAILY_SUMMARY_ENABLED !== '1') return;
    const today = todayInTz(DEFAULT_TZ);
    const projects = await this.prisma.project.findMany({
      select: { id: true, name: true },
    });
    this.logger.log(
      `일일 요약 스케줄 실행 (${today}) — 프로젝트 ${projects.length}개`,
    );
    for (const p of projects) {
      try {
        const summary = await this.activity.daily(p.id, today, DEFAULT_TZ);
        if (summary.total === 0) continue; // 변경 없는 프로젝트는 건너뜀
        await this.generate(p.id, today, DEFAULT_TZ, 'schedule');
        this.logger.log(`  ✓ ${p.name} (${summary.total}건)`);
      } catch (err) {
        this.logger.warn(`  ✗ ${p.name}: ${String(err)}`);
      }
    }
  }
}

function toReport(row: PrismaDailySummary): DailyReport {
  return {
    projectId: row.projectId,
    date: row.date,
    timezone: row.timezone,
    content: row.content,
    model: row.model,
    status: row.status as DailyReport['status'],
    error: row.error,
    activityCount: row.activityCount,
    createdBy: row.createdBy,
    updatedAt: row.updatedAt.toISOString(),
  };
}

const PRIORITY_LABEL: Record<string, string> = {
  high: '높음',
  medium: '보통',
  low: '낮음',
};

/** in_progress가 이 일수 이상 안 바뀌면 "정체 가능"으로 표면화한다. */
const STALE_DAYS = 7;

/** 딥링크 기준 웹앱 URL (보고서의 '점검 필요' 링크용). 배포 시 WEB_BASE_URL로 지정. */
const WEB_BASE_URL = (process.env.WEB_BASE_URL ?? 'http://localhost:5173').replace(
  /\/$/,
  '',
);

/** 이슈 딥링크: 프로젝트 선택 + 이슈 드로어를 여는 웹앱 URL. */
function issueUrl(projectId: string, issueId: string): string {
  return `${WEB_BASE_URL}/issues?project=${projectId}&issue=${issueId}`;
}

/** YYYY-MM-DD → 그 날 00:00(UTC 기준) ms. 정체 일수 계산의 기준점. */
function dayStartMs(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * 보고서 포맷 명세(단일 원본) + 오늘의 근거 데이터를 합쳐 claude용 프롬프트를 만든다.
 * 페르소나·규칙·템플릿은 agent/prompts/daily-report.md 하나에서만 관리한다(드리프트 방지).
 * 여기서는 그 명세 뒤에 (1)활동 로그 (2)작업 항목 실제 내용을 붙인다.
 */
function buildPrompt(
  summary: DailySummary,
  projectName: string,
  workLines: string[],
): string {
  const { date, byEntity, total } = summary;
  const dotDate = date.replace(/-/g, '.'); // 2026.07.14
  // 최신순으로 오므로 시간 순서(오래→최근)로 뒤집어 서술 흐름을 자연스럽게 한다.
  const logLines = [...summary.activities].reverse().map(formatActivity);

  return [
    loadTemplate(),
    '',
    '========================================',
    '위 [보고서 템플릿]과 규칙에 따라 아래 근거 데이터만으로 보고서를 작성하라.',
    '[활동 로그]는 오늘 무엇이 바뀌었는지, [작업 항목 실제 내용]은 그 대상이 지금 실제로',
    '어떤 상태·내용인지다. 진척도와 총평은 활동 로그만이 아니라 실제 내용을 확인해 평가하라.',
    `프로젝트명: ${projectName}`,
    `날짜: ${dotDate}`,
    '',
    `--- [활동 로그] (${date}, 총 ${total}건) ---`,
    `집계: 기획 ${byEntity.plan} · 도메인 ${byEntity.domain} · 이슈 ${byEntity.issue} · 와이어프레임 ${byEntity.wireframe} · 디자인 ${byEntity.design}`,
    ...logLines,
    '',
    '--- [작업 항목 실제 내용] (오늘 건드린 대상의 현재 상태·본문) ---',
    ...(workLines.length ? workLines : ['(해당 없음)']),
  ].join('\n');
}

/** 활동 1건을 프롬프트 한 줄로. `- [기획/수정] "제목" (status: todo→done)` */
function formatActivity(a: Activity): string {
  const label = `${ENTITY_LABEL[a.entityType]}/${ACTION_LABEL[a.action] ?? a.action}`;
  const changes = a.changes
    ? Object.entries(a.changes)
        .map(([k, v]) => `${k}: ${v.from ?? '∅'}→${v.to ?? '∅'}`)
        .join(', ')
    : '';
  return `- [${label}] "${a.title}"${changes ? ` (${changes})` : ''}`;
}

/**
 * 이슈 현재 내용 한 항목. 진척도 판단 근거로 상태와 완료조건 체크박스(`- [x]`/`- [ ]`)
 * 개수를 함께 제공한다(진척도 산정 규칙은 명세가 정한다). 본문도 잘라서 근거로 넣는다.
 */
function formatIssueDetail(
  i: {
    title: string;
    status: string;
    priority: string;
    labels: string;
    body: string;
  },
  url: string,
): string {
  const checklist = extractChecklist(i.body);
  const total = checklist.length;
  const checked = checklist.filter((c) => c.done).length;
  const boxStr = total > 0 ? `완료조건 ${checked}/${total}` : '완료조건 없음';
  const labels = parseLabels(i.labels);
  const labelStr = labels.length ? labels.join(',') : '없음';
  const out = [
    `- "${i.title}" — 상태 ${i.status} · ${boxStr} · 우선순위 ${PRIORITY_LABEL[i.priority] ?? i.priority} · 라벨 ${labelStr} · 링크: ${url}`,
  ];
  // 완료조건 항목별 상태(잔여 항목 서술·진척도 평가 근거)
  if (total > 0) {
    out.push(
      `  완료조건: ${checklist
        .map((c) => `[${c.done ? 'x' : ' '}] ${c.text}`)
        .join(' / ')}`,
    );
  }
  out.push(`  본문: ${truncate(i.body, 500)}`);
  return out.join('\n');
}

/** 마크다운 본문에서 완료조건 체크박스 항목을 추출한다(상태 + 라벨 텍스트). */
function extractChecklist(body: string): { done: boolean; text: string }[] {
  const re = /^\s*[-*]\s+\[( |x|X)\]\s*(.+?)\s*$/gm;
  const out: { done: boolean; text: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null && out.length < 15) {
    out.push({ done: m[1].toLowerCase() === 'x', text: truncate(m[2], 80) });
  }
  return out;
}

/** 기획 현재 내용 한 항목(상태 + 본문 요지). */
function formatPlanDetail(p: {
  title: string;
  status: string;
  content: string;
}): string {
  return `- "${p.title}" (상태 ${p.status})\n  내용: ${truncate(p.content, 800)}`;
}

/** 도메인 현재 내용 한 항목(컬럼/설명 요지). */
function formatDomainDetail(d: {
  name: string;
  description: string | null;
  columns: string;
  status: string;
}): string {
  const cols = parseColumnNames(d.columns);
  const desc = d.description ? ` — ${d.description}` : '';
  return `- "${d.name}" (상태 ${d.status})${desc}\n  컬럼: ${cols.length ? cols.join(', ') : '없음'}`;
}

/** labels JSON 문자열 → 문자열 배열(파싱 실패 시 빈 배열). */
function parseLabels(labels: string): string[] {
  try {
    const parsed = JSON.parse(labels) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/** columns JSON → 컬럼명 배열(파싱 실패 시 빈 배열). */
function parseColumnNames(columns: string): string[] {
  try {
    const parsed = JSON.parse(columns) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((c) =>
        c && typeof c === 'object' && 'name' in c
          ? String((c as { name: unknown }).name)
          : '',
      )
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** 긴 텍스트를 n자로 자르고 개행을 공백으로 접어 프롬프트 한 항목에 넣기 좋게 만든다. */
function truncate(text: string, n: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > n ? `${flat.slice(0, n)}…(생략)` : flat;
}

/**
 * 보고서 포맷 명세(단일 원본) 파일을 읽는다. 매 호출마다 새로 읽어 파일 수정을 즉시 반영한다.
 * 못 찾으면 FALLBACK_TEMPLATE로 안전하게 폴백한다.
 * 경로: env(DAILY_REPORT_TEMPLATE_PATH) → cwd 기준 → 컴파일 위치 기준 순으로 탐색.
 */
function loadTemplate(): string {
  const candidates = [
    process.env.DAILY_REPORT_TEMPLATE_PATH,
    resolve(process.cwd(), '../../agent/prompts/daily-report.md'),
    resolve(process.cwd(), 'agent/prompts/daily-report.md'),
    resolve(__dirname, '../../../../../agent/prompts/daily-report.md'),
  ].filter((p): p is string => Boolean(p));
  for (const p of candidates) {
    try {
      if (existsSync(p)) return readFileSync(p, 'utf8');
    } catch {
      // 다음 후보로
    }
  }
  return FALLBACK_TEMPLATE;
}

/** 명세 파일을 못 읽을 때의 최소 폴백(구조 동일). 정상 환경에선 파일이 우선. */
const FALLBACK_TEMPLATE = [
  '너는 개발 팀의 일일 업무 요약을 쓰는 전문 테크니컬 라이터이자 PM이다.',
  '근거 데이터(활동 로그·이슈 현재 상태)에 있는 것만 쓰고, 채울 수 없는 항목은 넣지 않는다.',
  '진척도: todo=0%, in_progress=50%, done=100%, blocked=중단(비이슈는 -).',
  '우선순위는 이슈 priority를 높음/보통/낮음으로. 이모지/아이콘·영문 소제목 없이 마크다운만 출력.',
  '',
  '## [일일 업무 보고] {프로젝트명} _ {YYYY.MM.DD} (작성자: 이슈보드 자동 생성)',
  '### 1. 금일 업무 총평',
  '### 2. 주요 업무 추진 현황',
  '| 분류 | 업무 내용 및 수행 결과 | 진척도 |',
  '| :--- | :--- | :---: |',
  '### 3. 차일 주요 예정 업무',
  '| 분류 | 예정 업무 내용 | 우선순위 |',
  '| :--- | :--- | :---: |',
  '### 4. 이슈 및 위험 요인',
  '(status=blocked 이슈 현황만. 없으면 "특이사항 없음".)',
].join('\n');

/**
 * spawn용 PATH 보강. nest(GUI/watch)로 뜬 서버 프로세스엔 ~/.local/bin 등이 빠져
 * `spawn claude ENOENT`가 나기 쉽다. claude가 흔히 설치되는 경로들을 앞에 붙인다.
 */
function augmentedPath(): string {
  const home = process.env.HOME ?? '';
  const extra = [
    `${home}/.local/bin`,
    `${home}/.bun/bin`,
    `${home}/.npm-global/bin`,
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
  ].filter(Boolean);
  const current = (process.env.PATH ?? '').split(':').filter(Boolean);
  return [...new Set([...extra, ...current])].join(':');
}

/** 타임존 tz에서의 오늘 (YYYY-MM-DD) */
function todayInTz(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
