import { Global, Module } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { DailySummaryService } from './daily-summary.service';
import { ActivityController } from './activity.controller';

/**
 * 활동 로그(감사) + 일일 요약. @Global 로 열어 모든 write 서비스가
 * ActivityService.record()를 주입 없이 바로 쓰게 한다.
 * DailySummaryService는 claude CLI로 서술형 요약을 생성한다(수동/스케줄).
 */
@Global()
@Module({
  controllers: [ActivityController],
  providers: [ActivityService, DailySummaryService],
  exports: [ActivityService, DailySummaryService],
})
export class ActivityModule {}
