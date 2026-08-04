---
name: ib-generate
description: 기획→도메인→와이어프레임→이슈를 한 번에 순차 생성한다 (오케스트레이터)
argument-hint: <프로젝트 아이디어 한두 문장>
---

너는 프로덕트 리드다. 아이디어 하나로 **기획 → 도메인 → 와이어프레임 → 이슈 분리 → 기획
확정**까지 수행해 issue-board에 적재한다. 각 단계 사이에 사용자 확인 체크포인트를 둔다.

이 커맨드는 `/ib-plan` → `/ib-domain` → `/ib-wireframe` → `/ib-issues`를 이어서 돌린 뒤,
마지막에 `/ib-plan`의 "버전 확정"까지 해주는 것과 같다(확정해야 개발을 시작할 수 있다).
**각 단계의 상세 규격은 아래 링크한 [ib-shared](../ib-shared/SKILL.md) 스펙을 그대로
따른다** (여기서 규격을 다시 요약하지 않는다 — 단일 원본을 인용한다). 단계별로 따로 돌리고
싶으면 개별 스킬을 쓰면 된다.

## 아이디어

$ARGUMENTS

## 전제

- 공통 전제(MCP 연결·cwd·프로젝트 매칭)는 [conventions.md](../ib-shared/conventions.md).
- 시작 전 `get_project_context(repoPath=<cwd 절대경로>)`로 이미 등록됐는지 본다. 기획/이슈가
  있으면 사용자에게 새로 만들지·이어서 보강할지 물어라.

## 0단계 — 애플리케이션(전달 표면) 결정

[application-model.md](../ib-shared/application-model.md)를 따라 이 작업이 속할 앱을 정한다.
**첫 앱이면 접두사를 묻지 말고 자동으로 정한 뒤 통보**하고, 이미 앱이 있는데 새 표면을
추가하는 경우에만 `AskUserQuestion`으로 묻는다. 확보한 `applicationId`를 이후 create_plan ·
create_wireframe · create_issue에 모두 넘긴다(도메인은 앱 공유이므로 제외).

## 1단계 — 기획

- [plan-spec.md](../ib-shared/plan-spec.md)의 9섹션 템플릿·**언어 규칙(유비쿼터스 언어)**으로
  한국어 기획서를 작성한다.
  작성 전 `AskUserQuestion`으로 **최소 5개, 최대 10개**의 명확화 질문을 한다(스코프/플랫폼/
  제약/권한구조/도메인규칙/외부연동/운영·리포팅 축). `AskUserQuestion`은 한 번에 4개까지
  담기므로 **여러 번 나눠 호출**한다 — 상세는 [ib-plan](../ib-plan/SKILL.md) 1)절.
- 적재: `create_project`(없으면) → `create_plan(projectId, title, content, applicationId)`.

**▶ 체크포인트 1**: 기획 요약을 보여주고 `AskUserQuestion` — "① 다음 단계 / ② 수정 후 진행 /
③ 멈춤". ②면 `update_plan`으로 갱신 후 재확인, ③이면 종료.

## 2단계 — 도메인

- 핵심 엔티티/테이블을 도출해 컬럼 배열 `{name(camelCase), type, constraints?, description?}`로
  구성한다. 관계는 `constraints`에 `FK→대상엔티티`. 상태 엔티티면 `lifecycle`도 정의.
- 🔴 **시간 컬럼**: `createdAt`·`updatedAt`·`deletedAt`만 `xxxAt`(datetime), 나머지 시간 컬럼은
  **`xxxOn` + `type: "string"`** (예: `startedOn`) — [ib-domain](../ib-domain/SKILL.md)의 2-1 규칙.
- `create_domain(projectId, name, description, columns, lifecycle?)` — status 생략(draft), 이름 upsert.
  **도메인은 앱 공유이므로 `applicationId`를 주지 않는다.**
- **도메인 id ↔ 이름 매핑을 기억**해 4단계 `domainId` 연동에 쓴다.

**▶ 체크포인트 2**: 도출한 도메인/컬럼을 표로 보여주고 ①/②/③을 묻는다.

## 3단계 — 와이어프레임 (화면별 개별)

- 기획의 유스케이스를 커버하는 주요 화면을 뽑아 IA 순서로 `sequence`를 매기고, 각 화면에
  안정적 kebab-case id(`data-screen`)를 부여한다 (MVP만큼만).
- **2단계에서 정한 도메인 용어·컬럼을 화면의 항목명에 그대로 쓴다** — 같은 대상을 화면마다
  다른 이름으로 부르지 않는다.
- **화면마다 개별 HTML**을 [wireframe-style.md](../ib-shared/wireframe-style.md)의 공통 스타일·
  인터랙션 스크립트를 인라인해 만든다. 🔴 그 문서의 **"인터랙션 규칙" 표를 화면마다 적용한다**
  — 누를 수 있는 것은 전부 반응해야 한다(이동 버튼은 `wfGo` 토스트, 되돌릴 수 없는 동작은 확인
  다이얼로그, 폼은 검증 표시, 목록은 빈 상태). 화면 간 실제 이동은 만들지 않는다(독립 문서).
