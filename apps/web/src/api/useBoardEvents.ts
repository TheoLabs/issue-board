import { useEffect } from 'react';
import type { BoardEvent } from '@issue-board/shared';

/**
 * SSE 구독 — 외부 Claude 세션이 MCP로 보드를 바꾸면 대시보드가 즉시 갱신된다.
 * (docs/ARCHITECTURE.md §5)
 */
export function useBoardEvents(onEvent: (event: BoardEvent) => void): void {
  useEffect(() => {
    const source = new EventSource('/api/events/stream');
    source.onmessage = (e) => {
      try {
        onEvent(JSON.parse(e.data) as BoardEvent);
      } catch {
        /* ignore malformed event */
      }
    };
    return () => source.close();
  }, [onEvent]);
}
