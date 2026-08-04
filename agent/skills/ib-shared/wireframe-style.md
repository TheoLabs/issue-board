# 와이어프레임 공통 스타일 (모든 화면에 동일 인라인)

화면마다 디자인이 달라지지 않도록, **아래 `<style>`과 클래스 컨벤션을 모든 화면에 똑같이**
인라인한다. 색·간격·컴포넌트를 공유하는 저해상도(low-fi) 디자인 시스템이다. (모바일 기준
390px 프레임 — 웹 제품이면 `.wf`의 `max-width`만 넓혀 쓴다.)

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
  /* 다이얼로그 — 확인·삭제·선택 등 화면 안에서 열리는 모달 */
  .wf-dim{position:absolute;inset:0;background:rgb(0 0 0 / 35%);
    display:none;align-items:center;justify-content:center;padding:24px}
  .wf-dim[open]{display:flex}
  .wf-dialog{background:var(--wf-surface);border-radius:var(--wf-radius);
    padding:18px;width:100%;max-width:300px;display:flex;flex-direction:column;gap:12px}
  .wf-dialog-actions{display:flex;gap:8px;justify-content:flex-end}
  /* 토스트 — 화면 전환 의도·완료 알림 (실제 이동은 하지 않는다) */
  .wf-toast{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);
    background:var(--wf-ink);color:#fff;padding:10px 14px;border-radius:999px;
    font-size:12px;opacity:0;transition:opacity .2s;pointer-events:none;white-space:nowrap}
  .wf-toast.show{opacity:1}
  /* 상태 표현 */
  .wf-empty{padding:32px 0;text-align:center;color:var(--wf-muted)}
  .wf-error{color:#b91c1c;font-size:12px}
  .wf-input[aria-invalid='true']{border-color:#b91c1c}
</style>
```

**인터랙션 스크립트 (필요한 화면에 인라인):**

```html
<script>
  // 화면 전환 의도: 실제로 이동하지 않고 어디로 가는지만 보여 준다.
  // (각 화면은 독립 문서이고 iframe이 sandbox="allow-scripts"라 이동 자체가 불가능하다.)
  function wfGo(label) {
    const t = document.querySelector('.wf-toast');
    t.textContent = '→ ' + label + '(으)로 이동';
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 1400);
  }
  function wfOpen(id) { document.getElementById(id).setAttribute('open', ''); }
  function wfClose(id) { document.getElementById(id).removeAttribute('open'); }
</script>
```

**구조 컨벤션 (모든 화면 동일):**

```html
<body data-screen="<화면id>">
  <div class="wf" style="position:relative">
    <header class="wf-topbar">← 화면 제목</header>
    <main class="wf-body">
      <!-- .wf-title / .wf-card / .wf-input / .wf-btn / .wf-list / .wf-ph 등으로 구성 -->
      <button class="wf-btn wf-btn-primary" onclick="wfGo('대기실')">참가</button>
    </main>
    <!-- 하단 탭이 있는 앱이면 -->
    <nav class="wf-tabbar"><button class="active">홈</button><button>...</button></nav>
    <!-- 다이얼로그·토스트는 .wf 안에 둔다 (position:relative 기준으로 덮는다) -->
    <div class="wf-dim" id="confirm">
      <div class="wf-dialog">
        <div class="wf-title">참가할까요?</div>
        <div class="wf-dialog-actions">
          <button class="wf-btn" onclick="wfClose('confirm')">취소</button>
          <button class="wf-btn wf-btn-primary" onclick="wfClose('confirm');wfGo('대기실')">참가</button>
        </div>
      </div>
    </div>
    <div class="wf-toast"></div>
  </div>
</body>
```

- **새 색·폰트·라운드 값을 임의로 만들지 말고** 위 변수/클래스만 쓴다 (일관성의 핵심).
- 컴포넌트가 부족하면 위 클래스를 조합해 만든다. 화면마다 다른 스타일을 새로 정의하지 마라.
- 루트 요소에 `data-screen="<화면id>"`를 붙인다 — 이슈가 이 id(`screenId`)로 화면을 연동한다.
- 네트워크/외부 리소스(CDN·웹폰트·원격 이미지·fetch·URL) 금지. 인라인 `<style>`+`<script>`만.
  저채도 그레이스케일 low-fi.

## 인터랙션 규칙 (🔴 모든 화면)

와이어프레임은 **눌러 보면 반응하는** 산출물이다. 정적인 그림이면 화면을 검토할 수 없다.
아래는 해당되는 화면이면 **반드시** 넣는다.

| 상황 | 무엇을 넣는가 |
| --- | --- |
| **다른 화면으로 가는 버튼/링크** | 실제로 이동시키지 말고 `wfGo('<가는 화면 이름>')`로 **어디로 가는지 토스트**를 띄운다. 각 화면은 독립 문서이고 iframe이 `sandbox="allow-scripts"`라 이동 자체가 불가능하다. 버튼이 아무 반응 없으면 "미완성"으로 오해받는다. |
| **되돌릴 수 없는 동작** (삭제·나가기·결제·제출) | `.wf-dim` 확인 다이얼로그를 열어 취소/확인을 보여 준다. |
| **폼 입력** | `onsubmit="event.preventDefault()"`. 빈 값·형식 오류일 때 `aria-invalid`와 `.wf-error` 메시지를 보여 준다(성공 시엔 `wfGo`). |
| **탭·토글·아코디언·필터** | 눌린 항목에 `.active`를 옮기고 내용이 실제로 바뀌게 한다. |
| **목록** | 비었을 때의 `.wf-empty`("아직 참가한 방이 없습니다")를 **함께** 만들고, 토글로 볼 수 있게 두면 더 좋다. |

- 열자마자 바로 동작해야 한다 — 빌드·외부 스크립트 없이 인라인 JS만.
- **로직을 구현하지 마라.** 실제 계산·검증 규칙이 아니라 *반응이 있다는 것*만 보여 준다.
- 상호작용이 하나도 없는 화면(순수 안내·완료 화면)이면 억지로 넣지 않는다.
