/**
 * Issue Board — web ↔ server 공유 도메인 타입.
 * Prisma 스키마(apps/server/prisma/schema.prisma)와 형태를 맞춘다.
 */

// ─── Enums (SQLite에는 enum이 없어 문자열 유니온으로 표현) ───

export const PLAN_STATUS = ['draft', 'approved', 'archived'] as const;
export type PlanStatus = (typeof PLAN_STATUS)[number];

export const ISSUE_STATUS = ['todo', 'in_progress', 'done', 'blocked'] as const;
export type IssueStatus = (typeof ISSUE_STATUS)[number];

export const ISSUE_PRIORITY = ['low', 'medium', 'high'] as const;
export type IssuePriority = (typeof ISSUE_PRIORITY)[number];

export const WIREFRAME_FORMAT = ['html', 'excalidraw', 'mermaid', 'svg'] as const;
export type WireframeFormat = (typeof WIREFRAME_FORMAT)[number];

export const DOMAIN_STATUS = ['draft', 'approved', 'archived'] as const;
export type DomainStatus = (typeof DOMAIN_STATUS)[number];

// ─── 도메인 엔티티 ───

export interface Project {
  id: string;
  name: string;
  description: string | null;
  /** 외부 Claude 세션이 cwd로 프로젝트를 매칭하기 위한 로컬 경로 */
  repoPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Plan {
  id: string;
  projectId: string;
  title: string;
  /** 마크다운 기획서 본문 (사용자 편집 가능) */
  content: string;
  status: PlanStatus;
  /** 낙관적 잠금용 버전 */
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** 기획 마일스톤 스냅샷 (승인/명시적 저장 시에만 생성) */
export interface PlanVersion {
  id: string;
  planId: string;
  version: number;
  title: string;
  content: string;
  status: PlanStatus;
  /** 스냅샷 사유/이름 (예: "승인", "MVP 범위 확정") */
  label: string | null;
  createdAt: string;
}

export interface Issue {
  id: string;
  projectId: string;
  title: string;
  body: string;
  status: IssueStatus;
  priority: IssuePriority;
  labels: string[];
  parentId: string | null;
  /** 파생된 기획 (연동) */
  planId: string | null;
  /** 관련 와이어프레임 화면 — 클릭스루 프로토타입의 data-screen id (연동) */
  screenId: string | null;
  /** 관련 도메인 (연동) */
  domainId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** 도메인(엔티티/테이블) 정의의 한 컬럼 */
export interface DomainColumn {
  name: string;
  type: string;
  /** PK, FK→User, NN, UQ 등 제약 표기 (자유 문자열) */
  constraints?: string;
  description?: string;
}

/** 생명주기 상태 (엔티티가 가질 수 있는 한 상태) */
export interface DomainState {
  /** 상태명 (예: `pending`, `active`, `closed`). 초기/종료는 transitions의 `[*]`로 표기 */
  name: string;
  description?: string;
}

/** 상태 전이 (from → to, 트리거 이벤트 on) */
export interface DomainTransition {
  /** 출발 상태명. 초기 상태로부터의 진입은 `[*]` */
  from: string;
  /** 도착 상태명. 종료 상태로의 이탈은 `[*]` */
  to: string;
  /** 전이를 유발하는 이벤트/액션 라벨 (예: `승인`, `pay()`) */
  on?: string;
}

/** 엔티티의 상태 생명주기. 대시보드가 mermaid stateDiagram으로 렌더한다 */
export interface DomainLifecycle {
  /** 상태 목록 (설명/순서 보존용, 선택). 생략 시 transitions에서 도출 */
  states?: DomainState[];
  transitions: DomainTransition[];
}

/** 도메인 = 엔티티/테이블 정의. 이름 기준 편집형(upsert). 첫 설계는 draft */
export interface Domain {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  columns: DomainColumn[];
  /** 상태 흐름(생명주기). 상태를 갖는 엔티티만. 없으면 null */
  lifecycle: DomainLifecycle | null;
  status: DomainStatus;
  createdAt: string;
  updatedAt: string;
}

/** 조회 전용 아티팩트 (편집·상호작용 제외). 같은 name의 재생성은 version으로 이력 보존 */
export interface Wireframe {
  id: string;
  projectId: string;
  name: string;
  format: WireframeFormat;
  content: string;
  /** IA(정보구조) 순서. 대시보드 왼쪽 네비가 오름차순 정렬한다. 낮을수록 위 */
  sequence: number;
  version: number;
  createdAt: string;
}

// ─── Create / Update DTO ───

export interface CreateProjectDto {
  name: string;
  description?: string;
  repoPath?: string;
}

export interface CreatePlanDto {
  title: string;
  content: string;
  status?: PlanStatus;
}

export interface UpdatePlanDto {
  title?: string;
  content?: string;
  status?: PlanStatus;
}

export interface CreateIssueDto {
  title: string;
  body: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  labels?: string[];
  parentId?: string | null;
  planId?: string | null;
  screenId?: string | null;
  domainId?: string | null;
}

export interface UpdateIssueDto {
  title?: string;
  body?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  labels?: string[];
  parentId?: string | null;
  planId?: string | null;
  screenId?: string | null;
  domainId?: string | null;
}

export interface CreateWireframeDto {
  name: string;
  format?: WireframeFormat;
  content: string;
  /** IA 순서(낮을수록 위). 생략 시 같은 name의 기존 순서를 잇고, 없으면 맨 뒤 */
  sequence?: number;
}

/** 도메인 upsert (프로젝트 내 name 기준). 재호출 시 갱신 */
export interface UpsertDomainDto {
  name: string;
  description?: string;
  columns: DomainColumn[];
  /** 상태 흐름(생명주기). 상태를 갖는 엔티티만 */
  lifecycle?: DomainLifecycle | null;
  status?: DomainStatus;
}

// ─── SSE 이벤트 ───

export type BoardEventType =
  | 'project:updated'
  | 'plan:changed'
  | 'issue:changed'
  | 'wireframe:changed'
  | 'domain:changed';

export interface BoardEvent {
  type: BoardEventType;
  projectId: string;
  /** 변경 대상 엔티티 id (있는 경우) */
  entityId?: string;
}
