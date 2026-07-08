import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { CreateProjectDto } from '@issue-board/shared';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list() {
    return this.projects.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.projects.get(id);
  }

  @Post()
  create(@Body() dto: CreateProjectDto) {
    return this.projects.create(dto);
  }
}
