import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreatePlanDto,
  Plan,
  PlanVersion,
  UpdatePlanDto,
} from '@issue-board/shared';
import type { Plan as PrismaPlan } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { toPlan, toPlanVersion } from '../common/mappers';

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async listByProject(projectId: string): Promise<Plan[]> {
    const rows = await this.prisma.plan.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toPlan);
  }

  async get(id: string): Promise<Plan> {
    const row = await this.prisma.plan.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Plan ${id} not found`);
    return toPlan(row);
  }

  /** 기획 변경 이력 (버전 내림차순, 최신 먼저) */
  async listVersions(planId: string): Promise<PlanVersion[]> {
    const rows = await this.prisma.planVersion.findMany({
      where: { planId },
      orderBy: { version: 'desc' },
    });
    return rows.map(toPlanVersion);
  }

  /** 신규 기획. 초안 작업본으로 시작하며 마일스톤 스냅샷은 만들지 않는다. */
  async create(projectId: string, dto: CreatePlanDto): Promise<Plan> {
    const row = await this.prisma.plan.create({
      data: {
        projectId,
        title: dto.title,
        content: dto.content,
        status: dto.status ?? 'draft',
        applicationId: dto.applicationId ?? null,
      },
    });
    const plan = toPlan(row);
    await this.activity.record({
      projectId,
      entityType: 'plan',
      entityId: plan.id,
      action: 'created',
      title: plan.title,
    });
    return plan;
  }

  /**
   * 작업본 덮어쓰기. 이력(버전)은 **승인된 기획에만** 남긴다:
   * - draft 편집: 스냅샷 없음 (초안은 자유롭게 다듬는다 — 버전이 쌓이지 않음)
   * - draft→approved 전이: 승인 시점을 마일스톤 스냅샷("승인")
   * - 이미 approved인 기획의 제목/본문 변경: 변경 결과를 이력으로 스냅샷("수정")
   * (Plan.version은 낙관적 잠금용 카운터로만 증가; 마일스톤 번호와 무관)
   */
  async update(
    id: string,
    dto: UpdatePlanDto,
    expectedVersion?: number,
  ): Promise<Plan> {
    const current = await this.prisma.plan.findUnique({ where: { id } });
    if (!current) throw new NotFoundException(`Plan ${id} not found`);
    if (expectedVersion !== undefined && current.version !== expectedVersion) {
      throw new ConflictException(
        `Version conflict: expected ${expectedVersion}, got ${current.version}`,
      );
    }
    const row = await this.prisma.plan.update({
      where: { id },
      data: {
        title: dto.title,
        content: dto.content,
        status: dto.status,
        applicationId: dto.applicationId,
        version: { increment: 1 },
      },
    });

    const becameApproved =
      dto.status === 'approved' && current.status !== 'approved';
    const contentChanged =
      (dto.title !== undefined && dto.title !== current.title) ||
      (dto.content !== undefined && dto.content !== current.content);
    // 초안 편집은 이력을 남기지 않는다. 승인 전이·승인본 변경만 스냅샷.
    if (becameApproved) {
      await this.snapshot(row, '승인');
    } else if (current.status === 'approved' && contentChanged) {
      await this.snapshot(row, '수정');
    }

    const plan = toPlan(row);
    const statusChanged = current.status !== row.status;
    await this.activity.record({
      projectId: plan.projectId,
      entityType: 'plan',
      entityId: plan.id,
      action: statusChanged ? 'status_changed' : 'updated',
      title: plan.title,
      changes: statusChanged
        ? { status: { from: current.status, to: row.status } }
        : null,
    });
    return plan;
  }

  /** 명시적 마일스톤 스냅샷 (현재 작업본을 새 버전으로 고정). 승인된 기획만 대상. */
  async createSnapshot(planId: string, label?: string): Promise<Plan> {
    const row = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!row) throw new NotFoundException(`Plan ${planId} not found`);
    // 초안(draft)은 이력을 남기지 않는다 — 승인된 기획만 버저닝한다.
    if (row.status !== 'approved') {
      throw new ForbiddenException(
        `초안(현재: ${row.status}) 기획은 스냅샷하지 않습니다. 기획을 확정(approved)한 뒤 이력을 남기세요.`,
      );
    }
    await this.snapshot(row, label);
    await this.activity.record({
      projectId: row.projectId,
      entityType: 'plan',
      entityId: planId,
      action: 'snapshot',
      title: row.title,
      changes: label ? { label: { from: null, to: label } } : null,
    });
    return toPlan(row);
  }

  async remove(id: string): Promise<void> {
    const row = await this.prisma.plan.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Plan ${id} not found`);
    await this.prisma.plan.delete({ where: { id } });
    await this.activity.record({
      projectId: row.projectId,
      entityType: 'plan',
      entityId: id,
      action: 'deleted',
      title: row.title,
    });
  }

  /** 현재 작업본을 다음 마일스톤 번호로 스냅샷 */
  private async snapshot(plan: PrismaPlan, label?: string): Promise<void> {
    const latest = await this.prisma.planVersion.findFirst({
      where: { planId: plan.id },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = (latest?.version ?? 0) + 1;
    await this.prisma.planVersion.create({
      data: {
        planId: plan.id,
        version,
        title: plan.title,
        content: plan.content,
        status: plan.status,
        label: label ?? null,
      },
    });
  }
}
