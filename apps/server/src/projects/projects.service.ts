import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateProjectDto, Project } from '@issue-board/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { EventsService } from '../events/events.service';
import { toProject } from '../common/mappers';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly events: EventsService,
  ) {}

  async list(): Promise<Project[]> {
    const rows = await this.prisma.project.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(toProject);
  }

  async get(id: string): Promise<Project> {
    const row = await this.prisma.project.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Project ${id} not found`);
    return toProject(row);
  }

  /** repoPath(cwd)로 프로젝트 조회 — MCP get_project_context에서 사용 */
  async findByRepoPath(repoPath: string): Promise<Project | null> {
    const row = await this.prisma.project.findUnique({ where: { repoPath } });
    return row ? toProject(row) : null;
  }

  async create(dto: CreateProjectDto): Promise<Project> {
    const row = await this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        repoPath: dto.repoPath ?? null,
      },
    });
    const project = toProject(row);
    await this.activity.record({
      projectId: project.id,
      entityType: 'project',
      entityId: project.id,
      action: 'created',
      title: project.name,
    });
    return project;
  }

  async remove(id: string): Promise<void> {
    const row = await this.prisma.project.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Project ${id} not found`);
    // 프로젝트 삭제 시 소속 애플리케이션·기획·이슈·도메인·와이어프레임·디자인·활동로그는
    // FK(Cascade)로 함께 삭제된다. (prisma/schema.prisma)
    await this.prisma.project.delete({ where: { id } });
    this.events.emit({ type: 'project:updated', projectId: id, entityId: id });
  }
}
