import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateWireframeDto, Wireframe } from '@issue-board/shared';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { toWireframe } from '../common/mappers';

/**
 * 와이어프레임은 조회 전용(G2). 편집(update) 없음.
 * 같은 name으로 재생성하면 삭제 대신 version을 올려 이력으로 보존한다.
 */
@Injectable()
export class WireframesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  /** 모든 버전을 반환한다 (IA sequence 오름차순 → name → 같은 name 내 version 내림차순).
   *  클라이언트가 name으로 묶어 최신을 기본 표시하고 이력을 선택한다. */
  async listByProject(projectId: string): Promise<Wireframe[]> {
    const rows = await this.prisma.wireframe.findMany({
      where: { projectId },
      orderBy: [{ sequence: 'asc' }, { name: 'asc' }, { version: 'desc' }],
    });
    return rows.map(toWireframe);
  }

  async get(id: string): Promise<Wireframe> {
    const row = await this.prisma.wireframe.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Wireframe ${id} not found`);
    return toWireframe(row);
  }

  async create(projectId: string, dto: CreateWireframeDto): Promise<Wireframe> {
    // 같은 (projectId, name)의 최신 버전 +1 (없으면 1)
    const latest = await this.prisma.wireframe.findFirst({
      where: { projectId, name: dto.name },
      orderBy: { version: 'desc' },
      select: { version: true, sequence: true },
    });
    const version = latest ? latest.version + 1 : 1;

    // IA 순서: 명시값 우선 → 같은 name의 기존 순서 상속 → 프로젝트 맨 뒤(max+1)
    let sequence: number;
    if (dto.sequence != null) {
      sequence = dto.sequence;
    } else if (latest) {
      sequence = latest.sequence;
    } else {
      const last = await this.prisma.wireframe.aggregate({
        where: { projectId },
        _max: { sequence: true },
      });
      sequence = (last._max.sequence ?? -1) + 1;
    }

    const row = await this.prisma.wireframe.create({
      data: {
        projectId,
        name: dto.name,
        format: dto.format ?? 'html',
        content: dto.content,
        sequence,
        version,
      },
    });
    const wireframe = toWireframe(row);
    this.events.emit({
      type: 'wireframe:changed',
      projectId,
      entityId: wireframe.id,
    });
    return wireframe;
  }

  /** 특정 와이어프레임(버전) 삭제. 사용자가 명시적으로 요청할 때만. */
  async remove(id: string): Promise<void> {
    const row = await this.prisma.wireframe.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Wireframe ${id} not found`);
    await this.prisma.wireframe.delete({ where: { id } });
    this.events.emit({
      type: 'wireframe:changed',
      projectId: row.projectId,
      entityId: id,
    });
  }
}
