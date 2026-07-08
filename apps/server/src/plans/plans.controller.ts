import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import type { CreatePlanDto, UpdatePlanDto } from '@issue-board/shared';
import { PlansService } from './plans.service';

@Controller()
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get('projects/:projectId/plans')
  listByProject(@Param('projectId') projectId: string) {
    return this.plans.listByProject(projectId);
  }

  @Post('projects/:projectId/plans')
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreatePlanDto,
  ) {
    return this.plans.create(projectId, dto);
  }

  @Get('plans/:id')
  get(@Param('id') id: string) {
    return this.plans.get(id);
  }

  @Get('plans/:id/versions')
  listVersions(@Param('id') id: string) {
    return this.plans.listVersions(id);
  }

  /** 현재 작업본을 마일스톤 버전으로 저장 */
  @Post('plans/:id/snapshot')
  snapshot(@Param('id') id: string, @Body() body: { label?: string }) {
    return this.plans.createSnapshot(id, body?.label);
  }

  /** If-Match 헤더로 낙관적 잠금 */
  @Patch('plans/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
    @Headers('if-match') ifMatch?: string,
  ) {
    const expectedVersion = ifMatch ? Number(ifMatch) : undefined;
    return this.plans.update(id, dto, expectedVersion);
  }

  @Delete('plans/:id')
  remove(@Param('id') id: string) {
    return this.plans.remove(id);
  }
}
