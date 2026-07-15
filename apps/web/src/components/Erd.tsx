import { useEffect, useId, useState } from 'react';
import mermaid from 'mermaid';
import type { Domain } from '@issue-board/shared';
import type { Theme } from '../theme';

/** mermaid 식별자로 안전하게 (영숫자/언더스코어) */
function sanitize(s: string): string {
  const out = (s || '').replace(/[^A-Za-z0-9_]/g, '_').replace(/_+/g, '_');
  return /^[A-Za-z_]/.test(out) ? out : `_${out}` || 'X';
}

/** constraints에서 키 종류 추출 (PK/FK/UK) */
function keyOf(constraints?: string): string {
  const c = (constraints ?? '').toUpperCase();
  if (c.includes('PK')) return 'PK';
  if (c.includes('FK')) return 'FK';
  if (c.includes('UQ') || c.includes('UNIQUE') || c.includes('UK')) return 'UK';
  return '';
}

/** "FK→User", "FK->User.id", "FK: User" 등에서 대상 엔티티명 추출 */
function fkTarget(constraints?: string): string | null {
  if (!constraints || !/FK/i.test(constraints)) return null;
  const m = constraints.match(/FK[^A-Za-z0-9_]+([A-Za-z0-9_]+)/i);
  return m ? m[1] : null;
}

/** 도메인 배열 → mermaid erDiagram 소스 (관계는 컬럼 FK 제약에서 도출) */
export function buildErd(domains: Domain[]): string {
  const lines = ['erDiagram'];
  const rels: string[] = [];
  for (const d of domains) {
    const ent = sanitize(d.name);
    lines.push(`  ${ent} {`);
    for (const c of d.columns) {
      const type = sanitize(c.type || 'string');
      const name = sanitize(c.name || 'col');
      const key = keyOf(c.constraints);
      // 표시 순서를 "컬럼 → 타입 → 제약(key)"으로. mermaid는 첫 두 토큰을
      // type/name으로 파싱하지만 렌더는 쓴 순서대로 나오므로 name을 먼저 둔다.
      // key(PK/FK/UK)는 3번째 위치라 배지로 정상 렌더된다.
      lines.push(`    ${name} ${type}${key ? ` ${key}` : ''}`);
      const tgt = fkTarget(c.constraints);
      if (tgt) rels.push(`  ${ent} }o--|| ${sanitize(tgt)} : "${c.name}"`);
    }
    lines.push('  }');
  }
  return [...lines, ...rels].join('\n');
}

export function Erd({
  domains,
  theme = 'dark',
}: {
  domains: Domain[];
  theme?: Theme;
}) {
  const rawId = useId();
  const renderId = `erd-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const [svg, setSvg] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const code = buildErd(domains);
    // 페이지 테마에 맞춰 mermaid 다이어그램도 다시 렌더한다.
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === 'light' ? 'neutral' : 'dark',
      securityLevel: 'strict',
    });
    mermaid
      .render(renderId, code)
      .then(({ svg }) => {
        if (!cancelled) {
          setSvg(svg);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [domains, renderId, theme]);

  // PDF 내보내기: 밝은(neutral) 테마로 다시 렌더해 인쇄 창을 열고,
  // 브라우저 인쇄 대화상자에서 "PDF로 저장"을 선택하게 한다 (의존성 없음, 완전 로컬).
  const exportPdf = async () => {
    const code = `%%{init: {"theme":"neutral"}}%%\n${buildErd(domains)}`;
    let printSvg: string;
    try {
      ({ svg: printSvg } = await mermaid.render(`${renderId}-print`, code));
    } catch {
      return;
    }
    const win = window.open('', '_blank', 'width=1100,height=760');
    if (!win) {
      alert('팝업이 차단되었습니다. 이 사이트의 팝업을 허용해 주세요.');
      return;
    }
    win.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>ERD</title>` +
        `<style>` +
        // 가로 한 페이지에 꽉 맞춤. viewBox+preserveAspectRatio(meet)로 비율 유지 축소.
        `@page{size:landscape;margin:8mm;}` +
        `html,body{margin:0;padding:0;height:100%;background:#fff;overflow:hidden;}` +
        `.wrap{width:100%;height:100vh;overflow:hidden;box-sizing:border-box;` +
        `display:flex;align-items:center;justify-content:center;}` +
        // SVG의 인라인 max-width 캡을 무력화하고 페이지 박스에 맞게 확대/축소
        `.wrap svg{width:100%!important;height:100%!important;max-width:none!important;}` +
        `</style></head>` +
        `<body><div class="wrap">${printSvg}</div>` +
        `<script>window.onload=function(){window.focus();window.print();}<\/script>` +
        `</body></html>`,
    );
    win.document.close();
  };

  if (error) {
    return (
      <div className="empty">
        ERD를 그릴 수 없습니다. FK 표기(예: <code>FK→User</code>)를 확인하세요.
        <br />
        {error}
      </div>
    );
  }
  return (
    <div>
      <div className="erd-toolbar">
        <button className="link-btn" onClick={exportPdf} disabled={!svg}>
          📄 PDF로 내보내기
        </button>
      </div>
      <div className="erd" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}
