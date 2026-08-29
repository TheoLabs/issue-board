import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateIssueDto,
  Issue,
  UpdateIssueDto,
  IssueLevel,
  IssueStatus,
} from '@issue-board/shared';
import { derivePriority } from '@issue-board/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { toIssue } from '../common/mappers';
import { derivePrefix, formatKey, isIssueKey } from '../common/issue-key';
import { WireframesService } from '../wireframes/wireframes.service';

@Injectable()
export class IssuesService {
  private readonly logger = new Logger(IssuesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly wireframes: WireframesService,
  ) {}

  /**
   * screenId는 FK가 아니라 와이어프레임 HTML의 `data-screen` 값이다.
   * 오타·삭제된 화면을 가리키면 대시보드의 "화면 보기"가 조용히 죽으므로 적재 시 막는다.
   */
  private async assertScreenExists(
    projectId: string,
    screenId: string,
  ): Promise<void> {
    const valid = await this.wireframes.validScreenIds(projectId);
    if (valid.has(screenId)) return;
    const known = [...valid];
    throw new NotFoundException(
      `화면 "${screenId}"을(를) 찾을 수 없습니다. ` +
        (known.length
          ? `이 프로젝트에서 쓸 수 있는 화면 id: ${known.join(', ')}.`
          : `아직 와이어프레임이 없습니다 — /ib-wireframe으로 화면을 먼저 만들거나 screenId를 생략하세요.`),
    );
  }

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

  /**
   * 기획 확정 가드: 이 이슈의 기획이 approved가 아니면 착수(코드 작성)를 막는다.
   * 착수/완료 상태 전이 전에 호출한다. **예외 없음** — 기획이 연결돼 있지 않거나
   * 연결된 기획을 찾을 수 없으면 확정 여부를 판정할 근거가 없으므로 통과가 아니라 차단한다.
   * (기획이 확정돼야 개발이 이뤄지는 프로세스를 서버에서 강제하는 지점.)
   */
  async assertPlanApproved(ref: string): Promise<void> {
    const id = await this.resolveId(ref);
    const issue = await this.prisma.issue.findUnique({
      where: { id },
      select: { id: true, planId: true, key: true },
    });
    if (!issue) throw new NotFoundException(`Issue ${ref} not found`);
    await this.assertPlanApprovedFor(issue);
  }

  /** 이미 읽어둔 이슈 행으로 가드를 판정한다 (재조회 없이). */
  private async assertPlanApprovedFor(issue: {
    id: string;
    planId: string | null;
    key: string | null;
  }): Promise<void> {
    const label = issue.key ?? issue.id;
    if (!issue.planId) {
      throw new ForbiddenException(
        `이슈(${label})에 기획이 연결돼 있지 않아 착수할 수 없습니다. ` +
          `link_issue(issueId, planId=<기획 id>)로 파생 기획을 연결하고, ` +
          `그 기획을 확정(approved)한 뒤 다시 진행하세요.`,
      );
    }
    const plan = await this.prisma.plan.findUnique({
      where: { id: issue.planId },
      select: { status: true, title: true },
    });
    if (!plan) {
      throw new ForbiddenException(
        `이슈(${label})에 연결된 기획(${issue.planId})을 찾을 수 없습니다. ` +
          `link_issue로 유효한 기획을 다시 연결한 뒤 진행하세요.`,
      );
    }
    if (plan.status !== 'approved') {
      throw new ForbiddenException(
        `기획 "${plan.title}"이(가) 아직 확정(approved)되지 않았습니다 (현재: ${plan.status}). ` +
          `확정되지 않은 기획의 이슈(${label})는 착수(코드 작성)할 수 없습니다. ` +
          `기획을 검토·확정(approved)한 뒤 다시 진행하세요.`,
      );
    }
  }

  /**
   * assertPlanApprovedFor의 비-throw 판정판. 롤업처럼 "막히면 조용히 건너뛴다"가
   * 맞는 자리에서만 쓴다. 사용자가 직접 요청한 전이는 반드시 assert 쪽을 써서
   * 왜 막혔는지 메시지를 돌려줘야 한다.
   */
  private async planApproved(issue: {
    id: string;
    planId: string | null;
    key: string | null;
  }): Promise<boolean> {
    try {
      await this.assertPlanApprovedFor(issue);
      return true;
    } catch (err) {
      if (err instanceof ForbiddenException) return false;
      throw err;
    }
  }

