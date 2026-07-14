import { AsyncLocalStorage } from 'node:async_hooks';
import type { ActivitySource } from '@issue-board/shared';

/**
 * 요청 단위 컨텍스트. 활동 로그의 주체(source)를 write 서비스까지 전달한다.
 * REST(웹) 요청은 'user', MCP(/mcp) 요청은 'agent'로 미들웨어가 설정한다.
 */
export interface RequestContext {
  source: ActivitySource;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

/** 현재 요청의 주체. 컨텍스트 밖(테스트/부트스트랩)에서는 'agent'로 본다. */
export function currentSource(): ActivitySource {
  return requestContext.getStore()?.source ?? 'agent';
}
