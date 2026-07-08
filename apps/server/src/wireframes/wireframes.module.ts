import { Module } from '@nestjs/common';
import { WireframesService } from './wireframes.service';
import { WireframesController } from './wireframes.controller';

@Module({
  controllers: [WireframesController],
  providers: [WireframesService],
  exports: [WireframesService],
})
export class WireframesModule {}
