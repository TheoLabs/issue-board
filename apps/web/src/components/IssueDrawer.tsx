import type {
  Issue,
  IssueStatus,
  IssueLevel,
  Plan,
  Domain,
} from '@issue-board/shared';
import { ISSUE_STATUS, ISSUE_LEVEL } from '@issue-board/shared';
import { Markdown } from './Markdown';
import { Select } from './Select';
import {
  ISSUE_STATUS_LABEL as STATUS_LABEL,
  ISSUE_PRIORITY_LABEL as LEVEL_LABEL,
} from '../constants';

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
  parentIssue,
  childIssues,
  onSelectIssue,
  onClose,
  onStatusChange,
  onLevelChange,
  onViewPlan,
  onViewScreen,
  onViewDomain,
  onToggleCheckbox,
}: {
  issue: Issue;
  linkedPlan: Plan | null;
  linkedDomain: Domain | null;
  canViewScreen: boolean;
  parentIssue: Issue | null;
  childIssues: Issue[];
  onSelectIssue: (issue: Issue) => void;
  onClose: () => void;
  onStatusChange: (status: IssueStatus) => void;
  onLevelChange: (field: 'value' | 'effort', level: IssueLevel) => void;
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
          <span className="drawer-head-badges">
            <span className={`type-chip type-chip-${issue.type}`}>
              {issue.type === 'epic' ? '에픽' : '일반'}
            </span>
            <span className={`badge prio-badge-${issue.priority}`}>
              {issue.priority}
            </span>
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

        <div className="drawer-row">
          <label>가치</label>
          <Select
            ariaLabel="가치 변경"
            value={issue.value}
            onChange={(v) => onLevelChange('value', v as IssueLevel)}
            options={ISSUE_LEVEL.map((l) => ({ value: l, label: LEVEL_LABEL[l] }))}
          />
        </div>
        <div className="drawer-row">
          <label>노력</label>
          <Select
            ariaLabel="노력 변경"
            value={issue.effort}
            onChange={(v) => onLevelChange('effort', v as IssueLevel)}
            options={ISSUE_LEVEL.map((l) => ({ value: l, label: LEVEL_LABEL[l] }))}
          />
        </div>
        <div className="drawer-row">
          <label>우선순위</label>
          <span className={`prio-chip prio-chip--${issue.priority}`}>
            {LEVEL_LABEL[issue.priority]}
          </span>
          <span className="muted-hint">가치·노력에서 산출</span>
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

        {parentIssue && (
          <div className="issue-rel">
            <div className="issue-rel-title">상위 이슈</div>
            <button
              className="issue-rel-item"
              onClick={() => onSelectIssue(parentIssue)}
            >
              <span className={`type-chip type-chip-${parentIssue.type}`}>
                {parentIssue.type === 'epic' ? '에픽' : '일반'}
              </span>
              <span className="issue-rel-name">{parentIssue.title}</span>
            </button>
          </div>
        )}

        {childIssues.length > 0 && (
          <div className="issue-rel">
            <div className="issue-rel-title">하위 이슈 ({childIssues.length})</div>
            {childIssues.map((c) => (
              <button
                key={c.id}
                className="issue-rel-item"
                onClick={() => onSelectIssue(c)}
              >
                <span className={`status-chip status-chip--${c.status}`}>
                  {STATUS_LABEL[c.status]}
                </span>
                <span className="issue-rel-name">{c.title}</span>
              </button>
            ))}
          </div>
        )}

        <div className="drawer-body">
          <Markdown onCheckboxToggle={onToggleCheckbox}>{issue.body}</Markdown>
        </div>
      </aside>
    </>
  );
}
