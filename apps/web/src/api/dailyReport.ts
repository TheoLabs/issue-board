import type {
  Activity,
  ActivityEntity,
  DailySummary,
} from '@issue-board/shared';
import { ISSUE_STATUS_LABEL } from '../constants';

/**
 * DailySummary → 팀 공유용 일일 업무 보고 마크다운 (섹션형/스탠드업).
 *
 * 구조: 요약 → 완료 → 진행 중 → 신규 등록 → 산출물 변경 → 내일 이어서 → 정리(줄글).
 * LLM 없이 활동 로그를 규칙대로 분류·서술한다.
 * 분류 규칙:
 *   - 이슈: 상태 done→완료, in_progress→진행 중, 그 외 편집→진행 중(기타)
 *   - 신규 등록: 오늘 새로 만들어진(created) 모든 항목(종류 라벨)
 *   - 산출물 변경: 비이슈(기획/도메인/WF/디자인) 중 created가 아닌 변경
 *   - 내일 이어서: 오늘 진행 중으로 전환된 이슈
 */
export function renderDailyReport(
  summary: DailySummary,
  projectName: string,
): string {
  const { date, byEntity, total } = summary;
  const acts = summary.activities;

  const header = [
    `# 일일 업무 보고 — ${projectName}`,
    `${date} (${weekday(date)}) · 이슈보드 자동 생성`,
    '',
  ];

  if (total === 0) {
    return (
      [...header, '## 요약', '기록된 변경이 없습니다.', '', FOOTER].join('\n') +
      '\n'
    );
  }

  const { done, progress, otherIssue, created, deliverables } = classify(acts);

  const lines: string[] = [...header];

  // ── 요약 ──
  lines.push(
    '## 요약',
    `총 ${total}건  ·  완료 ${done.length}  ·  진행 ${progress.length}  ·  신규 ${created.length}`,
    `기획 ${byEntity.plan} · 도메인 ${byEntity.domain} · 이슈 ${byEntity.issue} · 와이어프레임 ${byEntity.wireframe} · 디자인 ${byEntity.design}`,
  );

  // ── 완료 ──
  lines.push('', '## 완료');
  if (done.length === 0) lines.push('— (없음)');
  else for (const a of done) lines.push(`- ${a.title}${marker(a)}`);

  // ── 진행 중 (in_progress 전환 + 기타 이슈 편집) ──
  lines.push('', '## 진행 중');
  const active = [...progress, ...otherIssue];
  if (active.length === 0) lines.push('— (없음)');
  else for (const a of active) lines.push(`- ${a.title}${issueNote(a)}${marker(a)}`);

  // ── 신규 등록 ──
  lines.push('', '## 신규 등록');
  if (created.length === 0) lines.push('— (없음)');
  else
    for (const a of created)
      lines.push(`- ${ENTITY_LABEL[a.entityType]}: ${a.title}${marker(a)}`);

  // ── 산출물 변경 (있을 때만) ──
  if (deliverables.length > 0) {
    lines.push('', '## 산출물 변경');
    for (const a of deliverables)
      lines.push(
        `- ${ENTITY_LABEL[a.entityType]}: ${a.title}${snapshotNote(a)}${marker(a)}`,
      );
  }

  // ── 내일 이어서 (있을 때만) ──
  if (progress.length > 0) {
    lines.push('', '## 내일 이어서');
    for (const a of progress) lines.push(`- ${a.title}`);
  }

  // ── 정리 (줄글) ──
  lines.push(
    '',
    '## 정리',
    narrative(summary, { done, progress, otherIssue, created, deliverables }),
  );

  lines.push('', FOOTER);
  return lines.join('\n') + '\n';
}

/**
 * 줄글 요약 문단만 반환한다(웹 "일일 업무" 탭의 정리 표시용).
 * 보고서 마크다운의 "## 정리" 섹션과 동일한 문장.
 */
