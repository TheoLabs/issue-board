import { Module } from '@nestjs/common';
import { McpService } from './mcp.service';
import { McpController } from './mcp.controller';
import { ProjectsModule } from '../projects/projects.module';
import { PlansModule } from '../plans/plans.module';
import { IssuesModule } from '../issues/issues.module';
import { WireframesModule } from '../wireframes/wireframes.module';
import { DomainsModule } from '../domains/domains.module';

@Module({
  imports: [
    ProjectsModule,
    PlansModule,
    IssuesModule,
    WireframesModule,
    DomainsModule,
  ],
  controllers: [McpController],
  providers: [McpService],
})
export class McpModule {}
