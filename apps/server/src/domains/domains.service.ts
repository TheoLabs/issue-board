import { Injectable, NotFoundException } from '@nestjs/common';
import type { Domain, UpsertDomainDto } from '@issue-board/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { toDomain } from '../common/mappers';

/**
 * 도메인(엔티티/테이블 정의). 편집형 upsert — 프로젝트 내 name 기준으로
 * 재호출 시 갱신한다. 첫 생성은 status="draft"(초안).
 */
@Injectable()
export class DomainsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async listByProject(projectId: string): Promise<Domain[]> {
    const rows = await this.prisma.domain.findMany({
      where: { projectId },
      orderBy: { name: 'asc' },
    });
    return rows.map(toDomain);
  }

  async get(id: string): Promise<Domain> {
    const row = await this.prisma.domain.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Domain ${id} not found`);
    return toDomain(row);
  }

  /** name 기준 upsert. 기존 있으면 갱신(status는 명시된 경우만 변경). */
  async upsert(projectId: string, dto: UpsertDomainDto): Promise<Domain> {
    const existing = await this.prisma.domain.findUnique({
      where: { projectId_name: { projectId, name: dto.name } },
      select: { id: true },
    });
    const columns = JSON.stringify(dto.columns ?? []);
    // lifecycle: 미지정(undefined)이면 갱신 시 기존값 유지, 명시적 null이면 제거.
    const lifecycle =
      dto.lifecycle === undefined
        ? undefined
        : dto.lifecycle === null
          ? null
          : JSON.stringify(dto.lifecycle);
    const row = await this.prisma.domain.upsert({
      where: { projectId_name: { projectId, name: dto.name } },
      create: {
        projectId,
        name: dto.name,
        description: dto.description ?? null,
        columns,
        lifecycle: lifecycle ?? null,
        status: dto.status ?? 'draft',
      },
      update: {
        description: dto.description ?? null,
        columns,
        ...(lifecycle !== undefined ? { lifecycle } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
    });
    const domain = toDomain(row);
    await this.activity.record({
      projectId,
      entityType: 'domain',
      entityId: domain.id,
      action: existing ? 'updated' : 'created',
      title: domain.name,
    });
    return domain;
  }

  async remove(id: string): Promise<void> {
    const row = await this.prisma.domain.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Domain ${id} not found`);
    await this.prisma.domain.delete({ where: { id } });
    await this.activity.record({
      projectId: row.projectId,
      entityType: 'domain',
      entityId: id,
      action: 'deleted',
      title: row.name,
    });
  }
}
