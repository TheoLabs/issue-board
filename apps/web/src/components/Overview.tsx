import { useEffect, useState } from 'react';
import type {
  Plan,
  Issue,
  Domain,
  Wireframe,
  Design,
  DailyReport,
  IssueStatus,
  IssuePriority,
} from '@issue-board/shared';
import { api } from '../api/client';
import { Analytics } from './Analytics';

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

/** 보고서 본문에서 제목(첫 heading 줄)만 추출. 앞의 #·공백 제거. */
function reportTitle(content: string): string {
  const first =
    content
      .split('\n')
      .map((l) => l.trim())
      .find(Boolean) ?? '';
  return first.replace(/^#+\s*/, '');
}

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
  projectId,
  plans,
  issues,
  domains,
  wireframes,
  design,
  applicationId,
  onGoTab,
  onSelectIssue,
}: {
  projectId: string | null;
  plans: Plan[];
  issues: Issue[];
  domains: Domain[];
  wireframes: Wireframe[];
  design: Design | null;
  /** 선택된 앱(전달 표면). null이면 프로젝트 전체 기준 */
  applicationId?: string | null;
  onGoTab: (
    tab: 'issues' | 'plans' | 'domains' | 'wireframes' | 'design' | 'daily',
  ) => void;
  onSelectIssue: (issue: Issue) => void;
}) {
  // 오늘의 일일 업무 보고 유무(있으면 제목만 표시). undefined=확인 중, null=없음
  const [todayReport, setTodayReport] = useState<
    DailyReport | null | undefined
  >(undefined);
  const [epicPage, setEpicPage] = useState(0);
  useEffect(() => {
    if (!projectId) {
      setTodayReport(null);
      return;
    }
    let alive = true;
    setTodayReport(undefined);
    api
      .getDailyReport(projectId)
      .then((r) => alive && setTodayReport(r))
      .catch(() => alive && setTodayReport(null));
    return () => {
      alive = false;
    };
  }, [projectId]);

  const total = issues.length;
  const doneN = issues.filter((i) => i.status === 'done').length;
  const pct = total ? Math.round((doneN / total) * 100) : 0;
  const epics = issues.filter((i) => i.type === 'epic');
  const tasks = total - epics.length;
  const wfCount = new Set(wireframes.map((w) => w.name)).size;
  // 승인 대기 = 아직 승인되지 않은 초안(draft). 관리자 승인 후 작업 진행 대상.
  const plansPending = plans.filter((p) => p.status === 'draft').length;
  const domainsPending = domains.filter((d) => d.status === 'draft').length;

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

  // 에픽 진행률: 페이지당 6개 페이지네이션
  const EPICS_PER_PAGE = 6;
  const epicPageCount = Math.max(1, Math.ceil(epicRows.length / EPICS_PER_PAGE));
  const safeEpicPage = Math.min(epicPage, epicPageCount - 1);
  const epicPageRows = epicRows.slice(
    safeEpicPage * EPICS_PER_PAGE,
    safeEpicPage * EPICS_PER_PAGE + EPICS_PER_PAGE,
  );
  // 앱 전환 등으로 목록이 바뀌면 첫 페이지로
  useEffect(() => {
    setEpicPage(0);
  }, [applicationId]);

  const reportReady =
    !!todayReport && todayReport.status === 'ready' && !!todayReport.content;

  return (
    <div className="ov">
      {/* 오늘의 일일 업무 보고 유무 (있으면 제목만, 클릭 시 일일 업무 탭으로) */}
      <button
        className="ov-today"
        onClick={() => onGoTab('daily')}
        title="일일 업무 탭으로 이동"
      >
        <span
          className={
            'ov-today-dot' +
            (todayReport === undefined
              ? ''
              : reportReady
                ? ' ov-today-dot--on'
                : ' ov-today-dot--off')
          }
        />
        <span className="ov-today-label">오늘의 일일 업무 보고</span>
        {todayReport === undefined ? (
          <span className="ov-today-status">확인 중…</span>
        ) : reportReady ? (
          <span className="ov-today-title">{reportTitle(todayReport.content)}</span>
        ) : (
          <span className="ov-today-status ov-today-status--off">
            아직 생성 전 · 눌러서 생성
          </span>
        )}
      </button>

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
          <div
            className={`ov-kpi-sub${plansPending > 0 ? ' ov-kpi-sub--warn' : ''}`}
          >
            {plansPending > 0 ? `승인 대기 ${plansPending}` : '전체 승인됨'}
          </div>
        </button>
        <button className="ov-kpi ov-kpi--btn" onClick={() => onGoTab('domains')}>
          <div className="ov-kpi-label">도메인</div>
          <div className="ov-kpi-value">{domains.length}</div>
          <div
            className={`ov-kpi-sub${domainsPending > 0 ? ' ov-kpi-sub--warn' : ''}`}
          >
            {domainsPending > 0 ? `승인 대기 ${domainsPending}` : '전체 승인됨'}
          </div>
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

      {/* 진행 분석 (가치×노력 매트릭스 + 시계열) */}
      {projectId && (
        <Analytics
          projectId={projectId}
          issues={issues}
          applicationId={applicationId}
        />
      )}

      {/* 에픽 진행률 */}
      {epicRows.length > 0 && (
        <section className="ov-card">
          <div className="ov-epics-head">
            <h3 className="ov-card-title">에픽 진행률</h3>
            {epicPageCount > 1 && (
              <div className="ov-pager">
                <button
                  onClick={() => setEpicPage((p) => Math.max(0, p - 1))}
                  disabled={safeEpicPage === 0}
                  aria-label="이전 페이지"
                >
                  ‹
                </button>
                <span>
                  {safeEpicPage + 1}/{epicPageCount}
                </span>
                <button
                  onClick={() =>
                    setEpicPage((p) => Math.min(epicPageCount - 1, p + 1))
                  }
                  disabled={safeEpicPage >= epicPageCount - 1}
                  aria-label="다음 페이지"
                >
                  ›
                </button>
              </div>
            )}
          </div>
          <div className="ov-epics">
            {epicPageRows.map(({ epic, total: t, done }) => {
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
