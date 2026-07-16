import { Controller, Delete, Get, Param } from '@nestjs/common';
import { ApplicationsService } from './applications.service';

/** 조회 + 삭제(사용자 명시). 생성/갱신은 MCP create_application(upsert)로. */
@Controller()
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Get('projects/:projectId/applications')
  listByProject(@Param('projectId') projectId: string) {
    return this.applications.listByProject(projectId);
  }

  @Get('applications/:id')
  get(@Param('id') id: string) {
    return this.applications.get(id);
  }

  @Delete('applications/:id')
  remove(@Param('id') id: string) {
    return this.applications.remove(id);
  }
}
