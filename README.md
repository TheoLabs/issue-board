# Issue Board

Claude 에이전트가 **기획 · 와이어프레임 · 이슈 분리**를 수행하고, 그 산출물을
로컬 대시보드로 시각화 · 관리하는 웹 애플리케이션. 모든 것이 **로컬**에서 동작한다.

> 아키텍처 상세: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## 구조 (pnpm workspace)

```
apps/server   NestJS (:4000) — REST + SSE + MCP 서버, Prisma/SQLite
apps/web      React + Vite + TS(SWC) — 대시보드 (:5173)
packages/shared  web ↔ server 공유 타입 (dual ESM/CJS 빌드)
```

## 셋업

```bash
pnpm install

# 공유 타입 빌드 (server/web가 참조)
pnpm --filter @issue-board/shared build

# DB 생성 + 마이그레이션
cd apps/server && cp .env.example .env && pnpm db:migrate && cd -
```

## 개발 실행

```bash
pnpm dev            # server(:4000) + web(:5173) 동시 실행
# 또는 개별
pnpm dev:server
pnpm dev:web
```

- 대시보드: http://localhost:5173 (web은 `/api`를 :4000으로 프록시)
- MCP 엔드포인트: http://localhost:4000/mcp

## 생성 흐름 — 산출물은 Claude Code로 만든다

**Anthropic API 키가 필요 없다.** 기획/와이어프레임/이슈는 사용자의 Claude Code
세션이 MCP 툴로 직접 적재한다. 대시보드는 시각화 + CRUD 상호작용만 담당한다.

작업할 프로젝트 루트에 `.mcp.json`을 두고:

```json
{
  "mcpServers": {
    "issue-board": {
      "type": "http",
      "url": "http://localhost:4000/mcp"
    }
  }
}
```

그 디렉토리에서 Claude Code를 실행한 뒤:

```
"이 프로젝트 기획하고 와이어프레임이랑 이슈로 분리해서 이슈보드에 올려줘"
```

Claude가 MCP 툴을 순차 호출한다:
`create_project(repoPath=cwd)` → `create_plan` → `create_wireframe` → `create_issue` × N

이후 다른 세션(다른 프로젝트 작업 중)도 같은 MCP로 붙어 `get_project_context(cwd)`로
컨텍스트를 읽고 `update_issue_status`로 진행 상황을 갱신한다. 변경은 SSE로 대시보드에
실시간 반영된다.

### MCP 툴 목록

| 툴 | 방향 | 용도 |
|----|------|------|
| `list_projects` / `get_project_context` | read | 프로젝트/컨텍스트 조회 (cwd 매칭) |
| `get_plan` / `list_issues` / `get_wireframe` | read | 개별 산출물 조회 |
| `create_project` / `create_plan` / `create_wireframe` / `create_issue` | write | 최초 생성 |
| `update_issue_status` / `append_plan_note` | write | 진행 갱신 |

## 일일 업무 요약 → 구글 드라이브 업로드

개요(Overview) 탭의 **"오늘의 작업"** 카드에 **[드라이브 업로드]** 버튼이 있다.
누르면 오늘의 활동 로그를 [`ib-daily`](agent/commands/ib-daily.md) 템플릿 그대로
정규화한 마크다운을 만들어 구글 드라이브에 **Google Docs 문서**로 올린다.

- 폴더 구조: `이슈보드 일일요약 / {프로젝트명} / {날짜} {프로젝트명} 일일요약`
- 같은 날짜 문서가 있으면 **새로 만들지 않고 갱신**(덮어쓰기)한다.
- 브라우저에서 직접 올린다(**서버·client_secret 불필요**). Google Identity
  Services 토큰으로 `drive.file` 스코프만 사용 — 이 앱이 만든 파일만 접근한다.

### 일회성 설정 (구글 OAuth 클라이언트 ID)

1. Google Cloud Console → **API 및 서비스 → 사용자 인증 정보** 에서
   **OAuth 클라이언트 ID(웹 애플리케이션)** 를 만든다. *(client_secret은 안 쓴다.)*
2. **승인된 JavaScript 원본**에 앱 origin을 추가한다: `http://localhost:5173`
3. **Google Drive API** 를 사용 설정한다.
4. 발급된 클라이언트 ID를 웹 앱 `.env` 에 넣는다:
   ```bash
   # apps/web/.env  (apps/web/.env.example 참고, git 제외됨)
   VITE_GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
   ```
5. `pnpm dev:web` 을 (재)시작한다. Vite는 시작 시 `.env` 를 읽는다.

> ID가 없거나 미설정이면 버튼은 비활성화되고, 필요한 환경변수를 툴팁으로 안내한다.
> 토큰은 브라우저 세션에만 ~1시간 유지되어, 만료 시 클릭 한 번으로 재동의한다.
> 무인 자동 업로드가 필요하면 스케줄에서 `/ib-daily`(MCP 연동)를 돌린다.

## 빌드 & 검증

```bash
pnpm build                              # 전체 (topological)
pnpm --filter @issue-board/server typecheck
pnpm --filter @issue-board/web typecheck
```

## 스크립트 참고

| 명령 | 설명 |
|------|------|
| `pnpm db:migrate` | Prisma 마이그레이션 (dev) |
| `pnpm db:studio` | Prisma Studio로 DB 열람 |
| `pnpm db:generate` | Prisma Client 재생성 |
