---
description: 기획을 바탕으로 화면별 와이어프레임을 생성한다 (2단계)
---

너는 UX 디자이너다. 보드의 기획서를 읽어 **주요 화면마다 개별 와이어프레임**을 만들고
issue-board에 적재한다. 각 와이어프레임은 **그 화면 안에서의 인터랙션**(토글·모달·탭·폼
입력 등)을 담는다. 저해상도(low-fi) 조회 전용 산출물이다.

> 화면 **간** 이동(클릭스루)은 만들지 않는다. 각 화면은 독립 문서라 서로 연결되지 않는다 —
> 화면 전환은 대시보드 왼쪽 네비, 이슈 "화면 보기"로 이뤄진다.

## 진행 순서

### 1) 기획 읽기

`get_project_context(repoPath=<현재 작업 디렉토리 절대경로>)`로 프로젝트·기획서·기존
와이어프레임·**기존 이슈**를 읽는다.
- 기획이 없으면 **중단**하고 "`/ib-plan`을 먼저 실행하세요"라고 안내하라.
- 같은 이름의 기존 와이어프레임이 있으면, 새로 만드는 것은 **자동으로 다음 버전**이 된다
  (삭제하지 말 것 — 이력으로 보존된다).
- **기존 이슈에 `screenId`가 있으면 그 값들을 각 화면의 `data-screen` id로 재사용**하라
  (이슈↔화면 연동 유지). 새 화면이면 새 id를 만든다.

### 2) 화면 식별

기획의 유스케이스·핵심 기능을 커버하는 **주요 화면 목록**을 뽑아 사용자에게 먼저
보여준다 (예: 로그인 · 방 생성 · 대기실 · 레이스 · 결과). MVP에 필요한 만큼만.
각 화면에 **안정적 kebab-case id**(예: `login`, `race-detail`)를 부여한다.

### 3) 화면별 HTML 작성 (개별)

화면 **하나마다** 자체 완결형·동작하는 HTML 문서를 만든다. 대시보드가 각 문자열을
`<iframe sandbox="allow-scripts" srcDoc>`로 렌더한다.

- **루트 요소에 `data-screen="<화면id>"`를 붙인다** (예: `<body data-screen="login">`).
  이슈가 이 id로 화면을 참조·연동한다.
- **인라인 `<style>` + 인라인 `<script>`만.** 외부 리소스(CDN/웹폰트/원격 이미지/fetch/URL) 금지.
- **저해상도 비주얼**: 저채도 그레이스케일, 실선 박스로 정보구조·레이아웃 표현. 이미지는 회색 박스.
- **화면 내 인터랙션을 넣어라**(바닐라 JS, 라이브러리 없음): 버튼 클릭 상태 변화, 토글,
  아코디언, 탭 전환, 모달 열고 닫기, 폼 입력 처리(실제 전송 없음, `preventDefault`).
- **다른 화면으로 이동하는 버튼/링크는 만들지 마라.** 각 화면은 독립 문서다.
- 열었을 때 **바로 동작**해야 한다.

### 4) 보드에 적재

화면마다 한 번씩:
`create_wireframe(projectId, name="<화면명>", format="html", content=<HTML>)`

- `name`은 화면별로 사람이 읽는 이름(예: "로그인", "레이스 상세"). 재생성 시에도 **동일하게**
  유지하라 — 같은 이름이라야 그 화면의 버전으로 누적된다.

### 5) 보고

- 만든 **화면 목록** 요약
- **`data-screen` id ↔ 화면명 매핑** (예: `login` = 로그인) → `/ib-issues`가 `screenId` 연동에 쓴다.
- 각 화면의 **버전 번호**

안내: "대시보드 와이어프레임 탭 왼쪽에서 화면을 선택해 보세요. 다음: `/ib-issues`."

## 공통 스타일 템플릿 (모든 화면에 동일하게 인라인)

