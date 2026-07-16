import { useState } from 'react';
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
 * - 에픽 행: 클릭 시 상세 + 하위 이슈가 트리로 확장(들여쓰기). ▸ 토글로 접기/펼치기.
 * - 상태 셀 select로 상태 변경 (칸반의 드래그와 동일한 onMove)
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const presentIds = new Set(issues.map((i) => i.id));
  // 루트 = 부모가 없거나, 부모가 현재(필터된) 목록에 없는 이슈
  const roots = issues.filter(
    (i) => !i.parentId || !presentIds.has(i.parentId),
  );
  const childrenOf = (id: string) => issues.filter((i) => i.parentId === id);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const renderRow = (issue: Issue, isChild: boolean) => {
    const kids = childrenOf(issue.id);
    const isEpic = issue.type === 'epic';
    const isOpen = expanded.has(issue.id);
    return (
      <tr
        key={issue.id}
        className={`${selectedId === issue.id ? 'selected' : ''}${
          isChild ? ' child-row' : ''
        }`}
        onClick={() => {
          onSelect(issue);
          if (isEpic && kids.length) setExpanded((p) => new Set(p).add(issue.id));
        }}
      >
        <td className="col-name">
          <span className={`issue-tree-cell${isChild ? ' indent' : ''}`}>
            {isEpic && kids.length > 0 ? (
              <button
                className={`tree-toggle${isOpen ? ' open' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(issue.id);
                }}
                title={isOpen ? '접기' : '펼치기'}
              >
                ▸
              </button>
            ) : (
              <span className="tree-toggle-spacer" />
            )}
            {issue.key && <span className="issue-key">{issue.key}</span>}
            <span className={`type-chip type-chip-${issue.type}`}>
              {isEpic ? '에픽' : '일반'}
            </span>
            <span className="issue-tree-title">{issue.title}</span>
            {isEpic && kids.length > 0 && (
              <span className="issue-tree-count">{kids.length}</span>
            )}
          </span>
        </td>
        <td>
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
    );
  };

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
          {roots.flatMap((root) => {
            const rows = [renderRow(root, false)];
            if (root.type === 'epic' && expanded.has(root.id)) {
              for (const child of childrenOf(root.id)) {
                rows.push(renderRow(child, true));
              }
            }
            return rows;
          })}
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
