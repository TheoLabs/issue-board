import { Controller, Get, Param } from '@nestjs/common';
import { DesignsService } from './designs.service';

/** 조회. 생성/갱신은 MCP create_design(upsert)로. */
@Controller()
export class DesignsController {
  constructor(private readonly designs: DesignsService) {}

  @Get('projects/:projectId/design')
  getByProject(@Param('projectId') projectId: string) {
    return this.designs.getByProject(projectId);
  }
}
