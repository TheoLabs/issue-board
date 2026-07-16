import { Module } from '@nestjs/common';
import { McpService } from './mcp.service';
import { McpController } from './mcp.controller';
import { ProjectsModule } from '../projects/projects.module';
import { ApplicationsModule } from '../applications/applications.module';
import { PlansModule } from '../plans/plans.module';
import { IssuesModule } from '../issues/issues.module';
import { WireframesModule } from '../wireframes/wireframes.module';
import { DomainsModule } from '../domains/domains.module';
import { DesignsModule } from '../designs/designs.module';

@Module({
  imports: [
    ProjectsModule,
    ApplicationsModule,
    PlansModule,
    IssuesModule,
    WireframesModule,
    DomainsModule,
    DesignsModule,
  ],
  controllers: [McpController],
  providers: [McpService],
})
export class McpModule {}
