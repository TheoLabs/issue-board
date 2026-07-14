import type {
  Plan,
  Issue,
  Domain,
  Wireframe,
  Design,
  IssueStatus,
  IssuePriority,
} from '@issue-board/shared';

/**
 * 대시보드(개요) 탭. 로드된 데이터로 프로젝트 현황을 한눈에 요약한다.
 * - KPI 스탯 타일 (완료율·이슈·기획·도메인·와이어프레임)
 * - 이슈 상태/우선순위 분포 (세그먼트 바 + 범례)
 * - 에픽별 진행률
 * (일자별 활동은 별도의 "일일 업무" 탭에서 본다)
 */

const STATUS_META: { key: IssueStatus; label: string; color: string }[] = [
  { key: 'todo', label: '할일', color: 'var(--muted)' },
  { key: 'in_progress', label: '진행 중', color: 'var(--accent)' },
  { key: 'done', label: '완료', color: 'var(--prio-low)' },
  { key: 'blocked', label: '보류', color: 'var(--prio-high)' },
];

const PRIO_META: { key: IssuePriority; label: string; color: string }[] = [
  { key: 'high', label: '높음', color: 'var(--prio-high)' },
  { key: 'medium', label: '보통', color: 'var(--prio-medium)' },
  { key: 'low', label: '낮음', color: 'var(--prio-low)' },
];

function SegBar({
  items,
}: {
  items: { label: string; count: number; color: string }[];
}) {
  const total = items.reduce((s, i) => s + i.count, 0) || 1;
  return (
    <>
      <div className="ov-segbar">
        {items
          .filter((i) => i.count > 0)
          .map((i) => (
            <div
              key={i.label}
              className="ov-seg"
              style={{ flexGrow: i.count, background: i.color }}
              title={`${i.label} ${i.count}`}
            />
          ))}
      </div>
      <div className="ov-legend">
        {items.map((i) => (
          <span key={i.label} className="ov-legend-item">
            <span className="ov-dot" style={{ background: i.color }} />
            {i.label}
            <b>{i.count}</b>
            <span className="ov-legend-pct">
              {Math.round((i.count / total) * 100)}%
            </span>
          </span>
        ))}
      </div>
    </>
  );
}

export function Overview({
  plans,
  issues,
  domains,
  wireframes,
  design,
  onGoTab,
  onSelectIssue,
}: {
  plans: Plan[];
  issues: Issue[];
  domains: Domain[];
  wireframes: Wireframe[];
  design: Design | null;
  onGoTab: (tab: 'issues' | 'plans' | 'domains' | 'wireframes' | 'design') => void;
  onSelectIssue: (issue: Issue) => void;
}) {
  const total = issues.length;
  const doneN = issues.filter((i) => i.status === 'done').length;
  const pct = total ? Math.round((doneN / total) * 100) : 0;
  const epics = issues.filter((i) => i.type === 'epic');
  const tasks = total - epics.length;
  const wfCount = new Set(wireframes.map((w) => w.name)).size;

  const statusItems = STATUS_META.map((m) => ({
    label: m.label,
    color: m.color,
    count: issues.filter((i) => i.status === m.key).length,
  }));
  const prioItems = PRIO_META.map((m) => ({
    label: m.label,
    color: m.color,
    count: issues.filter((i) => i.priority === m.key).length,
  }));

  const epicRows = epics
    .map((e) => {
      const kids = issues.filter((i) => i.parentId === e.id);
      const done = kids.filter((k) => k.status === 'done').length;
      return { epic: e, total: kids.length, done };
    })
    .sort((a, b) => {
      const pa = a.total ? a.done / a.total : 0;
      const pb = b.total ? b.done / b.total : 0;
      return pb - pa;
    });

  return (
    <div className="ov">
      {/* KPI 타일 */}
      <div className="ov-kpis">
        <div className="ov-kpi ov-kpi--accent">
          <div className="ov-kpi-label">완료율</div>
          <div className="ov-kpi-value">{pct}%</div>
          <div className="ov-meter">
            <span style={{ width: `${pct}%` }} />
          </div>
          <div className="ov-kpi-sub">
            {doneN} / {total} 완료
          </div>
        </div>
        <button className="ov-kpi ov-kpi--btn" onClick={() => onGoTab('issues')}>
          <div className="ov-kpi-label">이슈</div>
          <div className="ov-kpi-value">{total}</div>
          <div className="ov-kpi-sub">
            에픽 {epics.length} · 태스크 {tasks}
          </div>
        </button>
        <button className="ov-kpi ov-kpi--btn" onClick={() => onGoTab('plans')}>
          <div className="ov-kpi-label">기획</div>
          <div className="ov-kpi-value">{plans.length}</div>
        </button>
        <button className="ov-kpi ov-kpi--btn" onClick={() => onGoTab('domains')}>
          <div className="ov-kpi-label">도메인</div>
          <div className="ov-kpi-value">{domains.length}</div>
        </button>
        <button
          className="ov-kpi ov-kpi--btn"
          onClick={() => onGoTab('wireframes')}
        >
          <div className="ov-kpi-label">와이어프레임</div>
          <div className="ov-kpi-value">{wfCount}</div>
        </button>
        <button className="ov-kpi ov-kpi--btn" onClick={() => onGoTab('design')}>
          <div className="ov-kpi-label">디자인 시스템</div>
          <div className="ov-kpi-value ov-kpi-value--sm">
            {design ? (design.status === 'draft' ? '초안' : '확정') : '없음'}
          </div>
        </button>
      </div>

      {/* 분포 */}
      <div className="ov-grid2">
        <section className="ov-card">
          <h3 className="ov-card-title">이슈 상태</h3>
          <SegBar items={statusItems} />
        </section>
        <section className="ov-card">
          <h3 className="ov-card-title">우선순위</h3>
          <SegBar items={prioItems} />
        </section>
      </div>

      {/* 에픽 진행률 */}
      {epicRows.length > 0 && (
        <section className="ov-card">
          <h3 className="ov-card-title">에픽 진행률</h3>
          <div className="ov-epics">
            {epicRows.map(({ epic, total: t, done }) => {
              const p = t ? Math.round((done / t) * 100) : 0;
              return (
                <button
                  key={epic.id}
                  className="ov-epic"
                  onClick={() => onSelectIssue(epic)}
                >
                  <span className="ov-epic-name">{epic.title}</span>
                  <span className="ov-epic-bar">
                    <span
                      className="ov-epic-fill"
                      style={{ width: `${p}%` }}
                    />
                  </span>
                  <span className="ov-epic-count">
                    {done}/{t}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