- 적재: 화면마다 `create_wireframe(projectId, name, format="html", content, sequence, applicationId)`.
- **`data-screen` id ↔ 화면명 매핑을 기억**해 4단계 `screenId` 연동에 쓴다. 적재 응답의
  `screens`가 서버가 인식한 화면 id다 — 4단계에서 그 값만 `screenId`로 쓸 수 있다.

**▶ 체크포인트 3**: 만든 화면 목록을 보여주고 ①/②/③을 묻는다.

## 4단계 — 이슈 분리

- 기획을 에픽/태스크 2단계 트리로 분해하고 **[issue-spec.md](../ib-shared/issue-spec.md)의
  정규화 규격을 그대로 따른다** (제목·본문·`value`·`effort`·구조적 연동, 완료조건 `- [ ]`).
  핵심 기능뿐 아니라 **비기능 요구사항·테스트 시나리오도 빠뜨리지 않는다** — issue-spec.md의
  "기획서 어디에서 이슈가 나오는가".
- 🔴 **태스크는 포지션을 섞지 않는다** — 프론트/백이 섞였으면 쪼개고 `front`/`back` 라벨을
  하나씩 붙인다(에픽엔 붙이지 않는다). issue-spec.md의 "포지션 분리".
- **이미 이슈가 있으면 중복 생성하지 말고 빠진 부분만 보강한다.** 기존 이슈에 `planId`·
  `screenId`·`domainId`가 비어 있으면 `link_issue`로 소급해 채운다(이미 채워진 건 그대로).
- 적재 순서: **에픽 먼저**(`type="epic"`) 생성해 `id`·`key` 확보 → 하위 이슈를 `type="task"`,
  `parentId`로 연결.
- 🔴 **모든 이슈에 `applicationId`(0단계)와 `planId`(1단계)를 넣는다.** `planId`가 없으면 그
  이슈는 5단계 확정 이후에도 **착수할 수 없다**(기획 확정 가드는 예외가 없다). 화면·도메인에
  해당하면 `screenId`·`domainId`도 함께 넣는다.

**▶ 체크포인트 4**: 만든 이슈 트리를 키(`CH-12`)와 함께 보여주고 ①/②/③을 묻는다.
(가장 많은 레코드가 생기는 단계다. 삭제는 번거로우니 여기서 한 번 확인받는다.)

## 5단계 — 기획 확정 (착수 게이트)

기획이 `approved`가 아니면 **모든 이슈가 착수 불가**다. 서버가 `in_progress`/`done` 전이를
거부한다 — 여기까지 만들어 놓고 확정하지 않으면 개발을 시작할 수 없다.

- `AskUserQuestion`으로 묻는다: "**지금 기획을 확정할까요?** ① 확정하고 개발 시작 /
  ② 초안으로 두고 대시보드에서 더 검토".
- ①이면 `update_plan(planId, status="approved")` — 그 시점이 자동으로 마일스톤 버전이 된다.
  **도메인도 함께 확정한다**: 각 도메인에 `create_domain(..., status="approved")`(같은 이름
  upsert). 기획이 확정됐는데 도메인만 초안으로 남으면 대시보드 표기가 어긋난다.
- ②면 기획·도메인 모두 초안으로 두고, **최종 보고에 "확정 전까지 이슈를 착수할 수 없다"는
  것과 확정 방법을 반드시 밝힌다.**

## 최종 보고

`projectId`, 기획/도메인/와이어프레임 개수, **이슈 트리 요약(각 이슈를 키 `CH-12`로)**, 그리고
**기획 상태(확정/초안)**를 출력한다.

- 확정했으면: "대시보드(http://localhost:5173)에서 확인하세요. 이후 개발 세션은
  `get_project_context`로 맥락을 읽고 `update_issue_status`로 진행을 갱신합니다."
- 초안으로 뒀으면: "기획이 아직 **초안**이라 이슈를 착수할 수 없습니다. 대시보드 기획 탭에서
  상태를 **확정(approved)**으로 바꾸거나 `/ib-plan`으로 확정한 뒤 개발을 시작하세요."

## 주의

- 전 단계에서 **코드를 구현하지 않는다**. 산출물은 기획·도메인·와이어프레임·이슈다.
- 체크포인트에서 '멈춤'을 고르면 그 지점까지의 산출물은 보드에 남는다(개별 스킬로 재개 가능).
  이때 **5단계(기획 확정)를 건너뛰게 되므로, 멈출 때도 "기획이 초안이라 이슈를 착수할 수
  없다"는 것과 확정 방법을 반드시 알려라.**
