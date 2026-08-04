import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateWireframeDto, Wireframe } from '@issue-board/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { parseScreens, toWireframe } from '../common/mappers';

/** content에서 `data-screen="..."` 값을 순서대로(중복 제거) 뽑는다. */
export function extractScreenIds(content: string): string[] {
  const ids = new Set<string>();
  const re = /data-screen\s*=\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) ids.add(m[1].trim());
  return [...ids].filter(Boolean);
}

/**
 * 와이어프레임은 조회 전용(G2). 편집(update) 없음.
 * 같은 name으로 재생성하면 삭제 대신 version을 올려 이력으로 보존한다.
 */
@Injectable()
export class WireframesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
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

  /**
   * 이슈의 `screenId`로 쓸 수 있는 화면 id 집합.
   * **name별 최신 버전만** 본다 — 대시보드의 "화면 보기"가 화면을 찾는 기준과 같다.
   * (구버전에만 있고 최신에서 사라진 화면은 더 이상 유효한 링크 대상이 아니다.)
   */
  async validScreenIds(projectId: string): Promise<Set<string>> {
    const rows = await this.prisma.wireframe.findMany({
      where: { projectId },
      orderBy: [{ name: 'asc' }, { version: 'desc' }],
      select: { name: true, screens: true },
    });
    const seenNames = new Set<string>();
    const ids = new Set<string>();
    for (const row of rows) {
      if (seenNames.has(row.name)) continue;
      seenNames.add(row.name);
      for (const id of parseScreens(row.screens)) ids.add(id);
    }
    return ids;
  }

  async create(projectId: string, dto: CreateWireframeDto): Promise<Wireframe> {
    // 같은 (projectId, name)의 최신 버전 +1 (없으면 1)
    const latest = await this.prisma.wireframe.findFirst({
      where: { projectId, name: dto.name },
      orderBy: { version: 'desc' },
      select: { version: true, sequence: true, applicationId: true },
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
        screens: JSON.stringify(extractScreenIds(dto.content)),
        sequence,
        version,
        // 명시값 우선 → 같은 name 재생성 시 이전 앱 상속 → 미분류(null)
        applicationId: dto.applicationId ?? latest?.applicationId ?? null,
      },
    });
    const wireframe = toWireframe(row);
    // 같은 name의 v2+는 재생성(updated), 첫 버전은 created로 본다.
    await this.activity.record({
      projectId,
      entityType: 'wireframe',
      entityId: wireframe.id,
      action: version > 1 ? 'updated' : 'created',
      title: wireframe.name,
      changes: version > 1 ? { version: { from: null, to: String(version) } } : null,
    });
    return wireframe;
  }

  /** 특정 와이어프레임(버전) 삭제. 사용자가 명시적으로 요청할 때만. */
  async remove(id: string): Promise<void> {
    const row = await this.prisma.wireframe.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Wireframe ${id} not found`);
    await this.prisma.wireframe.delete({ where: { id } });
    await this.activity.record({
      projectId: row.projectId,
      entityType: 'wireframe',
      entityId: id,
      action: 'deleted',
      title: row.name,
    });
  }
}
