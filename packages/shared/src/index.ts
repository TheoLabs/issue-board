/**
 * Issue Board — web ↔ server 공유 도메인 타입.
 * Prisma 스키마(apps/server/prisma/schema.prisma)와 형태를 맞춘다.
 */

// ─── Enums (SQLite에는 enum이 없어 문자열 유니온으로 표현) ───

export const PLAN_STATUS = ['draft', 'approved', 'archived'] as const;
export type PlanStatus = (typeof PLAN_STATUS)[number];

export const ISSUE_STATUS = ['todo', 'in_progress', 'done', 'blocked'] as const;
export type IssueStatus = (typeof ISSUE_STATUS)[number];

export const ISSUE_TYPE = ['epic', 'task'] as const;
export type IssueType = (typeof ISSUE_TYPE)[number];

export const ISSUE_PRIORITY = ['low', 'medium', 'high'] as const;
export type IssuePriority = (typeof ISSUE_PRIORITY)[number];

/** 가치·노력 레벨 (우선순위 산출 입력) */
export const ISSUE_LEVEL = ['low', 'medium', 'high'] as const;
export type IssueLevel = (typeof ISSUE_LEVEL)[number];

/**
 * Value/Effort 매트릭스로 우선순위를 산출한다 (단일 기준).
 *          노력 low   med    high
 * 가치 high: high  high   medium
 * 가치 med:  high  medium low
 * 가치 low:  medium low    low
 */
export function derivePriority(
  value: IssueLevel,
  effort: IssueLevel,
): IssuePriority {
  const m: Record<IssueLevel, Record<IssueLevel, IssuePriority>> = {
    high: { low: 'high', medium: 'high', high: 'medium' },
    medium: { low: 'high', medium: 'medium', high: 'low' },
    low: { low: 'medium', medium: 'low', high: 'low' },
  };
  return m[value][effort];
}

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
  /** 에픽(상위) vs 태스크(하위) */
  type: IssueType;
  status: IssueStatus;
  /** value/effort에서 산출됨 */
  priority: IssuePriority;
  /** 가치 (우선순위 산출 입력) */
  value: IssueLevel;
  /** 노력 (우선순위 산출 입력) */
  effort: IssueLevel;
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

// ─── 디자인 시스템 ───

/** 브랜드 색 (메인/서브 + 변형) */
export interface DesignBrand {
  main: string;
  mainHover: string;
  mainSoft: string;
  sub: string;
  subSoft: string;
}

/** 뉴트럴(그레이) 스케일 */
export interface DesignNeutral {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  muted: string;
}

/** 시맨틱 색 */
export interface DesignSemantic {
  success: string;
  warning: string;
  danger: string;
  info: string;
}

/** 타입 스케일 한 단계 */
export interface DesignTypeStep {
  name: string;
  size: number;
  weight: number;
  lineHeight: number;
}

/** 디자인 토큰 전체 */
export interface DesignTokens {
  brand: DesignBrand;
  neutral: DesignNeutral;
  semantic: DesignSemantic;
  fontHeading: string;
  fontBody: string;
  typeScale: DesignTypeStep[];
  spacing: number[];
  radius: { sm: number; md: number; lg: number; full: number };
  /** 무드/톤 가이드 (예: "미니멀·모던") */
  mood?: string;
}

