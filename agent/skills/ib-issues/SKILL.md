---
name: ib-issues
description: 기획을 이슈 트리로 분리해 적재한다 (3단계)
---

너는 테크리드다. 보드의 기획서를 읽어 **구현 가능한 이슈 트리**로 분해하고 issue-board에
적재한다.

> 이슈 규격의 단일 원본은 [ib-shared/issue-spec.md](../ib-shared/issue-spec.md)다. 아래는 그
> 규격을 적용하는 절차이니, 제목·본문·value/effort·연동 규칙은 그 파일을 따른다.

## 진행 순서

### 1) 기획 · 와이어프레임 · 도메인 · 기존 이슈 읽기

`get_project_context(repoPath=<cwd 절대경로>)`로 기획서 · 와이어프레임 · 도메인 · **이미
등록된 이슈**를 읽는다. ([conventions.md](../ib-shared/conventions.md))

- 기획이 없으면 **중단**하고 "`/ib-plan`을 먼저 실행하세요"라고 안내하라.
- 기존 이슈가 있으면 **중복 생성하지 말고** 빠진 부분만 보강한다.
- 와이어프레임의 `data-screen` id들과 도메인 id·이름을 파악해둔다(연동에 쓴다).

**기존 이슈 링크 소급 보강**: 이미 있는 이슈 중 `planId`가 비어 있으면
`link_issue(issueId, planId=<기획 id>)`로 채운다. 화면/도메인과 명확히 연결되는데
`screenId`/`domainId`가 비어 있으면 함께 넣는다. (이미 채워진 건 건드리지 마라.)

### 2) 이슈 트리 설계 · 규격 적용

- **에픽/태스크 2단계 트리**로 분해하고, **[issue-spec.md](../ib-shared/issue-spec.md)의 정규화
  규격**(제목 `[영역] 동사구`, epic/task body 템플릿, `value`·`effort`, 구조적 연동)을 그대로 적용한다.
- 🔴 완료 조건은 반드시 `- [ ]` 체크박스 — [conventions.md](../ib-shared/conventions.md).
- **애플리케이션·이슈 키**: 모든 이슈는 앱 하나에 속하고 키(`CH-12`)가 자동 부여된다 —
  [application-model.md](../ib-shared/application-model.md).

### 3) 보드에 적재 (순서 중요)

issue-spec.md의 "적재 순서"대로: **에픽을 먼저** `create_issue(..., type="epic", applicationId)`로
만들어 각 `id`·`key`를 확보 → 하위 이슈를 `type="task"`, `parentId`(또는 `parentKey`)로 연결한다.

### 4) 보고

생성한 이슈를 **트리 형태로, 각 이슈를 키(`CH-12`)로** 요약 출력하고 안내한다: "대시보드
이슈 탭(칸반)에서 확인하세요. 이후 작업 세션은 `get_project_context`로 컨텍스트를 읽고
`update_issue_status`로 진행을 갱신합니다."

## 주의

- **코드를 구현하지 마라.** 산출물은 이슈들이다. — [conventions.md](../ib-shared/conventions.md).
- 이슈는 대시보드/다른 세션에서 편집·상태 전이되므로, 자기완결적이고 명확하게 써라.
