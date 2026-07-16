import type {
  Project,
  Application,
  Plan,
  PlanVersion,
  Issue,
  Wireframe,
  Domain,
  Design,
  DailySummary,
  DailyReport,
  DailyCount,
  WeeklyActivityPoint,
  DailyActivityPoint,
  UpdateIssueDto,
  UpdatePlanDto,
} from '@issue-board/shared';

const BASE = '/api';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    // init.headers(예: If-Match)를 병합하되 Content-Type이 덮이지 않도록 마지막에 둔다
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  listProjects: () => req<Project[]>('/projects'),
  getProject: (id: string) => req<Project>(`/projects/${id}`),

  listApplications: (projectId: string) =>
    req<Application[]>(`/projects/${projectId}/applications`),

  listPlans: (projectId: string) =>
    req<Plan[]>(`/projects/${projectId}/plans`),
  listPlanVersions: (planId: string) =>
    req<PlanVersion[]>(`/plans/${planId}/versions`),
  updatePlan: (id: string, dto: UpdatePlanDto, version: number) =>
    req<Plan>(`/plans/${id}`, {
      method: 'PATCH',
      headers: { 'If-Match': String(version) },
      body: JSON.stringify(dto),
    }),
  snapshotPlan: (id: string, label?: string) =>
    req<Plan>(`/plans/${id}/snapshot`, {
      method: 'POST',
      body: JSON.stringify({ label }),
    }),
  listIssues: (projectId: string) =>
    req<Issue[]>(`/projects/${projectId}/issues`),
  listWireframes: (projectId: string) =>
    req<Wireframe[]>(`/projects/${projectId}/wireframes`),
  deleteWireframe: (id: string) =>
    req<void>(`/wireframes/${id}`, { method: 'DELETE' }),
  listDomains: (projectId: string) =>
    req<Domain[]>(`/projects/${projectId}/domains`),
  getDesign: async (projectId: string): Promise<Design | null> => {
    const res = await fetch(`${BASE}/projects/${projectId}/design`);
    if (!res.ok) return null;
    const text = await res.text();
    return text ? (JSON.parse(text) as Design) : null;
  },
  deleteDomain: (id: string) => req<void>(`/domains/${id}`, { method: 'DELETE' }),

  updateIssue: (id: string, dto: UpdateIssueDto, version: number) =>
    req<Issue>(`/issues/${id}`, {
      method: 'PATCH',
      headers: { 'If-Match': String(version) },
      body: JSON.stringify(dto),
    }),

  /** 하루치 업무 요약. date 생략 시 서버 tz(기본 Asia/Seoul) 기준 오늘 */
  getDailySummary: (projectId: string, date?: string) =>
    req<DailySummary>(
      `/projects/${projectId}/activity/daily${date ? `?date=${date}` : ''}`,
    ),

  /** 활동이 있었던 날짜 목록(최신순, 날짜별 건수) */
  listActivityDays: (projectId: string) =>
    req<DailyCount[]>(`/projects/${projectId}/activity/days`),

  /** Claude가 생성해 저장한 서술형 일일 요약(저장본). 없으면 null. */
  getDailyReport: async (
    projectId: string,
    date?: string,
  ): Promise<DailyReport | null> => {
    const res = await fetch(
      `${BASE}/projects/${projectId}/activity/daily/report${date ? `?date=${date}` : ''}`,
    );
    if (!res.ok) return null;
    const text = await res.text();
    return text ? (JSON.parse(text) as DailyReport) : null;
  },

  /** 그날의 활동 스냅샷으로 Claude(CLI)를 호출해 요약을 생성/재생성한다. */
  generateDailyReport: (projectId: string, date?: string) =>
    req<DailyReport>(
      `/projects/${projectId}/activity/daily/report${date ? `?date=${date}` : ''}`,
      { method: 'POST' },
    ),

  /** 주간 이슈 추이(생성 vs 완료). 번다운·속도 차트용. */
  getActivityTrend: (projectId: string, weeks = 12, applicationId?: string) =>
    req<WeeklyActivityPoint[]>(
      `/projects/${projectId}/activity/trend?weeks=${weeks}${
        applicationId ? `&applicationId=${applicationId}` : ''
      }`,
    ),
  getActivityDailyTrend: (
    projectId: string,
    days = 7,
    applicationId?: string,
  ) =>
    req<DailyActivityPoint[]>(
      `/projects/${projectId}/activity/trend/daily?days=${days}${
        applicationId ? `&applicationId=${applicationId}` : ''
      }`,
    ),
};
