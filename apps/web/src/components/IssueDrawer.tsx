import type { Issue, IssueStatus, Plan, Domain } from '@issue-board/shared';
import { ISSUE_STATUS } from '@issue-board/shared';
import { Markdown } from './Markdown';
import { Select } from './Select';
import { ISSUE_STATUS_LABEL as STATUS_LABEL } from '../constants';

/** 이슈 상태 → 드롭다운 트리거 색 tone */
const STATUS_TONE: Record<IssueStatus, string> = {
  todo: 'tone-neutral',
  in_progress: 'tone-blue',
  done: 'tone-green',
  blocked: 'tone-red',
};

/**
 * 이슈 상세 드로어. 본문(마크다운) + 상태 변경 + 연동 링크(기획/화면).
 */
export function IssueDrawer({
  issue,
  linkedPlan,
  linkedDomain,
  canViewScreen,
  onClose,
  onStatusChange,
  onViewPlan,
  onViewScreen,
  onViewDomain,
  onToggleCheckbox,
}: {
  issue: Issue;
  linkedPlan: Plan | null;
  linkedDomain: Domain | null;
  canViewScreen: boolean;
  onClose: () => void;
  onStatusChange: (status: IssueStatus) => void;
  onViewPlan: () => void;
  onViewScreen: () => void;
  onViewDomain: () => void;
  onToggleCheckbox: (index: number) => void;
}) {
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer">
        <header className="drawer-head">
          <span className={`badge prio-badge-${issue.priority}`}>
            {issue.priority}
          </span>
          <button className="drawer-close" onClick={onClose} title="닫기">
            ✕
          </button>
        </header>

        <h2 className="drawer-title">{issue.title}</h2>

        <div className="drawer-row">
          <label>상태</label>
          <Select
            ariaLabel="상태 변경"
            triggerClassName={STATUS_TONE[issue.status]}
            value={issue.status}
            onChange={(v) => onStatusChange(v as IssueStatus)}
            options={ISSUE_STATUS.map((s) => ({
              value: s,
              label: STATUS_LABEL[s],
            }))}
          />
        </div>

        {issue.labels.length > 0 && (
          <div className="drawer-row">
            <label>라벨</label>
            <span className="issue-meta">
              {issue.labels.map((l) => (
                <span className="label" key={l}>
                  {l}
                </span>
              ))}
            </span>
          </div>
        )}

        {(linkedPlan || canViewScreen || linkedDomain) && (
          <div className="drawer-links">
            {linkedPlan && (
              <button className="link-btn" onClick={onViewPlan}>
                📋 기획 보기 · {linkedPlan.title}
              </button>
            )}
            {linkedDomain && (
              <button className="link-btn" onClick={onViewDomain}>
                🗂️ 도메인 보기 · {linkedDomain.name}
              </button>
            )}
            {canViewScreen && (
              <button className="link-btn" onClick={onViewScreen}>
                🖼️ 관련 화면 보기
              </button>
            )}
          </div>
        )}

        <div className="drawer-body">
          <Markdown onCheckboxToggle={onToggleCheckbox}>{issue.body}</Markdown>
        </div>
      </aside>
    </>
  );
}
