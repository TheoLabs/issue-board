import type {
  Project,
  Plan,
  PlanVersion,
  Issue,
  Wireframe,
  Domain,
  Design,
  DailySummary,
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
};
