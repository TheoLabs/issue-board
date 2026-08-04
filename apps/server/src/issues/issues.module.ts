import { Module } from '@nestjs/common';
import { IssuesService } from './issues.service';
import { IssuesController } from './issues.controller';
// screenId 검증에 화면 목록이 필요하다.
import { WireframesModule } from '../wireframes/wireframes.module';

@Module({
  imports: [WireframesModule],
  controllers: [IssuesController],
  providers: [IssuesService],
  exports: [IssuesService],
})
export class IssuesModule {}
