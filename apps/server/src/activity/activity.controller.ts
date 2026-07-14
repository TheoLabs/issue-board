import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import type {
  DailyCount,
  DailyReport,
  DailySummary,
  WeeklyActivityPoint,
} from '@issue-board/shared';
import { ActivityService } from './activity.service';
import { DailySummaryService } from './daily-summary.service';

@Controller()
export class ActivityController {
  constructor(
    private readonly activity: ActivityService,
    private readonly dailySummary: DailySummaryService,
  ) {}

  /**
   * GET /projects/:projectId/activity/days?tz=Asia/Seoul
   * 활동이 있었던 날짜 목록(최신순, 날짜별 건수).
   */
  @Get('projects/:projectId/activity/days')
  days(
    @Param('projectId') projectId: string,
    @Query('tz') tz?: string,
  ): Promise<DailyCount[]> {
    return this.activity.listDays(projectId, tz || undefined);
  }

  /**
   * GET /projects/:projectId/activity/trend?weeks=12&tz=Asia/Seoul
   * 주간 이슈 추이(생성 vs 완료). 번다운·속도 차트용.
   */
  @Get('projects/:projectId/activity/trend')
  trend(
    @Param('projectId') projectId: string,
    @Query('weeks') weeks?: string,
    @Query('tz') tz?: string,
  ): Promise<WeeklyActivityPoint[]> {
    const n = weeks ? Math.max(1, Math.min(52, Number(weeks) || 12)) : 12;
    return this.activity.trend(projectId, n, tz || undefined);
  }

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

  /**
   * GET /projects/:projectId/activity/daily/report?date=YYYY-MM-DD&tz=Asia/Seoul
   * Claude가 생성해 저장한 서술형 일일 요약(저장본). 없으면 null.
   */
  @Get('projects/:projectId/activity/daily/report')
  getReport(
    @Param('projectId') projectId: string,
    @Query('date') date?: string,
    @Query('tz') tz?: string,
  ): Promise<DailyReport | null> {
    return this.dailySummary.get(projectId, date || undefined, tz || undefined);
  }

  /**
   * POST /projects/:projectId/activity/daily/report?date=YYYY-MM-DD&tz=Asia/Seoul
   * 그날의 활동 스냅샷으로 Claude(CLI)를 호출해 요약을 생성/재생성한다.
   */
  @Post('projects/:projectId/activity/daily/report')
  generateReport(
    @Param('projectId') projectId: string,
    @Query('date') date?: string,
    @Query('tz') tz?: string,
  ): Promise<DailyReport> {
    return this.dailySummary.generate(
      projectId,
      date || undefined,
      tz || undefined,
      'manual',
    );
  }
}