  /**
   * 하위 상태 목록에서 상위(에픽)의 목표 상태를 산출한다. null이면 바꾸지 않는다.
   *
   *  - 전부 done  → done      (하위가 다 끝나면 상위도 끝난 것)
   *  - 전부 todo  → 변경 없음  (아직 아무도 착수하지 않음 — 상위를 되돌리지 않는다)
   *  - 그 밖       → in_progress (하나라도 시작됐으면 상위도 진행 중)
   *
   * blocked인 하위가 섞여 있으면 "전부 done"이 아니므로 상위는 done이 되지 않는다.
   * 사람이 blocked로 세워 둔 **상위**를 자동으로 in_progress로 풀지도 않는다
   * (blocked는 사람의 판단) — 다만 하위가 전부 끝나면 done으로는 올린다.
   */
  private rollUpTarget(
    children: IssueStatus[],
    parent: IssueStatus,
  ): IssueStatus | null {
    if (children.length === 0) return null;
    if (children.every((s) => s === 'done')) {
      return parent === 'done' ? null : 'done';
    }
    if (children.every((s) => s === 'todo')) return null;
    if (parent === 'blocked') return null;
    return parent === 'in_progress' ? null : 'in_progress';
  }

  /**
   * 하위 → 상위 상태 롤업. 상태가 바뀐 이슈의 부모부터 루트까지 거슬러 올라가며
   * rollUpTarget의 판정을 적용한다. 에픽의 상태를 사람이 따로 관리하지 않아도
   * 하위 진척과 어긋나지 않게 하는 장치다. (MCP·대시보드 어느 경로의 write든
   * update/create 한 곳을 지나므로 여기 한 번만 걸면 된다.)
   *
   * 실패해도 호출자의 write를 깨뜨리지 않는다 — 하위 이슈의 정당한 전이가
   * 상위 사정(기획 미확정 등)으로 실패하면 안 되기 때문이다.
   */
  private async rollUpAncestors(startParentId: string | null): Promise<void> {
    const seen = new Set<string>(); // parentId 순환(잘못 세팅된 트리)에 갇히지 않도록
    let parentId = startParentId;
    try {
      while (parentId && !seen.has(parentId)) {
        seen.add(parentId);
        const parent = await this.prisma.issue.findUnique({
          where: { id: parentId },
        });
        if (!parent) return;
        const children = await this.prisma.issue.findMany({
          where: { parentId: parent.id },
          select: { status: true },
        });
        const target = this.rollUpTarget(
          children.map((c) => c.status as IssueStatus),
          parent.status as IssueStatus,
        );
        // 상위가 안 바뀌면 그 위도 바뀔 이유가 없다.
        if (!target) return;
        // 기획 확정 가드는 상위에도 그대로 적용된다. 상위의 기획이 미확정이거나
        // 연결돼 있지 않으면 롤업만 조용히 포기한다(하위 전이는 그대로 유효).
        if (!(await this.planApproved(parent))) {
          this.logger.log(
            `롤업 건너뜀 — 상위 이슈(${parent.key ?? parent.id})의 기획이 확정되지 않았습니다`,
          );
          return;
        }
        const row = await this.prisma.issue.update({
          where: { id: parent.id },
          data: { status: target, version: { increment: 1 } },
        });
        await this.activity.record({
          projectId: row.projectId,
          entityType: 'issue',
          entityId: row.id,
          action: 'status_changed',
          title: row.title,
          changes: { status: { from: parent.status, to: target } },
        });
        parentId = row.parentId;
      }
    } catch (err) {
      // 롤업은 부가 작업이다. 실패는 로그로 남기고 호출자의 write는 지킨다.
      this.logger.warn(`상위 이슈 상태 롤업 실패: ${String(err)}`);
    }
  }

