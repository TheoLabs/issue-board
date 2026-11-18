import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Wireframe } from '@issue-board/shared';

/**
 * 와이어프레임 안에 주입하는 브리지 스크립트.
 *
 * - `wfGo(target)`: 부모(대시보드)에 `ib-navigate`를 보내 **실제로 그 화면으로 전환**한다.
 *   target은 `data-screen` id 또는 화면 이름(구버전 호환). 대상이 없으면 부모가
 *   `ib-navigate-missing`으로 답하고, 화면 안에 토스트로 알린다.
 * - `wfBack()`: 와이어프레임 안에서 이동해 온 직전 화면으로 돌아간다.
 * - `wfOpen/wfClose/wfToggle`: 다이얼로그·사이드바(드로어)·바텀시트를 `[open]`으로 연다/닫는다.
 * - 딤(배경)을 누르거나 Esc를 누르면 열린 오버레이가 닫힌다.
 *
 * 생성된 HTML이 먼저 정의한 함수를 덮어쓰도록 문서 끝에 넣는다 — 그래서 이미 만들어 둔
 * 와이어프레임(토스트만 띄우던 wfGo)도 다시 생성하지 않고 바로 이동이 된다.
 */
const BRIDGE = `<script data-ib-bridge>
(function(){
  function toast(msg){
    var t=document.querySelector('.wf-toast'); if(!t) return;
    t.textContent=msg; t.classList.add('show');
    clearTimeout(t._timer); t._timer=setTimeout(function(){t.classList.remove('show')},1600);
  }
  window.wfGo=function(target){
    parent.postMessage({type:'ib-navigate',target:String(target)},'*');
  };
  window.wfBack=function(){ parent.postMessage({type:'ib-navigate-back'},'*'); };
  window.wfOpen=function(id){ var el=document.getElementById(id); if(el) el.setAttribute('open',''); };
  window.wfClose=function(id){ var el=document.getElementById(id); if(el) el.removeAttribute('open'); };
  window.wfToggle=function(id){ var el=document.getElementById(id); if(el) el.toggleAttribute('open'); };
  document.addEventListener('click',function(e){
    var el=e.target;
    if(el && el.classList && el.classList.contains('wf-dim') && el.hasAttribute('open')) el.removeAttribute('open');
  });
  document.addEventListener('keydown',function(e){
    if(e.key!=='Escape') return;
    var open=document.querySelectorAll('.wf-dim[open]');
    if(open.length) open[open.length-1].removeAttribute('open');
  });
  window.addEventListener('message',function(e){
    var d=e.data||{};
    if(d.type==='ib-navigate-missing') toast('"'+d.target+'" 화면이 아직 없습니다');
    if(d.type==='ib-navigate-back-empty') toast('이전 화면이 없습니다');
  });
})();
</script>`;

function withBridge(html: string): string {
  const idx = html.toLowerCase().lastIndexOf('</body>');
  return idx === -1 ? html + BRIDGE : html.slice(0, idx) + BRIDGE + html.slice(idx);
}

/**
 * 조회 전용 와이어프레임 뷰어 (G2).
 *
 * sandbox="allow-scripts": 인라인 <script>로 화면 안 인터랙션(다이얼로그·사이드바·토글·폼 검증)을
 * 허용한다. allow-same-origin은 주지 않아 iframe이 고유 origin으로 격리(부모 DOM·쿠키 접근 불가)된다.
 *
 * 화면 간 이동: iframe이 직접 이동할 수는 없으므로 postMessage(`ib-navigate`)로 부모에 요청하고,
 * 부모(onNavigate)가 해당 와이어프레임으로 전환한다. 메시지는 현재 iframe에서 온 것만 받는다.
 *
 * gotoScreen: 이슈 "화면 보기"로 넘어올 때, iframe에 postMessage로 해당 화면 전환을
 * 요청한다. 생성된 프로토타입 HTML이 { type: 'ib-goto', screen } 메시지를 수신해 처리한다.
 */
export function WireframeViewer({
  wireframe,
  gotoScreen,
  onNavigate,
  onBack,
}: {
  wireframe: Wireframe;
  gotoScreen?: string | null;
  /** 이동 대상(screen id 또는 화면 이름)을 받아 전환에 성공하면 true */
  onNavigate?: (target: string) => boolean;
  /** 직전 화면으로 돌아가는 데 성공하면 true */
  onBack?: () => boolean;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const srcDoc = useMemo(() => withBridge(wireframe.content), [wireframe.content]);

  const postGoto = useCallback(() => {
    if (gotoScreen && ref.current?.contentWindow) {
      ref.current.contentWindow.postMessage(
        { type: 'ib-goto', screen: gotoScreen },
        '*',
      );
    }
  }, [gotoScreen]);

  // gotoScreen이 바뀌면(이미 로드된 경우) 즉시 전송
  useEffect(() => {
    postGoto();
  }, [postGoto]);

  // iframe → 부모: 화면 이동 요청 수신
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const win = ref.current?.contentWindow;
      if (!win || e.source !== win) return;
      const data = e.data as { type?: string; target?: unknown } | null;
      if (data?.type === 'ib-navigate' && typeof data.target === 'string') {
        const ok = onNavigate?.(data.target) ?? false;
        if (!ok) win.postMessage({ type: 'ib-navigate-missing', target: data.target }, '*');
      } else if (data?.type === 'ib-navigate-back') {
        const ok = onBack?.() ?? false;
        if (!ok) win.postMessage({ type: 'ib-navigate-back-empty' }, '*');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onNavigate, onBack]);

  if (wireframe.format === 'html') {
    return (
      <iframe
        ref={ref}
        className="wireframe-frame"
        title={wireframe.name}
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        onLoad={postGoto}
      />
    );
  }
  return (
    <pre className="wireframe-raw">
      <code>{wireframe.content}</code>
    </pre>
  );
}
