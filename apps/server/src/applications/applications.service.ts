import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Application, UpsertApplicationDto } from '@issue-board/shared';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { toApplication } from '../common/mappers';
import { derivePrefix } from '../common/issue-key';

/**
 * 애플리케이션(전달 표면) — 한 프로젝트 안의 앱 단위(예: 추노앱, 백오피스).
 * 프로젝트 내 key 기준 편집형 upsert. 구조적 엔티티라 활동 로그(일일 요약)에는
 * 남기지 않고, 대시보드 실시간 갱신을 위한 SSE 이벤트만 발생시킨다.
 */
@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  async listByProject(projectId: string): Promise<Application[]> {
    const rows = await this.prisma.application.findMany({
      where: { projectId },
      orderBy: [{ sequence: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(toApplication);
  }

  async get(id: string): Promise<Application> {
    const row = await this.prisma.application.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Application ${id} not found`);
    return toApplication(row);
  }

  /** key 기준 upsert. sequence 미지정 시 신규는 맨 뒤(기존 최대+1). */
  async upsert(projectId: string, dto: UpsertApplicationDto): Promise<Application> {
    const existing = await this.prisma.application.findUnique({
      where: { projectId_key: { projectId, key: dto.key } },
    });
    // 이슈 키 접두사: 명시되면 유일성 검증, 신규인데 미지정이면 이름에서 도출,
    // 기존 갱신인데 미지정이면 그대로 유지(undefined).
    const taken = await this.takenPrefixes(projectId, existing?.id);
    let issuePrefix: string | undefined;
    if (dto.issuePrefix) {
      const p = dto.issuePrefix.trim().toUpperCase();
      if (taken.has(p))
        throw new ConflictException(
          `이슈 키 접두사 "${p}"는 이 프로젝트에서 이미 사용 중입니다`,
        );
      issuePrefix = p;
    } else if (!existing) {
      issuePrefix = derivePrefix(dto.name, taken);
    }
    const sequence = dto.sequence ?? (await this.nextSequence(projectId));
    const row = await this.prisma.application.upsert({
      where: { projectId_key: { projectId, key: dto.key } },
      create: {
        projectId,
        key: dto.key,
        name: dto.name,
        description: dto.description ?? null,
        sequence,
        issuePrefix: issuePrefix ?? derivePrefix(dto.name, taken),
      },
      update: {
        name: dto.name,
        description: dto.description ?? null,
        ...(dto.sequence !== undefined ? { sequence: dto.sequence } : {}),
        ...(issuePrefix !== undefined ? { issuePrefix } : {}),
      },
    });
    this.events.emit({
      type: 'application:changed',
      projectId,
      entityId: row.id,
    });
    return toApplication(row);
  }

  async remove(id: string): Promise<void> {
    const row = await this.prisma.application.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Application ${id} not found`);
    // 앱 삭제 시 소속 기획·와이어프레임·이슈의 applicationId는 FK(SetNull)로 자동 해제된다.
    await this.prisma.application.delete({ where: { id } });
    this.events.emit({
      type: 'application:changed',
      projectId: row.projectId,
      entityId: id,
    });
  }

  private async nextSequence(projectId: string): Promise<number> {
    const last = await this.prisma.application.findFirst({
      where: { projectId },
      orderBy: { sequence: 'desc' },
      select: { sequence: true },
    });
    return last ? last.sequence + 1 : 0;
  }

  /** 프로젝트 내 다른 앱들이 이미 쓰는 이슈 키 접두사 집합 (유일성 검증·도출용). */
  private async takenPrefixes(
    projectId: string,
    exceptId?: string,
  ): Promise<Set<string>> {
    const apps = await this.prisma.application.findMany({
      where: {
        projectId,
        ...(exceptId ? { NOT: { id: exceptId } } : {}),
      },
      select: { issuePrefix: true },
    });
    return new Set(
      apps.map((a) => a.issuePrefix).filter((p): p is string => Boolean(p)),
    );
  }
}
