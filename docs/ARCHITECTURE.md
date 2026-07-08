# Issue Board — 아키텍처 설계 문서

> Claude 에이전트가 **기획 · 와이어프레임 · 이슈 분리**를 수행하고, 그 산출물을
> 로컬 대시보드로 시각화 · 관리하는 웹 애플리케이션.

---

## 1. 목표와 원칙

| # | 목표 | 설계에 미치는 영향 |
|---|------|--------------------|
| G1 | 기획/이슈 산출물을 **영속화**하고 사용자가 상호작용 | 로컬 DB(SQLite) + REST API |
| G2 | 와이어프레임은 **조회 전용** (편집·상호작용 제외) | 정적 아티팩트로 저장, read-only 렌더 |
| G3 | **최초 생성**은 터미널의 Claude Code 세션이 수행 | MCP write 툴로 DB 적재 (API 키·Agent SDK 불필요) |
| G4 | **다른 Claude 세션**이 보드를 읽고 산출물을 자동 갱신 | 로컬 **MCP 서버** 노출 |
| G5 | **무조건 로컬**에서 동작 | 외부 DB/클라우드 의존 금지, SQLite 파일 하나 |

**핵심 설계 결정**: 이슈보드는 단순 CRUD 앱이 아니라 **"프로젝트 컨텍스트의 공유 허브"**다.
생성 주체는 항상 **Claude Code 세션(사용자 구독)**이며, 웹 UI는 **순수 시각화 + CRUD 상호작용**만
담당한다. 최초 생성이든 이후 갱신이든 **"Claude Code → MCP → DB"** 단일 경로로 통일된다.
→ **Anthropic API 키·토큰 비용·별도 Agent Runner가 전부 불필요.**

---

## 2. 전체 구성도

```
┌─────────────────────────────────────────────────────────────┐
│                        로컬 머신                              │
│                                                              │
│   ┌──────────────┐        HTTP / SSE                         │
│   │ React + Vite │◀──────────────────────┐                  │
│   │  (대시보드)   │                        │                  │
│   └──────────────┘                        ▼                  │
│                                  ┌───────────────────┐       │
│                                  │  NestJS  :4000     │       │
│                                  │                    │       │
│                                  │  ┌──────────────┐  │       │
│                                  │  │ REST API     │  │  G1   │
│                                  │  │ SSE Gateway  │  │       │
│                                  │  └──────────────┘  │       │
│   Claude Code 세션들 ──MCP────▶  │  ┌──────────────┐  │ G3/G4 │
│   · 최초 생성(수동)               │  │ MCP Server   │  │       │
│   · 다른 프로젝트 세션            │  │ (read/write) │  │       │
│                                  │  └──────────────┘  │       │
│                                  │         │          │       │
│                                  └─────────┼──────────┘       │
│                                            ▼                  │
│                                     ┌─────────────┐           │
│                                     │  SQLite     │  G5       │
│                                     │  (Prisma)   │           │
│                                     └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

REST와 MCP는 **동일한 서비스 계층(Service Layer)**을 공유한다.
즉 `ProjectService.createIssue()` 하나를 REST 컨트롤러와 MCP 툴이 함께 호출 →
비즈니스 로직 중복 없음, 일관성 보장.

---

## 3. 데이터 모델 (Prisma / SQLite)

```prisma
// schema.prisma
datasource db {
  provider = "sqlite"
  url      = "file:./issue-board.db"
}

model Project {
  id          String   @id @default(cuid())
  name        String
  description String?
  // 외부 세션이 어떤 로컬 경로의 프로젝트인지 매칭하기 위한 키
  repoPath    String?  @unique
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  plans       Plan[]
  issues      Issue[]
  wireframes  Wireframe[]
}