  /**
   * 부모 참조를 실제 issue id로 해석하고, 트리로서 성립하는지 확인한다.
   * 키(`CH-12`)와 cuid를 모두 받는다 — create/update가 같은 규칙을 쓰도록 한 곳에 모았다.
   * (resolveId만 쓰면 존재하지 않는 부모가 FK 오류로 터지고, 순환이 그대로 들어온다.)
   */
  private async resolveParentId(
    ref: string,
    projectId: string,
    selfId?: string,
  ): Promise<string> {
    const parentId = await this.resolveId(ref, projectId);
    if (selfId && parentId === selfId) {
      throw new BadRequestException(
        '이슈를 자기 자신의 하위로 둘 수 없습니다.',
      );
    }
    const parent = await this.prisma.issue.findUnique({
      where: { id: parentId },
      select: { id: true, projectId: true, parentId: true, key: true },
    });
    if (!parent) {
      throw new NotFoundException(`상위 이슈 ${ref}를 찾을 수 없습니다`);
    }
    if (parent.projectId !== projectId) {
      throw new BadRequestException(
        `상위 이슈(${parent.key ?? parent.id})가 다른 프로젝트에 있습니다. ` +
          `같은 프로젝트의 이슈만 부모로 둘 수 있습니다.`,
      );
    }
    // 순환 방지: 새 부모의 조상 중에 자기 자신이 있으면 트리가 고리가 된다.
    // (상태 롤업이 조상을 거슬러 오르므로 고리가 생기면 안 된다.)
    if (selfId) {
      const seen = new Set<string>([parentId]);
      let cursor = parent.parentId;
      while (cursor) {
        if (cursor === selfId) {
          throw new BadRequestException(
            `상위 이슈(${parent.key ?? parent.id})는 이 이슈의 하위입니다. ` +
              `부모로 지정하면 트리가 순환합니다.`,
          );
        }
        if (seen.has(cursor)) break; // 이미 깨진 트리 — 여기서 멈춘다
        seen.add(cursor);
        const up = await this.prisma.issue.findUnique({
          where: { id: cursor },
          select: { parentId: true },
        });
        cursor = up?.parentId ?? null;
      }
    }
    return parentId;
  }

  async create(projectId: string, dto: CreateIssueDto): Promise<Issue> {
    if (dto.screenId) await this.assertScreenExists(projectId, dto.screenId);
    const value = dto.value ?? 'medium';
    const effort = dto.effort ?? 'medium';
    // 우선순위는 value/effort에서 산출. 둘 다 없고 priority만 주면 그대로 존중.
    const priority =
      dto.value || dto.effort
        ? derivePriority(value, effort)
        : (dto.priority ?? derivePriority(value, effort));
    // 부모가 키(CH-12)로 오면 실제 id로 해석하고 존재·소속을 확인한다.
    const parentId = dto.parentId
      ? await this.resolveParentId(dto.parentId, projectId)
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
    // 하위가 하나 늘면 상위의 상태도 다시 산출한다 — 작업 중 발견한 할 일을
    // done인 에픽 밑에 새로 달면 그 에픽은 다시 in_progress여야 한다.
    if (parentId) await this.rollUpAncestors(parentId);
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
    // 화면 연동을 새로 넣거나 바꿀 때만 검증한다 (link_issue도 이 경로로 들어온다).
    if (dto.screenId && dto.screenId !== current.screenId) {
      await this.assertScreenExists(current.projectId, dto.screenId);
    }
    // 기획 확정 가드(예외 없음). MCP든 대시보드(REST)든 여기 한 곳에서 동일하게 막힌다.
    if (
      (dto.status === 'in_progress' || dto.status === 'done') &&
      dto.status !== current.status
    ) {
      await this.assertPlanApprovedFor(current);
    }
    // 부모도 키(CH-12)로 올 수 있다 — create와 똑같이 id로 해석하고 검증한다.
    // undefined면 변경 없음, null이면 부모에서 분리.
    const parentId =
      typeof dto.parentId === 'string'
        ? await this.resolveParentId(dto.parentId, current.projectId, id)
        : dto.parentId;
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
        parentId,
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
    // 하위 → 상위 전파. 부모를 옮겼으면 떠난 쪽 트리도 다시 산출해야 한다.
    const parentChanged =
      parentId !== undefined && parentId !== current.parentId;
    if (statusChanged || parentChanged) await this.rollUpAncestors(row.parentId);
    if (parentChanged) await this.rollUpAncestors(current.parentId);
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
