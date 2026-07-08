import type { IssueStatus, IssuePriority } from '@issue-board/shared';

/** 이슈 상태 한국어 라벨 (칸반·테이블·드로어·필터 공통) */
export const ISSUE_STATUS_LABEL: Record<IssueStatus, string> = {
  todo: '할 일',
  in_progress: '진행 중',
  done: '완료',
  blocked: '보류',
};

/** 이슈 우선순위 한국어 라벨 */
export const ISSUE_PRIORITY_LABEL: Record<IssuePriority, string> = {
  low: '낮음',
  medium: '보통',
  high: '높음',
};
