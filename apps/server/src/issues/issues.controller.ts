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
import type { CreateIssueDto, UpdateIssueDto } from '@issue-board/shared';
import { IssuesService } from './issues.service';

@Controller()
export class IssuesController {
  constructor(private readonly issues: IssuesService) {}

  @Get('projects/:projectId/issues')
  listByProject(@Param('projectId') projectId: string) {
    return this.issues.listByProject(projectId);
  }

  @Post('projects/:projectId/issues')
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateIssueDto,
  ) {
    return this.issues.create(projectId, dto);
  }

  @Get('issues/:id')
  get(@Param('id') id: string) {
    return this.issues.get(id);
  }

  @Patch('issues/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateIssueDto,
    @Headers('if-match') ifMatch?: string,
  ) {
    const expectedVersion = ifMatch ? Number(ifMatch) : undefined;
    return this.issues.update(id, dto, expectedVersion);
  }

  @Delete('issues/:id')
  remove(@Param('id') id: string) {
    return this.issues.remove(id);
  }
}
