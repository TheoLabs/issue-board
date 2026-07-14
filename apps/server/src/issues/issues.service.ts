import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateIssueDto,
  Issue,
  UpdateIssueDto,
  IssueLevel,
} from '@issue-board/shared';
import { derivePriority } from '@issue-board/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { toIssue } from '../common/mappers';

@Injectable()
export class IssuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async listByProject(projectId: string): Promise<Issue[]> {
    const rows = await this.prisma.issue.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toIssue);
  }

  async get(id: string): Promise<Issue> {
    const row = await this.prisma.issue.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Issue ${id} not found`);
    return toIssue(row);
  }

  async create(projectId: string, dto: CreateIssueDto): Promise<Issue> {
    const value = dto.value ?? 'medium';
    const effort = dto.effort ?? 'medium';
    // 우선순위는 value/effort에서 산출. 둘 다 없고 priority만 주면 그대로 존중.
    const priority =
      dto.value || dto.effort
        ? derivePriority(value, effort)
        : (dto.priority ?? derivePriority(value, effort));
    const row = await this.prisma.issue.create({
      data: {
        projectId,
        title: dto.title,
        body: dto.body,
        type: dto.type ?? 'task',
        status: dto.status ?? 'todo',
        value,
        effort,
        priority,
        labels: JSON.stringify(dto.labels ?? []),
        parentId: dto.parentId ?? null,
        planId: dto.planId ?? null,
        screenId: dto.screenId ?? null,
        domainId: dto.domainId ?? null,
      },
    });
    const issue = toIssue(row);
    await this.activity.record({
      projectId,
      entityType: 'issue',
      entityId: issue.id,
      action: 'created',
      title: issue.title,
    });
    return issue;
  }

  async update(
    id: string,
    dto: UpdateIssueDto,
    expectedVersion?: number,
  ): Promise<Issue> {
    const current = await this.prisma.issue.findUnique({ where: { id } });
    if (!current) throw new NotFoundException(`Issue ${id} not found`);
    if (expectedVersion !== undefined && current.version !== expectedVersion) {
      throw new ConflictException(
        `Version conflict: expected ${expectedVersion}, got ${current.version}`,
      );
    }
    // value/effort가 바뀌면 우선순위 재산출 (명시 priority가 오면 그걸 우선)
    let priority = dto.priority;
    if (dto.value !== undefined || dto.effort !== undefined) {
      const value = (dto.value ?? current.value) as IssueLevel;
      const effort = (dto.effort ?? current.effort) as IssueLevel;
      priority = dto.priority ?? derivePriority(value, effort);
    }
    const row = await this.prisma.issue.update({
      where: { id },
      data: {
        title: dto.title,
        body: dto.body,
        type: dto.type,
        status: dto.status,
        value: dto.value,
        effort: dto.effort,
        priority,
        labels: dto.labels ? JSON.stringify(dto.labels) : undefined,
        parentId: dto.parentId,
        planId: dto.planId,
        screenId: dto.screenId,
        domainId: dto.domainId,
        version: { increment: 1 },
      },
    });
    const issue = toIssue(row);
    // 상태 전이 / 링크 보강 / 일반 수정을 구분해 기록한다.
    const statusChanged = current.status !== row.status;
    const onlyLinks =
      !statusChanged &&
      dto.title === undefined &&
      dto.body === undefined &&
      dto.type === undefined &&
      dto.value === undefined &&
      dto.effort === undefined &&
      dto.labels === undefined &&
      dto.parentId === undefined &&
      (dto.planId !== undefined ||
        dto.screenId !== undefined ||
        dto.domainId !== undefined);
    await this.activity.record({
      projectId: issue.projectId,
      entityType: 'issue',
      entityId: issue.id,
      action: statusChanged
        ? 'status_changed'
        : onlyLinks
          ? 'linked'
          : 'updated',
      title: issue.title,
      changes: statusChanged
        ? { status: { from: current.status, to: row.status } }
        : null,
    });
    return issue;
  }

  async remove(id: string): Promise<void> {
    const row = await this.prisma.issue.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Issue ${id} not found`);
    await this.prisma.issue.delete({ where: { id } });
    await this.activity.record({
      projectId: row.projectId,
      entityType: 'issue',
      entityId: id,
      action: 'deleted',
      title: row.title,
    });
  }
}
