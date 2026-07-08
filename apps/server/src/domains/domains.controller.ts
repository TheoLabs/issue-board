import { Controller, Delete, Get, Param } from '@nestjs/common';
import { DomainsService } from './domains.service';

/** 조회 + 삭제(사용자 명시). 생성/갱신은 MCP create_domain(upsert)로. */
@Controller()
export class DomainsController {
  constructor(private readonly domains: DomainsService) {}

  @Get('projects/:projectId/domains')
  listByProject(@Param('projectId') projectId: string) {
    return this.domains.listByProject(projectId);
  }

  @Get('domains/:id')
  get(@Param('id') id: string) {
    return this.domains.get(id);
  }

  @Delete('domains/:id')
  remove(@Param('id') id: string) {
    return this.domains.remove(id);
  }
}
