import { Injectable, NotFoundException } from '@nestjs/common';
import type { Domain, UpsertDomainDto } from '@issue-board/shared';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { toDomain } from '../common/mappers';

/**
 * 도메인(엔티티/테이블 정의). 편집형 upsert — 프로젝트 내 name 기준으로
 * 재호출 시 갱신한다. 첫 생성은 status="draft"(초안).
 */
@Injectable()
export class DomainsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
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
    const columns = JSON.stringify(dto.columns ?? []);
    const row = await this.prisma.domain.upsert({
      where: { projectId_name: { projectId, name: dto.name } },
      create: {
        projectId,
        name: dto.name,
        description: dto.description ?? null,
        columns,
        status: dto.status ?? 'draft',
      },
      update: {
        description: dto.description ?? null,
        columns,
        ...(dto.status ? { status: dto.status } : {}),
      },
    });
    const domain = toDomain(row);
    this.events.emit({
      type: 'domain:changed',
      projectId,
      entityId: domain.id,
    });
    return domain;
  }

  async remove(id: string): Promise<void> {
    const row = await this.prisma.domain.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Domain ${id} not found`);
    await this.prisma.domain.delete({ where: { id } });
    this.events.emit({
      type: 'domain:changed',
      projectId: row.projectId,
      entityId: id,
    });
  }
}
