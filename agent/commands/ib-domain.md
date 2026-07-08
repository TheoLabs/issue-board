---
description: 도메인(엔티티/테이블)을 정의해 표로 정리하고 이슈보드에 적재한다
argument-hint: <도메인 정의와 컬럼 설명 (없으면 기획에서 추론)>
---

너는 데이터 모델러다. 사용자가 준 도메인 정의(또는 기획서)를 읽어 **엔티티/테이블을
컬럼 단위로 구조화**하고 issue-board에 적재한다. 대시보드에서 표로 렌더된다.

## 입력

$ARGUMENTS

## 진행 순서

### 1) 컨텍스트 읽기

`get_project_context(repoPath=<현재 작업 디렉토리 절대경로>)`로 프로젝트·기획·기존
도메인을 읽는다.
- 프로젝트가 없으면 `create_project(name, description, repoPath=<cwd 절대경로>)`로 만든다.
- 입력이 비어 있으면 기획서에서 핵심 엔티티를 추론하되, 확실치 않으면 사용자에게 묻는다.

### 2) 도메인 구조화

각 도메인(엔티티)마다:
- **name**: 엔티티명 (예: `User`, `Race`, `Room`)
- **description**: 이 엔티티가 무엇인지 한 줄
- **columns**: 컬럼 배열, 각 컬럼은
  - `name`: 컬럼명 — **반드시 camelCase**로 짓는다 (예: `userId`, `startedAt`,
    `passwordHash`, `roomId`). snake_case(`user_id`) 쓰지 마라.
  - `type`: 타입 (예: `int`, `string`, `datetime`, `boolean`, `enum(...)`).
    **PK 컬럼의 타입은 기본 `int`**로 한다 (특별한 이유가 없으면). FK 컬럼도 참조하는
    PK와 타입을 맞춘다 (int PK를 가리키면 FK도 `int`).
  - `constraints`: 제약 표기 (예: `PK`, `FK→User`, `NN`, `UQ`, `default: now()`).
    복합 유니크의 컬럼 참조도 camelCase (예: `UQ(roomId,userId)`).
  - `description`: 설명(선택)
- **관계(FK) 표기는 반드시 `FK→대상엔티티` 형식으로 고정하라** (대상은 다른 도메인의
  `name`과 정확히 일치). 대시보드가 이 표기를 파싱해 **ERD를 자동으로 그린다** — 별도의
  다이어그램을 만들 필요 없다. 표기가 어긋나면 ERD 관계선이 안 그려진다.
  - 예: `Room` 도메인의 `ownerId` 컬럼 constraints = `FK→User` → ERD에 Room→User 연결선.

### 2-1) 생명주기(상태 흐름) 정의 — 상태를 갖는 엔티티만

엔티티에 **상태 컬럼**(예: `status`, `state`가 `enum(...)`)이 있으면, 그 상태들이 어떤
순서로/무슨 이벤트로 전이되는지 **생명주기(lifecycle)**를 함께 정의하라. 대시보드가 이걸
**mermaid 상태 흐름도(stateDiagram)**로 자동 렌더한다 — mermaid 문법을 직접 쓰지 말고
아래 구조만 채우면 된다.

- **states**(선택): `[{ name, description? }]` — 상태 목록. 설명이나 순서를 남기고 싶을 때.
- **transitions**(필수): `[{ from, to, on? }]`
  - `from`/`to`: 상태명. `enum(...)`의 값과 정확히 일치시켜라.
  - **초기 진입**은 `from: "[*]"`, **종료**는 `to: "[*]"`로 표기한다.
  - `on`: 전이를 유발하는 이벤트/액션 라벨 (예: `승인`, `결제`, `취소`).
- 예: `Order` 엔티티 `status enum(pending,paid,shipped,cancelled)` →
  ```
  transitions: [
    { from: "[*]",     to: "pending"   },
    { from: "pending", to: "paid",      on: "결제" },
    { from: "pending", to: "cancelled", on: "취소" },
    { from: "paid",    to: "shipped",   on: "배송" },
    { from: "shipped", to: "[*]" },
  ]
  ```
- 상태가 없는 순수 참조/조인 엔티티는 lifecycle을 **생략**하라 (억지로 만들지 마라).

### 3) 적재 (upsert)

도메인마다 `create_domain(projectId, name, description, columns, lifecycle?)`.
- **status는 생략**한다 → 첫 설계는 자동으로 **`draft`(초안)**으로 저장되고 대시보드에
  "초안" 배지가 붙는다. (확정 요청을 받았을 때만 status="approved".)
- **lifecycle**은 상태를 갖는 엔티티에만 넣는다. 재호출 시 **생략하면 기존 생명주기가
  유지**되고, 명시적으로 `null`을 주면 제거된다.
- 이름 기준 **upsert**라 같은 이름으로 다시 호출하면 갱신된다 (중복 생성 아님).

### 4) 보고

정리한 도메인과 컬럼 수를 **표 형태로** 요약하고(생명주기를 넣은 엔티티는 표시), 안내한다:
"대시보드 도메인 탭에서 확인하세요 (초안). ERD와 상태 흐름도가 자동으로 그려집니다.
이슈와 연동하려면 `/ib-issues`를 실행하면 관련 이슈에 도메인이 연결됩니다."

## 주의

- 산출물은 도메인 정의다. **코드(마이그레이션/엔티티 클래스)를 구현하지 마라.**
- 삭제는 사용자가 명시적으로 요청할 때만. **`delete_domain`을 임의로 호출하지 마라.**
