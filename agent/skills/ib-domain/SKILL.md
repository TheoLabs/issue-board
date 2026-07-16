---
name: ib-domain
description: 도메인(엔티티/테이블)을 정의해 표로 정리하고 이슈보드에 적재한다
argument-hint: <도메인 정의와 컬럼 설명 (없으면 기획에서 추론)>
---

너는 데이터 모델러다. 사용자가 준 도메인 정의(또는 기획서)를 읽어 **엔티티/테이블을 컬럼
단위로 구조화**하고 issue-board에 적재한다. 대시보드에서 표·ERD·상태흐름도로 렌더된다.

> 공통 전제(MCP 연결·cwd·draft/upsert)는 [ib-shared/conventions.md](../ib-shared/conventions.md).
> **도메인은 앱 공유**라 `applicationId`를 주지 않는다 — [application-model.md](../ib-shared/application-model.md).

## 입력

$ARGUMENTS

## 진행 순서

### 1) 컨텍스트 읽기

`get_project_context(repoPath=<cwd 절대경로>)`로 프로젝트·기획·기존 도메인을 읽는다(없으면
`create_project`). 입력이 비면 기획서에서 핵심 엔티티를 추론하되, 확실치 않으면 사용자에게 묻는다.

### 2) 도메인 구조화

각 도메인(엔티티)마다:
- **name**: 엔티티명 (예: `User`, `Race`, `Room`)
- **description**: 이 엔티티가 무엇인지 한 줄
- **columns**: 컬럼 배열
  - `name`: **반드시 camelCase** (예: `userId`, `startedAt`, `passwordHash`). snake_case 금지.
  - `type`: 예: `int`, `string`, `datetime`, `boolean`, `enum(...)`. **PK 타입은 기본 `int`**,
    FK는 참조 PK와 타입을 맞춘다.
  - `constraints`: 예: `PK`, `FK→User`, `NN`, `UQ`, `default: now()`. 복합 유니크 컬럼 참조도
    camelCase (예: `UQ(roomId,userId)`).
  - `description`: 선택
- **관계(FK)는 반드시 `FK→대상엔티티` 형식**(대상은 다른 도메인 `name`과 정확히 일치).
  대시보드가 이 표기를 파싱해 **ERD를 자동으로 그린다**. 표기가 어긋나면 관계선이 안 그려진다.

### 2-1) 생명주기(상태 흐름) — 상태를 갖는 엔티티만

상태 컬럼(`status`/`state`가 `enum(...)`)이 있으면 `lifecycle`을 정의한다. 대시보드가 mermaid
상태 흐름도로 자동 렌더한다(문법 직접 쓰지 말고 구조만 채운다).

- **states**(선택): `[{ name, description? }]`
- **transitions**(필수): `[{ from, to, on? }]` — 초기 진입 `from:"[*]"`, 종료 `to:"[*]"`,
  `on`은 전이 이벤트 라벨(예: `승인`, `결제`). `from`/`to`는 `enum(...)` 값과 정확히 일치.
- 상태 없는 순수 참조/조인 엔티티는 lifecycle을 **생략**하라(억지로 만들지 마라).

### 3) 적재 (upsert)

도메인마다 `create_domain(projectId, name, description, columns, lifecycle?)`.
- **status 생략** → 첫 설계는 `draft`(초안). 이름 기준 upsert.
- **lifecycle**은 상태 엔티티에만. 재호출 시 생략하면 기존 유지, `null`을 주면 제거.

### 4) 보고

정리한 도메인·컬럼 수를 표로 요약하고(생명주기 넣은 엔티티 표시) 안내한다: "대시보드 도메인
탭에서 확인하세요(초안). ERD·상태 흐름도가 자동으로 그려집니다. `/ib-issues`를 실행하면 관련
이슈에 도메인이 연결됩니다."

## 주의

- 산출물은 도메인 정의다. **코드(마이그레이션/엔티티 클래스)를 구현하지 마라.**
- **`delete_domain`을 임의로 호출하지 마라.** — [conventions.md](../ib-shared/conventions.md).