export function dailySummaryText(summary: DailySummary): string {
  if (summary.total === 0) return '기록된 변경이 없습니다.';
  const b = classify(summary.activities);
  return narrative(summary, b);
}

interface Buckets {
  done: Activity[];
  progress: Activity[];
  otherIssue: Activity[];
  created: Activity[];
  deliverables: Activity[];
}

/**
 * 활동을 보고서 섹션 기준으로 분류한다.
 *   - 이슈: 상태 done→완료, in_progress→진행 중, 그 외 편집→기타
 *   - created: 종류 불문 신규(엔티티 순서대로)
 *   - deliverables: 비이슈(기획/도메인/WF/디자인) 중 created가 아닌 변경
 */
function classify(acts: Activity[]): Buckets {
  const issues = dedupeLatest(acts.filter((a) => a.entityType === 'issue'));
  const done = issues.filter(
    (a) => a.action === 'status_changed' && a.changes?.status?.to === 'done',
  );
  const progress = issues.filter(
    (a) =>
      a.action === 'status_changed' && a.changes?.status?.to === 'in_progress',
  );
  const otherIssue = issues.filter(
    (a) => !done.includes(a) && !progress.includes(a) && a.action !== 'created',
  );
  const created = ENTITY_ORDER.flatMap((e) =>
    dedupeLatest(
      acts.filter((a) => a.entityType === e && a.action === 'created'),
    ),
  );
  const deliverables = DELIVERABLE_ORDER.flatMap((e) =>
    dedupeLatest(
      acts.filter((a) => a.entityType === e && a.action !== 'created'),
    ),
  );
  return { done, progress, otherIssue, created, deliverables };
}

/** 드라이브 파일명: `{YYYY-MM-DD} {프로젝트명} 일일요약` */
export function dailyReportFileName(
  date: string,
  projectName: string,
): string {
  return `${date} ${projectName} 일일요약`;
}

const FOOTER =
  '---\n출처: issue-board · 🤖=Claude(MCP), 표기 없음=웹 사용자';

const ENTITY_ORDER: ActivityEntity[] = [
  'plan',
  'domain',
  'issue',
  'wireframe',
  'design',
  'project',
];
const DELIVERABLE_ORDER: ActivityEntity[] = [
  'plan',
  'domain',
  'wireframe',
  'design',
];
const ENTITY_LABEL: Record<ActivityEntity, string> = {
  plan: '기획',
  domain: '도메인',
  issue: '이슈',
  wireframe: '와이어프레임',
  design: '디자인',
  project: '프로젝트',
};

/** 이슈 한 줄 뒤 상태/변경 표기. */
function issueNote(a: Activity): string {
  const st = a.changes?.status;
  if (st) return `  (${statusLabel(st.from)} → ${statusLabel(st.to)})`;
  if (a.action === 'updated') return '  (수정)';
  return '';
}

/** 스냅샷 라벨(예: 디자인 "v1 초안") 표기. */
function snapshotNote(a: Activity): string {
  const label = a.changes?.label;
  return a.action === 'snapshot' && label?.to ? ` — ${label.to}` : '';
}

function statusLabel(s: string | null | undefined): string {
  if (!s) return '';
  return ISSUE_STATUS_LABEL[s as keyof typeof ISSUE_STATUS_LABEL] ?? s;
}

/** source=agent(Claude/MCP) 로 생긴 항목 구분 표시 */
function marker(a: Activity): string {
  return a.source === 'agent' ? ' 🤖' : '';
}

/**
 * 오늘 활동을 읽어 줄글 요약을 만든다(규칙 기반, LLM 없음).
 * 비어 있는 항목은 문장 자체를 생략한다.
 */
