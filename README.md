# Issue Board

Claude 에이전트가 **기획 · 와이어프레임 · 도메인 · 이슈 · 디자인 시스템**을 생성하고,
그 산출물을 로컬 대시보드로 시각화 · 관리하는 웹 애플리케이션. 모든 것이 **로컬**에서
동작한다.

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

## 대시보드 구성 (탭)

- **대시보드** — KPI(완료율·이슈·기획·도메인·와이어프레임·디자인), 이슈 상태·우선순위
  분포, 에픽 진행률, **진행 분석**(가치×노력 매트릭스 · 주간 완료 속도 · 누적 생성/완료 추이).
- **일일 업무** — 날짜별 활동 이력 + 보고서 (아래 참고).
- **이슈**(칸반/테이블) · **기획** · **도메인**(표/ERD) · **와이어프레임** · **디자인 시스템**.

외부 변경은 SSE로 실시간 반영된다.

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

그 디렉토리에서 Claude Code를 실행한 뒤, 슬래시 커맨드로 단계별 생성을 돌린다
(오케스트레이터 `/ib-generate` 하나로 순차 실행하거나, 단계별 `/ib-plan`·`/ib-wireframe`·
`/ib-domain`·`/ib-issues`, 그리고 `/ib-design <메인색>`으로 디자인 시스템 생성).
커맨드 자산은 [`agent/`](agent/README.md) 참고.

Claude가 MCP 툴을 순차 호출한다:
`create_project(repoPath=cwd)` → `create_plan` → `create_wireframe` × N →
`create_domain` × N → `create_issue` × N (에픽 먼저 → 태스크).

이후 다른 세션(다른 프로젝트 작업 중)도 같은 MCP로 붙어 `get_project_context(cwd)`로
컨텍스트를 읽고 `update_issue_status`로 진행 상황을 갱신한다. 변경은 SSE로 대시보드에
실시간 반영된다.

### MCP 툴 목록

| 툴 | 방향 | 용도 |
|----|------|------|
| `list_projects` · `get_project_context` | read | 프로젝트 목록 / cwd 매칭 컨텍스트(기획·이슈·도메인·와이어프레임·디자인) |
| `get_plan` · `list_issues` · `get_issue` · `list_wireframes` · `get_wireframe` · `list_domains` · `get_domain` · `get_design` · `get_daily_activity` | read | 개별 산출물·활동 조회 |
| `create_project` · `create_plan` · `create_wireframe` · `create_domain` · `create_issue` · `create_design` | write | 생성 (도메인·디자인은 upsert) |
| `update_issue` · `update_issue_status` · `link_issue` · `update_plan` · `append_plan_note` · `snapshot_plan` | write | 갱신 · 연동 · 스냅샷 |
| `delete_issue` · `delete_domain` · `delete_wireframe` | write | 삭제 (명시 요청 시에만) |

## 일일 업무 · 요약 → 구글 드라이브

활동 로그는 이슈·기획·도메인·와이어프레임·디자인에 **변경이 생길 때마다 자동 기록**된다
(웹 조작 = `user`, MCP/Claude = 🤖 `agent`). 이를 **"일일 업무" 탭**에서 날짜별로 본다:

- 좌측 **날짜 목록**(활동이 있던 날) → 우측 **그날 상세**(엔티티별 그룹) + **줄글 정리**.
- **[보고서 보기]** — 그날 전체 보고서(팀 공유용 마크다운)를 생성·미리보기하고 **복사·`.md` 다운로드**.
- **[드라이브 업로드]** — 보고서를 구글 드라이브에 **Google Docs 문서**로 올린다.

보고서 양식은 [`ib-daily`](agent/commands/ib-daily.md) 템플릿을 따르는 섹션형
(요약 → 완료 → 진행 중 → 신규 등록 → 산출물 변경 → 내일 이어서 → 정리).

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
