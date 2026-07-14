import { Controller, Get, Param, Query } from '@nestjs/common';
import type { DailySummary } from '@issue-board/shared';
import { ActivityService } from './activity.service';

@Controller()
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  /**
   * GET /projects/:projectId/activity/daily?date=YYYY-MM-DD&tz=Asia/Seoul
   * 하루치 업무 요약(집계 + 활동 목록). date 생략 시 tz 기준 오늘.
   */
  @Get('projects/:projectId/activity/daily')
  daily(
    @Param('projectId') projectId: string,
    @Query('date') date?: string,
    @Query('tz') tz?: string,
  ): Promise<DailySummary> {
    return this.activity.daily(projectId, date || undefined, tz || undefined);
  }
}
