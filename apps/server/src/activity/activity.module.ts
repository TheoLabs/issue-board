import { Global, Module } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { ActivityController } from './activity.controller';

/**
 * 활동 로그(감사) + 일일 요약. @Global 로 열어 모든 write 서비스가
 * ActivityService.record()를 주입 없이 바로 쓰게 한다.
 */
@Global()
@Module({
  controllers: [ActivityController],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
