import type {
  Project as PrismaProject,
  Plan as PrismaPlan,
  PlanVersion as PrismaPlanVersion,
  Issue as PrismaIssue,
  Wireframe as PrismaWireframe,
  Domain as PrismaDomain,
} from '@prisma/client';
import type {
  Project,
  Plan,
  PlanVersion,
  Issue,
  Wireframe,
  Domain,
  DomainColumn,
  IssueStatus,
  IssuePriority,
  PlanStatus,
  WireframeFormat,
  DomainStatus,
} from '@issue-board/shared';

const iso = (d: Date): string => d.toISOString();

export function toProject(row: PrismaProject): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    repoPath: row.repoPath,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function toPlan(row: PrismaPlan): Plan {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    content: row.content,
    status: row.status as PlanStatus,
    version: row.version,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function toPlanVersion(row: PrismaPlanVersion): PlanVersion {
  return {
    id: row.id,
    planId: row.planId,
    version: row.version,
    title: row.title,
    content: row.content,
    status: row.status as PlanStatus,
    label: row.label,
    createdAt: iso(row.createdAt),
  };
}

export function toIssue(row: PrismaIssue): Issue {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    body: row.body,
    status: row.status as IssueStatus,
    priority: row.priority as IssuePriority,
    labels: parseLabels(row.labels),
    parentId: row.parentId,
    planId: row.planId,
    screenId: row.screenId,
    domainId: row.domainId,
    version: row.version,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function toDomain(row: PrismaDomain): Domain {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    description: row.description,
    columns: parseColumns(row.columns),
    status: row.status as DomainStatus,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function toWireframe(row: PrismaWireframe): Wireframe {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    format: row.format as WireframeFormat,
    content: row.content,
    version: row.version,
    createdAt: iso(row.createdAt),
  };
}

function parseLabels(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseColumns(raw: string): DomainColumn[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((c): DomainColumn => ({
      name: String(c?.name ?? ''),
      type: String(c?.type ?? ''),
      constraints: c?.constraints ? String(c.constraints) : undefined,
      description: c?.description ? String(c.description) : undefined,
    }));
  } catch {
    return [];
  }
}
