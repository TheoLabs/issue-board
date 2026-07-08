import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import type { BoardEvent } from '@issue-board/shared';

/**
 * 보드 변경 이벤트 버스.
 * REST/MCP 어느 경로의 write든 Service 계층에서 emit → 웹 대시보드가 SSE로 구독.
 * (docs/ARCHITECTURE.md §5, §8)
 */
@Injectable()
export class EventsService {
  private readonly stream$ = new Subject<BoardEvent>();

  emit(event: BoardEvent): void {
    this.stream$.next(event);
  }

  asObservable(): Observable<BoardEvent> {
    return this.stream$.asObservable();
  }
}