model Plan {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  title       String
  // 마크다운 기획서 본문. 사용자 편집 가능(G1)
  content     String
  status      String   @default("draft") // draft | approved | archived
  version     Int      @default(1)       // 낙관적 잠금(동시성)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Issue {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  title       String
  body        String
  status      String   @default("todo")  // todo | in_progress | done | blocked
  priority    String   @default("medium")// low | medium | high
  labels      String   @default("[]")    // JSON 문자열 (SQLite는 배열 미지원)
  // 이슈 간 의존/분리 추적
  parentId    String?
  parent      Issue?   @relation("IssueTree", fields: [parentId], references: [id])
  children    Issue[]  @relation("IssueTree")
  version     Int      @default(1)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Wireframe {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name        String
  // 조회 전용(G2). 포맷 선택은 4장 참조
  format      String   @default("html")  // html | excalidraw | mermaid | svg
  content     String
  createdAt   DateTime @default(now())
  // updatedAt 없음 — 편집 대상이 아니라 재생성 대상
}
```

> `AgentJob` 모델 없음 — 생성이 백엔드 백그라운드 작업이 아니라 Claude Code 세션에서
> 일어나므로 Job 상태를 서버가 추적할 필요가 없다.

**설계 노트**
- `version` 필드로 **낙관적 잠금**: 웹 세션과 외부 세션이 같은 이슈를 동시 수정하면
  버전 불일치 시 409 반환 → 무음 덮어쓰기 방지.
- `Project.repoPath`: 외부 Claude 세션이 "지금 이 로컬 경로의 프로젝트"를
  보드의 프로젝트와 자동 매칭하는 열쇠(G4). MCP 툴이 `cwd`로 조회.
- 와이어프레임에 `version`/`updatedAt` 없음 — 상호작용 제외 원칙(G2)을 스키마로 강제.

---

## 4. 와이어프레임 포맷

조회 전용이므로 **정적 렌더 가능성**이 최우선. 후보 비교:

| 포맷 | 생성 난이도 | 렌더 | 추천 |
|------|------------|------|------|
| **HTML 조각** | 낮음 (에이전트가 잘 생성) | iframe sandbox | ✅ 1순위 |
| Excalidraw JSON | 중 | `@excalidraw/excalidraw` 뷰어 | 손그림 느낌 원하면 |
| Mermaid | 낮음 | mermaid.js | 플로우/구조도 위주면 |
| SVG | 중 | 그대로 | 세밀 제어 필요 시 |

**권장: HTML 조각 (Tailwind 인라인)**. 에이전트가 실제 레이아웃에 가까운 결과를
빠르게 만들고, `<iframe sandbox>`로 안전하게 렌더. 나중에 다른 포맷 추가 가능하도록
`format` 필드로 다형성 확보.

---

## 5. REST API (웹 UI ↔ NestJS)

```
# Projects
GET    /projects
POST   /projects
GET    /projects/:id

# Plans (G1: 상호작용 가능)
GET    /projects/:id/plans
POST   /projects/:id/plans
PATCH  /plans/:id            # If-Match: version 헤더로 낙관적 잠금
DELETE /plans/:id

# Issues (G1)
GET    /projects/:id/issues
POST   /projects/:id/issues
PATCH  /issues/:id           # 상태 변경, 편집
DELETE /issues/:id

# Wireframes (G2: 조회 전용)
GET    /projects/:id/wireframes
GET    /wireframes/:id

# 실시간 반영 (MCP 세션의 변경을 대시보드에 푸시)
GET    /events/stream        # SSE: project:updated / issue:changed 등
```

**생성 엔드포인트 없음**: 기획/와이어프레임/이슈 생성은 REST가 아니라 **MCP 툴**로
이뤄진다(6장). 백엔드에 Agent Runner나 Job 큐가 없으므로 장시간 작업 처리 로직도 불필요.

**실시간 반영 (중요)**: 외부 Claude Code 세션이 MCP write 툴로 DB를 바꾸면, 웹은
`GET /events/stream`(SSE)으로 변경 이벤트를 받아 대시보드를 즉시 갱신한다.
Service 계층에서 write가 일어날 때 이벤트를 emit → REST/MCP 어느 경로의 변경이든 동일하게 전파.

---

## 6. MCP 서버 (외부 Claude 세션 ↔ NestJS) — G4의 핵심

이슈보드가 로컬 MCP 서버를 노출하면, 다른 터미널에서 코딩 중인 Claude Code 세션이
붙어서 보드의 컨텍스트를 읽고 산출물을 갱신할 수 있다.

**노출 툴 (초안)**

| 툴 | 설명 | 방향 |
|----|------|------|
| `list_projects` | 전체 프로젝트 목록 | read |
| `get_project_context` | `repoPath`(cwd)로 프로젝트 자동 매칭 후 기획+이슈+와이어프레임 요약 반환 | read |
| `get_plan` | 특정 기획서 본문 | read |
| `list_issues` | 상태/우선순위 필터로 이슈 조회 | read |
| `get_wireframe` | 와이어프레임 조회 | read |
| `create_project` | 새 프로젝트 등록 (`repoPath` 포함) | write |
| `create_plan` | **최초 기획서 적재** (G3) | write |
| `create_wireframe` | HTML 와이어프레임 적재 (G3) | write |
| `create_issue` | 이슈 등록 (최초 분리 + 코딩 중 발견) | write |
| `update_issue_status` | `todo→in_progress→done` 상태 전이 | write |
| `append_plan_note` | 기획서에 진행 메모 추가 | write |

> **최초 생성 흐름(G3)도 이 write 툴들로 이뤄진다.** 별도의 생성 API가 없다 —
> 터미널에서 Claude Code가 `create_project → create_plan → create_wireframe →
> create_issue`를 순차 호출해 DB를 채운다.

**연동 흐름 (G4 실현 시나리오)**
```
1. 사용자가 다른 터미널에서 프로젝트 X 작업 중 Claude Code 실행
2. .mcp.json에 issue-board MCP 서버가 등록되어 있음
3. Claude가 get_project_context(cwd) 호출 → 보드의 기획/이슈를 읽음
4. 코드 작업 후 update_issue_status(issueId, "done") 호출
5. 웹 대시보드가 SSE/폴링으로 변경 감지 → 실시간 반영
```

**전송 방식**: 로컬 전용이므로 stdio 또는 HTTP(SSE) MCP 트랜스포트.
Claude Code 연동은 HTTP 방식이 `.mcp.json` 등록이 간단.

```json
// 외부 프로젝트의 .mcp.json 예시
{
  "mcpServers": {
    "issue-board": {
      "type": "http",
      "url": "http://localhost:4000/mcp"
    }
  }
}
```

---

## 7. 생성 계층 — Claude Code 세션 (G3)

**백엔드에 에이전트 실행 코드가 없다.** 생성 주체는 항상 사용자의 Claude Code 세션이다.

- **API 키·Agent SDK·토큰 비용 전부 불필요** — 사용자 구독으로 동작
- 최초 생성은 터미널에서 수동으로:
  ```
  # 프로젝트 루트에서 Claude Code 실행 후
  "이 프로젝트 기획하고 와이어프레임이랑 이슈로 분리해서 이슈보드에 올려줘"
  → Claude가 MCP 툴을 순차 호출:
     create_project(repoPath=cwd)
     → create_plan(...)        # 기획서(마크다운)
     → create_wireframe(...)   # HTML 와이어프레임
     → create_issue(...) × N   # 이슈 트리(parent/children)
  ```
- 이후 갱신(다른 세션, G4)도 **동일한 MCP 툴**을 사용 → 최초/이후가 하나의 경로로 통일

> 모든 생성·갱신이 **같은 Service 계층**(MCP 툴이 호출)을 통해 같은 DB에 쓰므로,
> 웹의 CRUD 편집과 Claude Code의 생성이 자연스럽게 하나의 보드로 수렴한다.
> 프롬프트 설계는 서버가 아니라 **CLAUDE.md / 슬래시 커맨드**로 관리하는 게 자연스럽다.

---

## 8. 동시성 / 정합성

- **낙관적 잠금**: `PATCH`는 `If-Match: <version>` 요구, 불일치 시 409.
- **실시간 반영**: 웹은 SSE로 `project:updated` 이벤트 구독 → MCP 세션의 변경이
  대시보드에 즉시 반영.
- **와이어프레임**: 편집 불가이므로 충돌 없음. 재생성 시 새 레코드 추가(이력 보존).

---

## 9. 기술 스택 확정

| 계층 | 선택 | 이유 |
|------|------|------|
| 프론트 | React + Vite + TS (SWC) | 사용자 지정 |
| 백엔드 | NestJS (:4000) | 사용자 지정 |
| DB | **SQLite + Prisma** | 로컬 전용(G5), 서버 불필요, 파일 하나 |
| 실시간 | **SSE** | 단방향 스트리밍이면 충분, WS보다 단순 |
| 생성/연동 | **MCP 서버** | 최초 생성(G3)·다른 세션 연동(G4) 모두 담당 |
| 와이어프레임 | **HTML 조각 + iframe sandbox** | 조회 전용(G2), 생성 용이 |

> **Anthropic API 키 불필요** — 생성은 사용자 Claude Code 구독으로 이뤄지므로
> 백엔드에 Agent SDK나 API 키 설정이 전혀 없다.

---

## 10. 확정된 결정 사항

- ✅ **모노레포**: **pnpm workspace** — `apps/web` + `apps/server` + `packages/shared`(타입 공유)
- ✅ **와이어프레임 포맷**: **HTML 조각 + iframe sandbox** (조회 전용). 추후 `format` 필드로 확장 여지 유지

- ✅ **생성 방식**: 터미널의 Claude Code 세션이 MCP write 툴로 적재 — **API 키 불필요**

### 남은 결정 (구현 진행하며 확정)

1. **MCP 트랜스포트**: NestJS에 `/mcp` 라우트로 붙일지, 별도 프로세스로 뺄지
   → 우선 NestJS 내장(HTTP)으로 시작, 필요 시 분리
2. **생성 프롬프트 관리**: 기획/와이어프레임/이슈분리 지침을 `CLAUDE.md` vs 슬래시 커맨드 중 어디에
3. **인증**: 로컬 전용이라 무인증? 아니면 최소한의 로컬 토큰?

## 11. 제안 디렉토리 구조 (pnpm workspace)

```
issue-board/
├── pnpm-workspace.yaml
├── package.json
├── docs/
│   └── ARCHITECTURE.md
├── packages/
│   └── shared/              # web ↔ server 공유 타입 (Plan, Issue, Job DTO 등)
│       ├── package.json
│       └── src/index.ts
└── apps/
    ├── server/             # NestJS :4000
    │   ├── prisma/schema.prisma
    │   └── src/
    │       ├── projects/   # Service 계층 (REST + MCP 공용)
    │       ├── agent/      # Agent Runner (Claude Agent SDK)
    │       ├── mcp/        # MCP 서버 (/mcp)
    │       └── sse/        # Job 스트리밍
    └── web/                # React + Vite + TS(SWC)
        └── src/
            ├── dashboard/
            ├── wireframe/  # iframe sandbox 뷰어
            └── api/
```
```
