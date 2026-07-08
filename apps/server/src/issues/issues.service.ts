import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CreateIssueDto, Issue, UpdateIssueDto } from '@issue-board/shared';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { toIssue } from '../common/mappers';

@Injectable()
export class IssuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
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
    const row = await this.prisma.issue.create({
      data: {
        projectId,
        title: dto.title,
        body: dto.body,
        status: dto.status ?? 'todo',
        priority: dto.priority ?? 'medium',
        labels: JSON.stringify(dto.labels ?? []),
        parentId: dto.parentId ?? null,
        planId: dto.planId ?? null,
        screenId: dto.screenId ?? null,
        domainId: dto.domainId ?? null,
      },
    });
    const issue = toIssue(row);
    this.events.emit({
      type: 'issue:changed',
      projectId,
      entityId: issue.id,
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
    const row = await this.prisma.issue.update({
      where: { id },
      data: {
        title: dto.title,
        body: dto.body,
        status: dto.status,
        priority: dto.priority,
        labels: dto.labels ? JSON.stringify(dto.labels) : undefined,
        parentId: dto.parentId,
        planId: dto.planId,
        screenId: dto.screenId,
        domainId: dto.domainId,
        version: { increment: 1 },
      },
    });
    const issue = toIssue(row);
    this.events.emit({
      type: 'issue:changed',
      projectId: issue.projectId,
      entityId: issue.id,
    });
    return issue;
  }

  async remove(id: string): Promise<void> {
    const row = await this.prisma.issue.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Issue ${id} not found`);
    await this.prisma.issue.delete({ where: { id } });
    this.events.emit({
      type: 'issue:changed',
      projectId: row.projectId,
      entityId: id,
    });
  }
}
