import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { EventsModule } from './events/events.module';
import { ActivityModule } from './activity/activity.module';
import { ProjectsModule } from './projects/projects.module';
import { ApplicationsModule } from './applications/applications.module';
import { PlansModule } from './plans/plans.module';
import { IssuesModule } from './issues/issues.module';
import { WireframesModule } from './wireframes/wireframes.module';
import { DomainsModule } from './domains/domains.module';
import { DesignsModule } from './designs/designs.module';
import { McpModule } from './mcp/mcp.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    EventsModule,
    ActivityModule,
    ProjectsModule,
    ApplicationsModule,
    PlansModule,
    IssuesModule,
    WireframesModule,
    DomainsModule,
    DesignsModule,
    McpModule,
  ],
})
export class AppModule {}