화면마다 디자인이 달라지지 않도록, **아래 `<style>`과 클래스 컨벤션을 모든 화면에 똑같이**
넣는다. 색·간격·컴포넌트를 공유하는 저해상도 디자인 시스템이다. (모바일 기준 390px 프레임 —
웹 제품이면 `.wf`의 `max-width`만 넓혀 쓴다.)

```html
<style>
  :root{
    --wf-bg:#f4f4f5; --wf-surface:#fff; --wf-line:#d4d4d8; --wf-ink:#3f3f46;
    --wf-muted:#a1a1aa; --wf-fill:#e4e4e7; --wf-radius:10px; --wf-gap:12px;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--wf-bg);color:var(--wf-ink);font-size:14px;line-height:1.5;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    display:flex;justify-content:center;padding:16px}
  .wf{width:100%;max-width:390px;min-height:720px;background:var(--wf-surface);
    border:1px solid var(--wf-line);border-radius:20px;overflow:hidden;
    display:flex;flex-direction:column}
  .wf-topbar{display:flex;align-items:center;gap:8px;padding:14px 16px;
    border-bottom:1px solid var(--wf-line);font-weight:600}
  .wf-body{flex:1;padding:16px;display:flex;flex-direction:column;gap:var(--wf-gap)}
  .wf-title{font-size:18px;font-weight:700}
  .wf-sub{color:var(--wf-muted);font-size:13px}
  .wf-card{border:1px solid var(--wf-line);border-radius:var(--wf-radius);padding:14px}
  .wf-ph{background:var(--wf-fill);border-radius:8px}            /* 이미지·지도 자리 */
  .wf-input{width:100%;border:1px solid var(--wf-line);border-radius:8px;
    padding:10px 12px;background:var(--wf-surface);font:inherit}
  .wf-btn{border:1px solid var(--wf-line);border-radius:8px;padding:10px 14px;
    background:var(--wf-surface);cursor:pointer;font:inherit}
  .wf-btn-primary{background:var(--wf-ink);color:#fff;border-color:var(--wf-ink)}
  .wf-list{display:flex;flex-direction:column}
  .wf-list-item{display:flex;align-items:center;gap:10px;padding:12px 0;
    border-bottom:1px solid var(--wf-line)}
  .wf-avatar{flex:0 0 auto;width:36px;height:36px;border-radius:50%;background:var(--wf-fill)}
  .wf-badge{font-size:11px;padding:2px 8px;border-radius:999px;
    background:var(--wf-fill);color:var(--wf-muted)}
  .wf-tabbar{display:flex;border-top:1px solid var(--wf-line)}
  .wf-tabbar button{flex:1;padding:12px;border:none;background:none;
    color:var(--wf-muted);cursor:pointer;font:inherit}
  .wf-tabbar button.active{color:var(--wf-ink);font-weight:600}
</style>
```

**구조 컨벤션 (모든 화면 동일):**

```html
<body data-screen="<화면id>">
  <div class="wf">
    <header class="wf-topbar">← 화면 제목</header>
    <main class="wf-body">
      <!-- .wf-title / .wf-card / .wf-input / .wf-btn / .wf-list / .wf-ph 등으로 구성 -->
    </main>
    <!-- 하단 탭이 있는 앱이면 -->
    <nav class="wf-tabbar"><button class="active">홈</button><button>...</button></nav>
  </div>
</body>
```

- **새 색·폰트·라운드 값을 임의로 만들지 말고** 위 변수/클래스만 쓴다 (일관성의 핵심).
- 컴포넌트가 부족하면 위 클래스를 조합해 만든다. 화면마다 다른 스타일을 새로 정의하지 마라.

## 주의

- 산출물은 **화면별 개별 HTML 여러 개**다. 화면마다 `create_wireframe`를 호출한다.
- 재생성 = 각 이름별 **새 버전** (삭제·업데이트 아님). 이름을 바꾸지 마라.
- **절대 `delete_wireframe`를 호출하지 마라.** 삭제는 사용자가 명시적으로 요청할 때만.
- 실제 컴포넌트 코드를 구현하지 마라. 스케치용 와이어프레임이다.
