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
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { toIssue } from '../common/mappers';
import { derivePrefix, formatKey, isIssueKey } from '../common/issue-key';

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
    const rid = await this.resolveId(id);
    const row = await this.prisma.issue.findUnique({ where: { id: rid } });
    if (!row) throw new NotFoundException(`Issue ${id} not found`);
    return toIssue(row);
  }

  /**
   * cuid 또는 사람 이슈 키(CH-12)를 실제 issue id(cuid)로 해석한다.
   * cuid면 그대로 통과. 키가 여러 프로젝트에 겹치면 정확한 id를 요구한다.
   */
  async resolveId(ref: string, projectId?: string): Promise<string> {
    if (!isIssueKey(ref)) return ref;
    const matches = await this.prisma.issue.findMany({
      where: projectId ? { projectId, key: ref } : { key: ref },
      select: { id: true },
      take: 2,
    });
    if (matches.length === 0)
      throw new NotFoundException(`이슈 키 ${ref}를 찾을 수 없습니다`);
    if (matches.length > 1)
      throw new ConflictException(
        `이슈 키 ${ref}가 여러 프로젝트에 존재합니다. 정확한 이슈 id를 사용하세요.`,
      );
    return matches[0].id;
  }

  async create(projectId: string, dto: CreateIssueDto): Promise<Issue> {
    const value = dto.value ?? 'medium';
    const effort = dto.effort ?? 'medium';
    // 우선순위는 value/effort에서 산출. 둘 다 없고 priority만 주면 그대로 존중.
    const priority =
      dto.value || dto.effort
        ? derivePriority(value, effort)
        : (dto.priority ?? derivePriority(value, effort));
    // 부모가 키(CH-12)로 오면 실제 id로 해석한다.
    const parentId = dto.parentId
      ? await this.resolveId(dto.parentId, projectId)
      : null;

    // 앱 확보 + 앱별 순번 채번 + 이슈 생성을 한 트랜잭션에서 원자적으로.
    const row = await this.prisma.$transaction(async (tx) => {
      // 소프트 필수: applicationId가 없으면 프로젝트 기본 앱에 배정한다.
      const appId =
        dto.applicationId ?? (await this.ensureDefaultApp(tx, projectId)).id;
      // 카운터를 원자적으로 증가시켜 이 이슈의 number를 얻는다.
      const app = await tx.application.update({
        where: { id: appId },
        data: { issueSeq: { increment: 1 } },
      });
      // 접두사가 없는 앱(구 데이터 등)이면 즉석에서 도출해 저장한다.
      let prefix = app.issuePrefix;
      if (!prefix) {
        prefix = derivePrefix(
          app.name,
          await this.takenPrefixes(tx, projectId, appId),
        );
        await tx.application.update({
          where: { id: appId },
          data: { issuePrefix: prefix },
        });
      }
      const number = app.issueSeq;
      return tx.issue.create({
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
          parentId,
          planId: dto.planId ?? null,
          screenId: dto.screenId ?? null,
          domainId: dto.domainId ?? null,
          applicationId: appId,
          number,
          key: formatKey(prefix, number),
        },
      });
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

  /** 프로젝트의 기본 앱(가장 앞 순서)을 반환. 없으면 하나 만든다. */
  private async ensureDefaultApp(
    tx: Prisma.TransactionClient,
    projectId: string,
  ) {
    const existing = await tx.application.findFirst({
      where: { projectId },
      orderBy: [{ sequence: 'asc' }, { createdAt: 'asc' }],
    });
    if (existing) return existing;
    const project = await tx.project.findUnique({ where: { id: projectId } });
    const name = project?.name ?? 'App';
    return tx.application.create({
      data: {
        projectId,
        key: 'default',
        name,
        description: null,
        sequence: 0,
        issuePrefix: derivePrefix(name),
      },
    });
  }

  /** 프로젝트 내 다른 앱들이 이미 쓰는 접두사 집합 (유일성 도출용). */
  private async takenPrefixes(
    tx: Prisma.TransactionClient,
    projectId: string,
    exceptId: string,
  ): Promise<Set<string>> {
    const apps = await tx.application.findMany({
      where: { projectId, NOT: { id: exceptId } },
      select: { issuePrefix: true },
    });
    return new Set(
      apps
        .map((a) => a.issuePrefix)
        .filter((p): p is string => Boolean(p)),
    );
  }

  async update(
    id: string,
    dto: UpdateIssueDto,
    expectedVersion?: number,
  ): Promise<Issue> {
    id = await this.resolveId(id);
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
        applicationId: dto.applicationId,
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
    id = await this.resolveId(id);
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
