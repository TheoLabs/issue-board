---
name: ib-generate
description: 기획→와이어프레임→도메인→이슈를 한 번에 순차 생성한다 (오케스트레이터)
argument-hint: <프로젝트 아이디어 한두 문장>
---

너는 프로덕트 리드다. 아이디어 하나로 **기획 → 와이어프레임 → 도메인 → 이슈 분리**를
순서대로 수행해 issue-board에 적재한다. 각 단계 사이에 사용자 확인 체크포인트를 둔다.

이 커맨드는 `/ib-plan` → `/ib-wireframe` → `/ib-domain` → `/ib-issues`를 이어서 수행하는 것과
같다. **각 단계의 상세 규격은 아래 링크한 [ib-shared](../ib-shared/SKILL.md) 스펙을 그대로
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
없으면 새 앱을 만들되 **접두사를 `AskUserQuestion`으로 반드시 묻는다.** 확보한 `applicationId`를
이후 create_plan · create_wireframe · create_issue에 모두 넘긴다(도메인은 제외).

## 1단계 — 기획

- [plan-spec.md](../ib-shared/plan-spec.md)의 8섹션 템플릿으로 한국어 기획서를 작성한다.
  아이디어가 **모호할 때만** `AskUserQuestion`으로 최대 3개(스코프/플랫폼/제약) 묻는다.
- 적재: `create_project`(없으면) → `create_plan(projectId, title, content, applicationId)`.

**▶ 체크포인트 1**: 기획 요약을 보여주고 `AskUserQuestion` — "① 다음 단계 / ② 수정 후 진행 /
③ 멈춤". ②면 `update_plan`으로 갱신 후 재확인, ③이면 종료.

## 2단계 — 와이어프레임 (화면별 개별)

- 기획의 유스케이스를 커버하는 주요 화면을 뽑아 IA 순서로 `sequence`를 매기고, 각 화면에
  안정적 kebab-case id(`data-screen`)를 부여한다 (MVP만큼만).
- **화면마다 개별 HTML**을 [wireframe-style.md](../ib-shared/wireframe-style.md)의 공통 스타일을
  인라인해 만든다. 화면 간 이동은 만들지 않는다(각 화면 독립 문서).
- 적재: 화면마다 `create_wireframe(projectId, name, format="html", content, sequence, applicationId)`.
- **`data-screen` id ↔ 화면명 매핑을 기억**해 4단계 `screenId` 연동에 쓴다.

**▶ 체크포인트 2**: 만든 화면 목록을 보여주고 ①/②/③을 묻는다.

## 3단계 — 도메인

- 핵심 엔티티/테이블을 도출해 컬럼 배열 `{name(camelCase), type, constraints?, description?}`로
  구성한다. 관계는 `constraints`에 `FK→대상엔티티`. 상태 엔티티면 `lifecycle`도 정의.
- `create_domain(projectId, name, description, columns, lifecycle?)` — status 생략(draft), 이름 upsert.
  **도메인은 앱 공유이므로 `applicationId`를 주지 않는다.**
- **도메인 id ↔ 이름 매핑을 기억**해 4단계 `domainId` 연동에 쓴다.

**▶ 체크포인트 3**: 도출한 도메인/컬럼을 표로 보여주고 ①/②/③을 묻는다.

## 4단계 — 이슈 분리

- 기획을 에픽/태스크 2단계 트리로 분해하고 **[issue-spec.md](../ib-shared/issue-spec.md)의
  정규화 규격을 그대로 따른다** (제목·본문·`value`·`effort`·구조적 연동, 완료조건 `- [ ]`).
- 적재 순서: **에픽 먼저**(`type="epic"`) 생성해 `id`·`key` 확보 → 하위 이슈를 `type="task"`,
  `parentId`로 연결. **모든 이슈에 0단계의 `applicationId`를 넣는다**(키가 자동 부여됨).

## 최종 보고

`projectId`, 기획/와이어프레임/도메인 개수, **이슈 트리 요약(각 이슈를 키 `CH-12`로)**을 출력하고
안내한다: "대시보드(http://localhost:5173)에서 확인하세요. 이후 개발 세션은 `get_project_context`로
맥락을 읽고 `update_issue_status`로 진행을 갱신합니다."

## 주의

- 전 단계에서 **코드를 구현하지 않는다**. 산출물은 기획·와이어프레임·도메인·이슈다.
- 체크포인트에서 '멈춤'을 고르면 그 지점까지의 산출물은 보드에 남는다(개별 스킬로 재개 가능).
