---
name: ib-domain
description: 도메인(엔티티/테이블)을 정의해 표로 정리하고 이슈보드에 적재한다 (2단계)
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
`create_project`).

🔴 **용어는 언제나 기획서 `## 3. 핵심 개념 (용어 사전)` 표를 따른다** — 사용자가 도메인을
직접 준 경우에도 마찬가지다. 같은 대상을 기획서와 다른 이름으로 부르지 마라. 기획서에 없는
개념을 새로 만들었으면 사용자에게 알리고 기획서에도 반영하도록 안내한다.

입력이 비면 그 용어 사전 표를 **1순위 입력**으로 삼아 엔티티를 도출한다(각 행이 엔티티 후보).
표가 비어 있거나 부실하면 기능·유스케이스에서 추론하되, **추론한 개념은 사용자에게 확인받는다.**

### 2) 도메인 구조화

각 도메인(엔티티)마다:
- **name**: 엔티티명 (예: `User`, `Race`, `Room`)
- **description**: 이 엔티티가 무엇인지 한 줄
- **columns**: 컬럼 배열
  - `name`: **반드시 camelCase** (예: `userId`, `startedOn`, `passwordHash`). snake_case 금지.
    시간 컬럼은 아래 "시간 컬럼 규칙"을 따른다.
  - `type`: 예: `int`, `string`, `datetime`, `boolean`, `enum(...)`. **PK 타입은 기본 `int`**,
    FK는 참조 PK와 타입을 맞춘다.
  - `constraints`: 예: `PK`, `FK→User`, `NN`, `UQ`, `default: now()`. 복합 유니크 컬럼 참조도
    camelCase (예: `UQ(roomId,userId)`).
  - `description`: 선택
- **관계(FK)는 반드시 `FK→대상엔티티` 형식**(대상은 다른 도메인 `name`과 정확히 일치).
  대시보드가 이 표기를 파싱해 **ERD를 자동으로 그린다**. 표기가 어긋나면 관계선이 안 그려진다.

### 2-1) 시간 컬럼 규칙 (🔴 필수)

- `createdAt` · `updatedAt` · `deletedAt` **3개만 `xxxAt`** 이고, 타입은 `datetime`을 쓴다
  (표준 감사 컬럼).
- **그 밖의 모든 시간 기준 컬럼은 `xxxOn`** 으로 이름 짓고, **`type`은 반드시 `string`** 으로
  명시한다.
  - 예: `startedOn`(string), `endedOn`(string), `publishedOn`(string), `expiredOn`(string),
    `paidOn`(string), `dueOn`(string).
  - `startAt` · `expiresAt` · `start_date` 같은 표기 금지 — 위 3개 외에 `xxxAt`을 쓰지 마라.
  - 위 3개를 제외한 시간 컬럼에 `datetime` · `timestamp` · `date` 타입을 쓰지 마라. 항상
    `string`(ISO 8601 문자열)이다.

### 2-2) 생명주기(상태 흐름) — 상태를 갖는 엔티티만

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
탭에서 확인하세요(초안). ERD·상태 흐름도가 자동으로 그려집니다. 다음: `/ib-wireframe` →
`/ib-issues`. `/ib-issues`를 실행하면 관련 이슈에 도메인이 연결됩니다."

## 주의

- 산출물은 도메인 정의다. **코드(마이그레이션/엔티티 클래스)를 구현하지 마라.**
- **`delete_domain`을 임의로 호출하지 마라.** — [conventions.md](../ib-shared/conventions.md).
