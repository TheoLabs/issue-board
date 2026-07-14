import { useRef, useState } from 'react';
import type { Issue, IssueStatus } from '@issue-board/shared';
import { ISSUE_STATUS } from '@issue-board/shared';
import { ISSUE_STATUS_LABEL as STATUS_LABEL } from '../constants';

/**
 * 상태별 칸반 컬럼.
 * - 카드 클릭 → 상세 드로어
 * - 카드를 다른 컬럼으로 드래그 → 상태 변경 (HTML5 네이티브 DnD)
 */
export function IssueBoard({
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
  const dragged = useRef<Issue | null>(null);
  const draggingRef = useRef(false); // 드래그 진행 중 여부
  const suppressClickUntil = useRef(0); // 드래그 종료 직후 뒤따르는 click 억제(ms 타임스탬프)
  const [dragOver, setDragOver] = useState<IssueStatus | null>(null);

  return (
    <div className="kanban">
      {ISSUE_STATUS.map((status) => {
        const column = issues.filter((i) => i.status === status);
        return (
          <div
            className={`kanban-col${dragOver === status ? ' drag-over' : ''}`}
            key={status}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragOver !== status) setDragOver(status);
            }}
            onDragLeave={(e) => {
              // 컬럼 밖으로 완전히 나갔을 때만 해제
              if (!e.currentTarget.contains(e.relatedTarget as Node))
                setDragOver((s) => (s === status ? null : s));
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(null);
              const issue = dragged.current;
              dragged.current = null;
              if (issue && issue.status !== status) onMove(issue, status);
            }}
          >
            <h3>
              {STATUS_LABEL[status]} <span className="count">{column.length}</span>
            </h3>
            {column.map((issue) => (
              <div
                key={issue.id}
                className={`issue-card prio-${issue.priority}${
                  selectedId === issue.id ? ' selected' : ''
                }`}
                draggable
                onDragStart={() => {
                  dragged.current = issue;
                  draggingRef.current = true;
                }}
                onDragEnd={() => {
                  dragged.current = null;
                  setDragOver(null);
                  draggingRef.current = false;
                  // 일부 브라우저는 native DnD 종료 직후 click을 발생시켜 상세가 열림.
                  // 드롭 지점 아래에 있던 다른 카드로 click이 전달되는 경우까지 막기 위해 잠시 억제.
                  suppressClickUntil.current = Date.now() + 300;
                }}
                onClick={() => {
                  // 드래그 중이거나 드래그 종료 직후 뒤따르는 click은 무시 (드로어 열림 방지)
                  if (draggingRef.current || Date.now() < suppressClickUntil.current) return;
                  onSelect(issue);
                }}
                title="클릭: 상세 보기 · 드래그: 상태 이동"
                role="button"
                tabIndex={0}
              >
                <span className="issue-title">
                  <span className={`type-chip type-chip-${issue.type}`}>
                    {issue.type === 'epic' ? '에픽' : '일반'}
                  </span>
                  {issue.title}
                </span>
                <span className="issue-meta">
                  {issue.labels.map((l) => (
                    <span className="label" key={l}>
                      {l}
                    </span>
                  ))}
                  {issue.planId && <span className="link-dot" title="기획 연동">📋</span>}
                  {issue.domainId && (
                    <span className="link-dot" title="도메인 연동">🗂️</span>
                  )}
                  {issue.screenId && (
                    <span className="link-dot" title="화면 연동">🖼️</span>
                  )}
                </span>
              </div>
            ))}
            {column.length === 0 && <p className="empty">—</p>}
          </div>
        );
      })}
    </div>
  );
}
