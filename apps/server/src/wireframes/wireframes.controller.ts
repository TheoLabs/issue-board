import { Controller, Delete, Get, Param } from '@nestjs/common';
import { WireframesService } from './wireframes.service';

/** 조회 전용(G2). 생성은 MCP create_wireframe로만. 삭제는 사용자 명시 요청 시. */
@Controller()
export class WireframesController {
  constructor(private readonly wireframes: WireframesService) {}

  @Get('projects/:projectId/wireframes')
  listByProject(@Param('projectId') projectId: string) {
    return this.wireframes.listByProject(projectId);
  }

  @Get('wireframes/:id')
  get(@Param('id') id: string) {
    return this.wireframes.get(id);
  }

  @Delete('wireframes/:id')
  remove(@Param('id') id: string) {
    return this.wireframes.remove(id);
  }
}
