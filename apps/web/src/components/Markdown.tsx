import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * 마크다운을 안전하게 HTML로 렌더한다 (dangerouslySetInnerHTML 미사용).
 * remark-gfm으로 표·체크리스트·취소선 등 GitHub 확장 문법 지원.
 *
 * - 블록쿼트(>)는 **콜아웃 박스**로 강조 렌더한다. 내용에 따라 변형:
 *   경고(범위 밖 등) / 노트(가정·미결) / 액센트(그 외, 예: 목적).
 * - onCheckboxToggle을 주면 GFM 체크리스트가 동작하는 체크박스로 렌더된다(이슈 본문용).
 */

/** hast 노드의 순수 텍스트 추출 */
function nodeText(node: unknown): string {
  const n = node as { value?: string; children?: unknown[] };
  if (typeof n?.value === 'string') return n.value;
  if (Array.isArray(n?.children)) return n.children.map(nodeText).join('');
  return '';
}

function calloutVariant(text: string): 'warn' | 'note' | 'accent' {
  if (/⚠️|🚫|범위\s*밖|주의|경고|out\s*of\s*scope/i.test(text)) return 'warn';
  if (/📝|💡|가정|미결|리스크|note|assumption/i.test(text)) return 'note';
  return 'accent';
}

/** 표 셀이 우선순위 값이면 chip으로 렌더 (높음/보통/낮음, High/Med/Low 모두 인식) */
function priorityChip(text: string): { cls: string; label: string } | null {
  const t = text.trim();
  if (/^(높음|high)$/i.test(t)) return { cls: 'chip-high', label: '높음' };
  if (/^(보통|중간|med|medium)$/i.test(t)) return { cls: 'chip-med', label: '보통' };
  if (/^(낮음|low)$/i.test(t)) return { cls: 'chip-low', label: '낮음' };
  return null;
}

/** h2 섹션에 순번 기반 앵커 id(sec-0, sec-1…) 부여 — 목차 링크용 (순수) */
function rehypeHeadingIds() {
  return (tree: unknown) => {
    let i = 0;
    const walk = (node: unknown): void => {
      const n = node as {
        type?: string;
        tagName?: string;
        properties?: Record<string, unknown>;
        children?: unknown[];
      };
      if (n.type === 'element' && n.tagName === 'h2') {
        n.properties = n.properties ?? {};
        n.properties.id = `sec-${i++}`;
      }
      if (Array.isArray(n.children)) n.children.forEach(walk);
    };
    walk(tree);
  };
}

/** 파싱 시점에 각 태스크리스트 체크박스에 순번 부여 (순수 — StrictMode 안전) */
function rehypeNumberCheckboxes() {
  return (tree: unknown) => {
    let i = 0;
    const walk = (node: unknown): void => {
      const n = node as {
        type?: string;
        tagName?: string;
        properties?: Record<string, unknown>;
        children?: unknown[];
      };
      if (
        n.type === 'element' &&
        n.tagName === 'input' &&
        n.properties?.type === 'checkbox'
      ) {
        n.properties.dataCbIndex = i++;
      }
      if (Array.isArray(n.children)) n.children.forEach(walk);
    };
    walk(tree);
  };
}

export function Markdown({
  children,
  onCheckboxToggle,
}: {
  children: string;
  onCheckboxToggle?: (index: number) => void;
}) {
  const components: Components = {
    blockquote(props) {
      const variant = calloutVariant(nodeText(props.node));
      return (
        <blockquote className={`callout callout-${variant}`}>
          {props.children}
        </blockquote>
      );
    },
    td(props) {
      const chip = priorityChip(nodeText(props.node));
      if (chip) {
        return (
          <td>
            <span className={`chip ${chip.cls}`}>{chip.label}</span>
          </td>
        );
      }
      return <td>{props.children}</td>;
    },
  };

  if (onCheckboxToggle) {
    // react-markdown이 만드는 input은 GFM 태스크리스트 체크박스뿐이다.
    components.input = (props) => {
      if (props.type !== 'checkbox') return null;
      const node = props.node as
        | { properties?: { dataCbIndex?: number } }
        | undefined;
      const idx = Number(node?.properties?.dataCbIndex ?? 0);
      return (
        <input
          type="checkbox"
          checked={!!props.checked}
          onChange={() => onCheckboxToggle(idx)}
          className="md-checkbox"
        />
      );
    };
  }

  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={
          onCheckboxToggle
            ? [rehypeHeadingIds, rehypeNumberCheckboxes]
            : [rehypeHeadingIds]
        }
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
