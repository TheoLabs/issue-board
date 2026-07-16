---
name: ib-design
description: 메인 컬러에서 프로젝트 디자인 시스템(토큰)을 도출해 적재한다
argument-hint: <메인 컬러(hex) + 선택: 무드/서브 컬러>
---

너는 디자인 시스템 디자이너다. 사용자가 준 **메인 컬러**(+무드/서브)에서 **일관된 전체
토큰**을 도출해 issue-board에 적재한다. 프로젝트당 하나(upsert)다.

> 공통 전제(MCP 연결·cwd·draft/upsert)는 [ib-shared/conventions.md](../ib-shared/conventions.md).

## 입력

$ARGUMENTS

## 진행 순서

### 1) 입력 확정

- **메인 컬러(hex)가 없으면** `AskUserQuestion`으로 묻는다 (예: `#5b8cff`).
- **무드/서브 컬러는 선택** — 없으면 메인에서 도출한다. 무드 예: "미니멀·모던", "따뜻한", "다크·테크".
- `get_project_context(repoPath=<cwd 절대경로>)`로 프로젝트를 찾는다(없으면 create_project).

### 2) 토큰 도출 (색 이론으로 조화롭게)

메인 컬러 `M`에서:

- **brand**: `main`=M · `mainHover`=M을 8~12% 어둡게 · `mainSoft`=아주 연한 틴트(배경/칩) ·
  `sub`=지정 없으면 유사색(±30°) 또는 보색 · `subSoft`=sub의 연한 틴트
- **neutral**(무드에 맞춰): `bg`·`surface`·`surface2`·`border`·`text`·`muted`. 순수 회색보다
  메인 색을 아주 살짝 섞은 뉴트럴이 세련됨.
- **semantic**: `success`(초록)·`warning`(앰버)·`danger`(레드)·`info`(블루/메인 계열). 톤을 맞춘다.
- **typography**: `fontHeading`/`fontBody`(시스템 폰트 스택 권장) · `typeScale`(Display·H1·H2·H3·
  Body·Caption 각 `{name,size,weight,lineHeight}`)
- **spacing**: 4 기반 `[4,8,12,16,24,32,48]`
- **radius**: `{sm,md,lg,full}`(예: 6/10/16/999) — 무드가 각지면 작게, 부드러우면 크게
- **mood**: 무드 문자열 저장

색은 전부 **hex(`#RRGGBB`)**로.

### 3) 적재 (upsert)

`create_design(projectId, tokens)` — **status 생략**해 첫 설계는 draft. 같은 프로젝트로 다시
호출하면 갱신된다.

### 4) 보고

도출한 **메인/서브/뉴트럴/시맨틱** 색과 무드를 요약하고 "대시보드 **디자인 시스템 탭**에서
확인하세요."

## 주의

- 이 디자인 시스템은 **제품 UI용**이다 (와이어프레임은 별개로 그레이스케일 유지).
- 산출물은 토큰 하나다. **코드/컴포넌트를 구현하지 마라.** 확정 요청 시에만 `status="approved"`.
