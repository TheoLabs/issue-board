import { Injectable, NotFoundException } from '@nestjs/common';
import type { Design, UpsertDesignDto } from '@issue-board/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { toDesign } from '../common/mappers';

/**
 * 디자인 시스템 — 프로젝트당 하나. 이름 없이 projectId 기준 upsert.
 * ib-design이 메인 컬러에서 도출한 전체 토큰을 저장한다.
 */
@Injectable()
export class DesignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async getByProject(projectId: string): Promise<Design | null> {
    const row = await this.prisma.design.findUnique({ where: { projectId } });
    return row ? toDesign(row) : null;
  }

  async get(id: string): Promise<Design> {
    const row = await this.prisma.design.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Design ${id} not found`);
    return toDesign(row);
  }

  async upsert(projectId: string, dto: UpsertDesignDto): Promise<Design> {
    const existing = await this.prisma.design.findUnique({
      where: { projectId },
      select: { id: true },
    });
    const tokens = JSON.stringify(dto.tokens ?? {});
    const row = await this.prisma.design.upsert({
      where: { projectId },
      create: { projectId, tokens, status: dto.status ?? 'draft' },
      update: { tokens, ...(dto.status ? { status: dto.status } : {}) },
    });
    const design = toDesign(row);
    await this.activity.record({
      projectId,
      entityType: 'design',
      entityId: design.id,
      action: existing ? 'updated' : 'created',
      title: '디자인 시스템',
    });
    return design;
  }

  async remove(projectId: string): Promise<void> {
    const row = await this.prisma.design.findUnique({ where: { projectId } });
    if (!row) return;
    await this.prisma.design.delete({ where: { projectId } });
    await this.activity.record({
      projectId,
      entityType: 'design',
      entityId: row.id,
      action: 'deleted',
      title: '디자인 시스템',
    });
  }
}
