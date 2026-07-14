import {
  ConflictException,
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
   * 작업본 덮어쓰기. 매 편집은 버전을 만들지 않는다(초안 편집 효율).
   * 단, draft→approved 전이 시에는 그 시점을 자동으로 마일스톤 스냅샷한다.
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
        version: { increment: 1 },
      },
    });

    const becameApproved =
      dto.status === 'approved' && current.status !== 'approved';
    if (becameApproved) await this.snapshot(row, '승인');

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

  /** 명시적 마일스톤 스냅샷 (현재 작업본을 새 버전으로 고정) */
  async createSnapshot(planId: string, label?: string): Promise<Plan> {
    const row = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!row) throw new NotFoundException(`Plan ${planId} not found`);
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
