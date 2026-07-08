import { useEffect, useId, useState } from 'react';
import mermaid from 'mermaid';
import type { DomainLifecycle } from '@issue-board/shared';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'strict',
});

/** mermaid 상태 식별자로 안전하게 (영숫자/언더스코어). `[*]`는 그대로 둔다. */
function stateId(s: string): string {
  const raw = (s || '').trim();
  if (raw === '[*]') return '[*]';
  const out = raw.replace(/[^A-Za-z0-9_]/g, '_').replace(/_+/g, '_');
  return /^[A-Za-z_]/.test(out) ? out : `s_${out}` || 'S';
}

/** 전이 라벨(on)에서 개행/따옴표 정리 */
function edgeLabel(on?: string): string {
  return (on ?? '').replace(/["\n]/g, ' ').trim();
}

/** 생명주기 → mermaid stateDiagram-v2 소스 (상태 전이 목록에서 도출) */
export function buildLifecycle(lc: DomainLifecycle): string {
  const lines = ['stateDiagram-v2'];

  // 상태 별칭: sanitize된 id와 원래 이름이 다르거나 설명이 있으면 라벨을 붙인다.
  for (const st of lc.states ?? []) {
    const id = stateId(st.name);
    if (id === '[*]') continue;
    const label = st.description
      ? `${st.name} — ${st.description}`
      : st.name !== id
        ? st.name
        : '';
    if (label) {
      const safe = label.replace(/["\n]/g, ' ').trim();
      lines.push(`  state "${safe}" as ${id}`);
    }
  }

  for (const t of lc.transitions) {
    const from = stateId(t.from);
    const to = stateId(t.to);
    const label = edgeLabel(t.on);
    lines.push(`  ${from} --> ${to}${label ? ` : ${label}` : ''}`);
  }

  return lines.join('\n');
}

/** 도메인의 상태 흐름(생명주기)을 mermaid 상태도로 렌더한다. */
export function Lifecycle({ lifecycle }: { lifecycle: DomainLifecycle }) {
  const rawId = useId();
  const renderId = `lc-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const [svg, setSvg] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const code = buildLifecycle(lifecycle);
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
  }, [lifecycle, renderId]);

  if (error) {
    return (
      <div className="empty">
        상태 흐름도를 그릴 수 없습니다. 전이 표기(from → to)를 확인하세요.
        <br />
        {error}
      </div>
    );
  }
  return <div className="lifecycle" dangerouslySetInnerHTML={{ __html: svg }} />;
}
