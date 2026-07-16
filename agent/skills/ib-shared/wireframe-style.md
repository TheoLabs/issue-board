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
- 루트 요소에 `data-screen="<화면id>"`를 붙인다 — 이슈가 이 id(`screenId`)로 화면을 연동한다.
- 네트워크/외부 리소스(CDN·웹폰트·원격 이미지·fetch·URL) 금지. 인라인 `<style>`+`<script>`만.
  저채도 그레이스케일 low-fi. **화면 간 이동은 만들지 마라**(각 화면은 독립 문서).
