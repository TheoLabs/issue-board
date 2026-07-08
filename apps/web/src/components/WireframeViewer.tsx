import { useCallback, useEffect, useRef } from 'react';
import type { Wireframe } from '@issue-board/shared';

/**
 * 조회 전용 와이어프레임 뷰어 (G2).
 *
 * sandbox="allow-scripts": 인라인 <script>로 클릭스루 프로토타입 인터랙션을 허용한다.
 * allow-same-origin은 주지 않아 iframe이 고유 origin으로 격리(부모 DOM·쿠키 접근 불가)되므로
 * 로컬에서 생성된 HTML 실행에 안전하다.
 *
 * gotoScreen: 이슈 "화면 보기"로 넘어올 때, iframe에 postMessage로 해당 화면 전환을
 * 요청한다. 생성된 프로토타입 HTML이 { type: 'ib-goto', screen } 메시지를 수신해 처리한다.
 */
export function WireframeViewer({
  wireframe,
  gotoScreen,
}: {
  wireframe: Wireframe;
  gotoScreen?: string | null;
}) {
  const ref = useRef<HTMLIFrameElement>(null);

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

  if (wireframe.format === 'html') {
    return (
      <iframe
        ref={ref}
        className="wireframe-frame"
        title={wireframe.name}
        sandbox="allow-scripts"
        srcDoc={wireframe.content}
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
