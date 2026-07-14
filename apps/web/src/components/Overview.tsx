import { useEffect, useState } from 'react';
import type {
  Plan,
  Issue,
  Domain,
  Wireframe,
  Design,
  DailySummary,
  Activity,
  ActivityEntity,
  ActivityAction,
  IssueStatus,
  IssuePriority,
} from '@issue-board/shared';
import { api } from '../api/client';
import {
  uploadDailyReport,
  isDriveConfigured,
  type DriveUploadResult,
} from '../api/drive';
import { renderDailyReport, dailyReportFileName } from '../api/dailyReport';

/**
 * 대시보드(개요) 탭. 로드된 데이터로 프로젝트 현황을 한눈에 요약한다.
 * - KPI 스탯 타일 (완료율·이슈·기획·도메인·와이어프레임)
 * - 이슈 상태/우선순위 분포 (세그먼트 바 + 범례)
 * - 에픽별 진행률
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

// 오늘의 작업 — 엔티티/액션 한글 라벨 및 표시 순서
const ENTITY_META: { key: ActivityEntity; label: string; icon: string }[] = [
  { key: 'plan', label: '기획', icon: '🗂' },
  { key: 'domain', label: '도메인', icon: '🧩' },
  { key: 'issue', label: '이슈', icon: '✅' },
  { key: 'wireframe', label: '와이어프레임', icon: '🖼' },
  { key: 'design', label: '디자인', icon: '🎨' },
  { key: 'project', label: '프로젝트', icon: '📁' },
];

const ACTION_LABEL: Record<ActivityAction, string> = {
  created: '신규',
  updated: '수정',
  status_changed: '상태변경',
  snapshot: '스냅샷',
  linked: '연동',
  deleted: '삭제',
};

function activityDetail(a: Activity): string {
  const st = a.changes?.status;
  if (a.action === 'status_changed' && st) return `${st.from} → ${st.to}`;
  const label = a.changes?.label;
  if (a.action === 'snapshot' && label?.to) return label.to;
  return '';
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
  projectName,
  plans,
  issues,
  domains,
  wireframes,
  design,
  onGoTab,
  onSelectIssue,
}: {
  projectId: string | null;
  projectName: string;
  plans: Plan[];
  issues: Issue[];
  domains: Domain[];
  wireframes: Wireframe[];
  design: Design | null;
  onGoTab: (tab: 'issues' | 'plans' | 'domains' | 'wireframes' | 'design') => void;
  onSelectIssue: (issue: Issue) => void;
}) {
  // 오늘의 작업 요약 — 보드 데이터가 갱신될 때(SSE 리로드 포함) 다시 가져온다.
  const [summary, setSummary] = useState<DailySummary | null>(null);
  useEffect(() => {
    if (!projectId) {
      setSummary(null);
      return;
    }
    let alive = true;
    api
      .getDailySummary(projectId)
      .then((s) => {
        if (alive) setSummary(s);
      })
      .catch(() => {
        if (alive) setSummary(null);
      });
    return () => {
      alive = false;
    };
    // 보드 데이터 변화(생성/수정/상태변경)에 맞춰 요약도 갱신
  }, [projectId, issues, plans, domains, wireframes, design]);

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

      {/* 오늘의 작업 */}
      <DailyWork
        summary={summary}
        projectName={projectName}
        onSelectIssue={onSelectIssue}
        issues={issues}
      />

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