function narrative(
  summary: DailySummary,
  b: {
    done: Activity[];
    progress: Activity[];
    otherIssue: Activity[];
    created: Activity[];
    deliverables: Activity[];
  },
): string {
  const { total, bySource } = summary;
  const sentences: string[] = [];

  const createdIssues = b.created.filter((a) => a.entityType === 'issue');
  const createdDeliverables = b.created.filter((a) => a.entityType !== 'issue');

  // 이슈 진척
  if (b.done.length > 0)
    sentences.push(`이슈 ${withEul(joinTitles(b.done))} 완료했습니다.`);
  if (b.progress.length > 0)
    sentences.push(`${withEul(joinTitles(b.progress))} 진행 중으로 전환했습니다.`);
  if (createdIssues.length > 0)
    sentences.push(`${joinTitles(createdIssues)} 이슈를 새로 등록했습니다.`);
  if (b.otherIssue.length > 0)
    sentences.push(`${withEul(joinTitles(b.otherIssue))} 수정했습니다.`);

  // 산출물 (신규 생성 + 변경 합쳐 종류별로 서술)
  const deliverParts = [...createdDeliverables, ...b.deliverables].map(
    (a) => `${ENTITY_LABEL[a.entityType]} '${a.title}'`,
  );
  if (deliverParts.length > 0)
    sentences.push(`산출물로는 ${withEul(joinList(deliverParts))} 작업했습니다.`);

  // 주체
  if (bySource.agent > 0 && bySource.user > 0)
    sentences.push(
      `전체 ${total}건 중 ${bySource.agent}건은 Claude(MCP)로, ${bySource.user}건은 웹에서 처리됐습니다.`,
    );
  else if (bySource.agent > 0)
    sentences.push(`전체 ${total}건 모두 Claude(MCP)로 처리됐습니다.`);

  // 내일
  if (b.progress.length > 0)
    sentences.push(
      `내일은 ${withEul(joinTitles(b.progress))} 이어서 진행할 예정입니다.`,
    );

  return sentences.join(' ');
}

/** 받침 유무에 따라 을/를을 붙인다. */
function withEul(phrase: string): string {
  return phrase + (endsWithBatchim(phrase) ? '을' : '를');
}

const DIGIT_BATCHIM = [
  true, // 0 영
  true, // 1 일
  false, // 2 이
  true, // 3 삼
  false, // 4 사
  false, // 5 오
  true, // 6 육
  true, // 7 칠
  true, // 8 팔
  false, // 9 구
];

/** 문자열의 마지막 유의미 문자로 받침(종성) 유무 판정. */
function endsWithBatchim(str: string): boolean {
  const ch = lastCoreChar(str);
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  if (ch >= '0' && ch <= '9') return DIGIT_BATCHIM[Number(ch)];
  return false; // 영문·기타는 받침 없음으로 간주(를)
}

/** 뒤쪽 따옴표·괄호·구두점을 건너뛴 마지막 실제 문자. */
function lastCoreChar(str: string): string {
  for (let i = str.length - 1; i >= 0; i--) {
    const c = str[i];
    if (/[\s'"'’)\]}·.,]/.test(c)) continue;
    return c;
  }
  return '';
}

/** 제목 목록을 "A, B, C 외 N건" 형태로. 이슈 제목은 그대로(대괄호 포함). */
function joinTitles(items: Activity[], max = 4): string {
  return joinList(
    items.map((a) => a.title),
    max,
  );
}

function joinList(names: string[], max = 4): string {
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')} 외 ${names.length - max}건`;
}

/**
 * 같은 대상(entityId)이 여러 번 바뀌었으면 마지막 상태 한 줄로 합친다.
 * activities 는 최신순(desc)이므로 처음 만난 것이 최신.
 */
function dedupeLatest(items: Activity[]): Activity[] {
  const seen = new Set<string>();
  const out: Activity[] = [];
  for (const a of items) {
    if (seen.has(a.entityId)) continue;
    seen.add(a.entityId);
    out.push(a);
  }
  return out;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** YYYY-MM-DD → 한글 요일. 파싱 불가 시 빈 문자열. */
function weekday(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return '';
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return WEEKDAYS[dow] ?? '';
}
