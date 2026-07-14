import type {
  Activity,
  ActivityAction,
  DailySummary,
} from '@issue-board/shared';

/**
 * DailySummary → ib-daily 정규화 템플릿 마크다운.
 *
 * agent/commands/ib-daily.md 의 고정 구조를 그대로 따르되, TL;DR 서술은 LLM 없이
 * 기계적으로 채운다(건수 요약). 나머지 섹션은 활동 로그를 엔티티별로 정리한다.
 * 데이터가 없는 섹션·소분류는 통째로 생략한다.
 */
export function renderDailyReport(
  summary: DailySummary,
  projectName: string,
): string {
  const { date, byEntity, total } = summary;
  const acts = summary.activities;

  const countsLine =
    `기획 ${byEntity.plan} · 도메인 ${byEntity.domain} · 이슈 ${byEntity.issue} · ` +
    `와이어프레임 ${byEntity.wireframe} · 디자인 ${byEntity.design} — 총 ${total}건`;

  const lines: string[] = [
    `# 📋 일일 업무 요약 — ${projectName}`,
    `${date} (${weekday(date)}) · 자동 생성 by 이슈보드`,
    '',
    '## TL;DR',
    total === 0
      ? '오늘 기록된 변경이 없습니다.'
      : `오늘 이 프로젝트에서 총 ${total}건의 변경이 있었습니다.`,
    countsLine,
  ];

  // 🗂 기획 / 🧩 도메인 / 🖼 와이어프레임 / 🎨 디자인 — 대상별 최신 상태 한 줄
  const simpleSection = (
    heading: string,
    entity: Activity['entityType'],
  ): void => {
    const items = dedupeLatest(acts.filter((a) => a.entityType === entity));
    if (items.length === 0) return;
    lines.push('', heading);
    for (const a of items) {
      lines.push(`- ${ACTION_LABEL[a.action]}: "${a.title}"${marker(a)}`);
    }
  };

  simpleSection('## 🗂 기획', 'plan');
  simpleSection('## 🧩 도메인', 'domain');

  // ✅ 이슈 — 결과 상태 중심 소분류 (완료 / 진행 중 / 신규 / 기타)
  const issues = dedupeLatest(acts.filter((a) => a.entityType === 'issue'));
  if (issues.length > 0) {
    const done: Activity[] = [];
    const progress: Activity[] = [];
    const created: Activity[] = [];
    const other: Activity[] = [];
    for (const a of issues) {
      const to = a.changes?.status?.to;
      if (a.action === 'status_changed' && to === 'done') done.push(a);
      else if (a.action === 'status_changed' && to === 'in_progress')
        progress.push(a);
      else if (a.action === 'created') created.push(a);
      else other.push(a);
    }
    lines.push('', '## ✅ 이슈');
    const bucket = (label: string, items: Activity[], withFlow = false): void => {
      if (items.length === 0) return;
      lines.push(`**${label}**`);
      for (const a of items) {
        const flow =
          withFlow && a.changes?.status
            ? ` (${a.changes.status.from} → ${a.changes.status.to})`
            : '';
        lines.push(`- "${a.title}"${flow}${marker(a)}`);
      }
    };
    bucket('완료', done);
    bucket('진행 중', progress, true);
    bucket('신규', created);
    bucket('기타 변경', other);

    // ⏭ 내일 이어서 — 오늘 in_progress 로 전이해 남은 이슈들
    if (progress.length > 0) {
      lines.push('', '## ⏭ 내일 이어서');
      for (const a of progress) lines.push(`- "${a.title}"`);
    }
  }

  simpleSection('## 🖼 와이어프레임', 'wireframe');
  simpleSection('## 🎨 디자인', 'design');

  lines.push(
    '',
    '---',
    '출처: issue-board · 주체 표기 🤖=Claude(MCP), (없음)=웹 사용자',
  );

  return lines.join('\n') + '\n';
}

/** 드라이브 파일명: `{YYYY-MM-DD} {프로젝트명} 일일요약` */
export function dailyReportFileName(
  date: string,
  projectName: string,
): string {
  return `${date} ${projectName} 일일요약`;
}

const ACTION_LABEL: Record<ActivityAction, string> = {
  created: '신규',
  updated: '수정',
  status_changed: '상태변경',
  snapshot: '스냅샷',
  linked: '연동',
  deleted: '삭제',
};

/** source=agent(Claude/MCP) 로 생긴 항목 구분 표시 */
function marker(a: Activity): string {
  return a.source === 'agent' ? ' 🤖' : '';
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