/** 오늘 이 프로젝트에서 일어난 변경을 엔티티별로 묶어 보여준다. */
function DailyWork({
  summary,
  projectName,
  issues,
  onSelectIssue,
}: {
  summary: DailySummary | null;
  projectName: string;
  issues: Issue[];
  onSelectIssue: (issue: Issue) => void;
}) {
  if (!summary) return null;

  const grouped = ENTITY_META.map((meta) => ({
    meta,
    items: summary.activities.filter((a) => a.entityType === meta.key),
  })).filter((g) => g.items.length > 0);

  return (
    <section className="ov-card ov-daily">
      <div className="ov-daily-head">
        <h3 className="ov-card-title">오늘의 작업</h3>
        <span className="ov-daily-date">{summary.date}</span>
        <span className="ov-daily-total">{summary.total}건</span>
        <DriveUpload summary={summary} projectName={projectName} />
      </div>

      {summary.total === 0 ? (
        <p className="ov-daily-empty">오늘 기록된 변경이 없습니다.</p>
      ) : (
        <div className="ov-daily-groups">
          {grouped.map(({ meta, items }) => (
            <div key={meta.key} className="ov-daily-group">
              <div className="ov-daily-group-head">
                <span className="ov-daily-icon">{meta.icon}</span>
                {meta.label}
                <b>{items.length}</b>
              </div>
              <ul className="ov-daily-list">
                {items.map((a) => {
                  const detail = activityDetail(a);
                  const issue =
                    a.entityType === 'issue'
                      ? issues.find((i) => i.id === a.entityId)
                      : undefined;
                  const clickable = Boolean(issue);
                  return (
                    <li
                      key={a.id}
                      className={
                        'ov-daily-item' + (clickable ? ' ov-daily-item--btn' : '')
                      }
                      onClick={clickable ? () => onSelectIssue(issue!) : undefined}
                    >
                      <span
                        className={`ov-daily-badge ov-daily-badge--${a.action}`}
                      >
                        {ACTION_LABEL[a.action]}
                      </span>
                      <span className="ov-daily-title">{a.title}</span>
                      {detail && (
                        <span className="ov-daily-detail">{detail}</span>
                      )}
                      {a.source === 'agent' && (
                        <span className="ov-daily-src" title="Claude/MCP">
                          🤖
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * 오늘의 요약을 구글 드라이브에 업로드하는 버튼.
 * 브라우저에서 직접(GIS access_token) 올린다 — 서버·secret 불필요.
 * 같은 날짜 문서가 있으면 갱신, 없으면 새 Google Docs 문서를 만든다.
 */
function DriveUpload({
  summary,
  projectName,
}: {
  summary: DailySummary;
  projectName: string;
}) {
  type State =
    | { kind: 'idle' }
    | { kind: 'uploading' }
    | { kind: 'done'; result: DriveUploadResult }
    | { kind: 'error'; message: string };
  const [state, setState] = useState<State>({ kind: 'idle' });

  const configured = isDriveConfigured();
  const disabled =
    !configured ||
    !projectName ||
    summary.total === 0 ||
    state.kind === 'uploading';

  const upload = async (): Promise<void> => {
    setState({ kind: 'uploading' });
    try {
      const markdown = renderDailyReport(summary, projectName);
      const fileName = dailyReportFileName(summary.date, projectName);
      const result = await uploadDailyReport({
        projectName,
        fileName,
        markdown,
      });
      setState({ kind: 'done', result });
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const title = !configured
    ? 'VITE_GOOGLE_CLIENT_ID 미설정 — 웹 앱 .env 에 구글 클라이언트 ID를 넣어주세요'
    : summary.total === 0
      ? '오늘 기록된 변경이 없어 업로드할 내용이 없습니다'
      : '오늘의 요약을 구글 드라이브에 올립니다';

  return (
    <span className="ov-drive">
      <button
        type="button"
        className="ov-drive-btn"
        onClick={upload}
        disabled={disabled}
        title={title}
      >
        {state.kind === 'uploading' ? '업로드 중…' : '드라이브 업로드'}
      </button>
      {state.kind === 'done' && (
        <a
          className="ov-drive-link"
          href={state.result.webViewLink}
          target="_blank"
          rel="noreferrer"
        >
          {state.result.updated ? '갱신됨 · 문서 열기 ↗' : '업로드됨 · 문서 열기 ↗'}
        </a>
      )}
      {state.kind === 'error' && (
        <span className="ov-drive-err" title={state.message}>
          실패: {state.message}
        </span>
      )}
    </span>
  );
}