/** 프로젝트당 하나의 디자인 시스템 (upsert) */
export interface Design {
  id: string;
  projectId: string;
  tokens: DesignTokens;
  status: DomainStatus;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertDesignDto {
  tokens: DesignTokens;
  status?: DomainStatus;
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
  type?: IssueType;
  status?: IssueStatus;
  priority?: IssuePriority;
  value?: IssueLevel;
  effort?: IssueLevel;
  labels?: string[];
  parentId?: string | null;
  planId?: string | null;
  screenId?: string | null;
  domainId?: string | null;
}

export interface UpdateIssueDto {
  title?: string;
  body?: string;
  type?: IssueType;
  status?: IssueStatus;
  priority?: IssuePriority;
  value?: IssueLevel;
  effort?: IssueLevel;
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

// ─── 활동 로그 / 일일 요약 ───

/** 활동이 일어난 엔티티 종류 */
export const ACTIVITY_ENTITY = [
  'project',
  'plan',
  'issue',
  'domain',
  'wireframe',
  'design',
] as const;
export type ActivityEntity = (typeof ACTIVITY_ENTITY)[number];

/** 활동의 성격 */
export const ACTIVITY_ACTION = [
  'created',
  'updated',
  'status_changed',
  'snapshot',
  'linked',
  'deleted',
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTION)[number];

/** 활동 주체: user=웹 대시보드, agent=MCP(Claude/스킬) */
export const ACTIVITY_SOURCE = ['user', 'agent'] as const;
export type ActivitySource = (typeof ACTIVITY_SOURCE)[number];

/** 한 필드의 변경 (before → after) */
export interface FieldChange {
  from: string | null;
  to: string | null;
}

/** 이슈보드에서 일어난 하나의 변경 기록 (감사/일일요약의 원자 단위) */
export interface Activity {
  id: string;
  projectId: string;
  entityType: ActivityEntity;
  entityId: string;
  action: ActivityAction;
  /** 사람이 읽을 대상 이름/제목 (예: 이슈 제목, 도메인 이름) */
  title: string;
  /** 무엇이 어떻게 바뀌었나. { status: { from, to } } 형태. 없으면 null */
  changes: Record<string, FieldChange> | null;
  source: ActivitySource;
  createdAt: string;
}

/** 하루치 업무 요약 (특정 프로젝트·특정 날짜) */
export interface DailySummary {
  projectId: string;
  /** 요청 타임존 기준 대상 날짜 (YYYY-MM-DD) */
  date: string;
  timezone: string;
  /** 집계 구간 (UTC ISO) */
  from: string;
  to: string;
  total: number;
  byEntity: Record<ActivityEntity, number>;
  byAction: Record<ActivityAction, number>;
  bySource: Record<ActivitySource, number>;
  /** 최신순 활동 목록 */
  activities: Activity[];
}

/** 일일 요약 생성 상태 */
export const DAILY_REPORT_STATUS = ['pending', 'ready', 'error'] as const;
export type DailyReportStatus = (typeof DAILY_REPORT_STATUS)[number];

/**
 * Claude(CLI)가 그날의 활동 스냅샷을 읽어 서술한 일일 업무 요약(저장본).
 * 규칙 기반 렌더(renderDailyReport)와 달리 LLM이 "무슨 작업이 이뤄졌는지"를 서술한다.
 */
export interface DailyReport {
  projectId: string;
  /** 대상 날짜 (요청 타임존 기준 YYYY-MM-DD) */
  date: string;
  timezone: string;
  /** 서술형 마크다운 본문 (status=ready일 때만 유효) */
  content: string;
  /** 사용 모델 (CLI 기본값이면 null일 수 있음) */
  model: string | null;
  status: DailyReportStatus;
  /** status=error일 때 원인 */
  error: string | null;
  /** 요약 시점 활동 건수 */
  activityCount: number;
  /** manual(버튼) | schedule(cron) */
  createdBy: string;
  /** 생성/갱신 시각 (UTC ISO) */
  updatedAt: string;
}

/** 활동이 있었던 하루 (날짜 목록용). 최신 날짜가 먼저. */
export interface DailyCount {
  /** 타임존 기준 날짜 (YYYY-MM-DD) */
  date: string;
  /** 그날 활동 건수 */
  total: number;
}

/** 주간 이슈 추이 한 점 (번다운·속도 차트용). 오름차순. */
export interface WeeklyActivityPoint {
  /** 그 주의 시작일(월요일, YYYY-MM-DD, tz 기준) */
  weekStart: string;
  /** 그 주에 생성된 이슈 수 */
  created: number;
  /** 그 주에 done으로 전이된 이슈 수 */
  done: number;
}

// ─── SSE 이벤트 ───

export type BoardEventType =
  | 'project:updated'
  | 'plan:changed'
  | 'issue:changed'
  | 'wireframe:changed'
  | 'domain:changed'
  | 'design:changed';

export interface BoardEvent {
  type: BoardEventType;
  projectId: string;
  /** 변경 대상 엔티티 id (있는 경우) */
  entityId?: string;
}
