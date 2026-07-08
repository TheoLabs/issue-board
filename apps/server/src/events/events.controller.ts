import { Controller, Sse, MessageEvent } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  /** GET /events/stream — 대시보드 실시간 반영용 SSE */
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return this.events
      .asObservable()
      .pipe(map((event) => ({ data: event }) as MessageEvent));
  }
}
