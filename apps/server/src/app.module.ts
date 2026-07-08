import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { EventsModule } from './events/events.module';
import { ProjectsModule } from './projects/projects.module';
import { PlansModule } from './plans/plans.module';
import { IssuesModule } from './issues/issues.module';
import { WireframesModule } from './wireframes/wireframes.module';
import { DomainsModule } from './domains/domains.module';
import { McpModule } from './mcp/mcp.module';

@Module({
  imports: [
    PrismaModule,
    EventsModule,
    ProjectsModule,
    PlansModule,
    IssuesModule,
    WireframesModule,
    DomainsModule,
    McpModule,
  ],
})
export class AppModule {}
