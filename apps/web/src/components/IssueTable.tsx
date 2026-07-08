import type { Issue, IssueStatus } from '@issue-board/shared';
import { ISSUE_STATUS } from '@issue-board/shared';
import { Select } from './Select';
import {
  ISSUE_STATUS_LABEL as STATUS_LABEL,
  ISSUE_PRIORITY_LABEL as PRIO_LABEL,
} from '../constants';

/** 이슈 상태 → 드롭다운 트리거 색 tone */
const STATUS_TONE: Record<IssueStatus, string> = {
  todo: 'tone-neutral',
  in_progress: 'tone-blue',
  done: 'tone-green',
  blocked: 'tone-red',
};

/**
 * 이슈를 테이블로 렌더 (칸반의 대체 뷰).
 * - 행 클릭 → 상세 드로어
 * - 상태 셀의 select로 상태 변경 (칸반의 드래그와 동일한 onMove)
 */
export function IssueTable({
  issues,
  onSelect,
  onMove,
  selectedId,
}: {
  issues: Issue[];
  onSelect: (issue: Issue) => void;
  onMove: (issue: Issue, status: IssueStatus) => void;
  selectedId?: string | null;
}) {
  return (
    <div className="table-scroll">
      <table className="list-table issue-list-table">
        <thead>
          <tr>
            <th>제목</th>
            <th>상태</th>
            <th>우선순위</th>
            <th>라벨</th>
            <th>연동</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <tr
              key={issue.id}
              className={selectedId === issue.id ? 'selected' : ''}
              onClick={() => onSelect(issue)}
            >
              <td className="col-name">{issue.title}</td>
              <td>
                {/* 드롭다운 내부 클릭은 Select가 stopPropagation → 행 클릭 억제 */}
                <Select
                  ariaLabel="상태 변경"
                  minWidth={96}
                  triggerClassName={STATUS_TONE[issue.status]}
                  value={issue.status}
                  onChange={(v) => onMove(issue, v as IssueStatus)}
                  options={ISSUE_STATUS.map((s) => ({
                    value: s,
                    label: STATUS_LABEL[s],
                  }))}
                />
              </td>
              <td>
                <span className={`prio-chip prio-chip--${issue.priority}`}>
                  {PRIO_LABEL[issue.priority]}
                </span>
              </td>
              <td>
                <span className="issue-meta">
                  {issue.labels.map((l) => (
                    <span className="label" key={l}>
                      {l}
                    </span>
                  ))}
                </span>
              </td>
              <td>
                <span className="issue-meta">
                  {issue.planId && (
                    <span className="link-dot" title="기획 연동">
                      📋
                    </span>
                  )}
                  {issue.domainId && (
                    <span className="link-dot" title="도메인 연동">
                      🗂️
                    </span>
                  )}
                  {issue.screenId && (
                    <span className="link-dot" title="화면 연동">
                      🖼️
                    </span>
                  )}
                </span>
              </td>
            </tr>
          ))}
          {issues.length === 0 && (
            <tr>
              <td colSpan={5} className="empty">
                이슈가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
