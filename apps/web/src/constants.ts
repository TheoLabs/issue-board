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

/**
 * 이슈 포지션 라벨. 저장되는 값은 front/back이고 화면에는 한국어로 보여 준다.
 * 에이전트 규격: agent/skills/ib-shared/issue-spec.md "포지션 분리".
 */
export const POSITIONS = ['front', 'back'] as const;

export const POSITION_LABEL: Record<string, string> = {
  front: '프론트',
  back: '백엔드',
};

/** 라벨 칩·필터에 보여 줄 텍스트. 포지션만 한국어로 바꾸고 나머지는 원문 그대로. */
export const labelText = (label: string): string =>
  POSITION_LABEL[label] ?? label;
