import type { Design, DesignTokens } from '@issue-board/shared';

/**
 * 디자인 시스템 탭. 저장된 토큰(색·타이포·간격·컴포넌트)을 렌더한다.
 * 아직 없으면 안내(빈 상태). 생성은 대상 프로젝트에서 /ib-design.
 */

interface Swatch {
  name: string;
  value: string;
}

function SwatchRow({ title, items }: { title: string; items: Swatch[] }) {
  return (
    <div className="ds-swatch-group">
      <h4>{title}</h4>
      <div className="ds-swatches">
        {items.map((s) => (
          <div className="ds-swatch" key={s.name}>
            <div className="ds-swatch-chip" style={{ background: s.value }} />
            <div className="ds-swatch-meta">
              <span className="ds-swatch-name">{s.name}</span>
              <span className="ds-swatch-value">{s.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Tokens({ t }: { t: DesignTokens }) {
  const brand: Swatch[] = [
    { name: 'Main', value: t.brand.main },
    { name: 'Main Hover', value: t.brand.mainHover },
    { name: 'Main Soft', value: t.brand.mainSoft },
    { name: 'Sub', value: t.brand.sub },
    { name: 'Sub Soft', value: t.brand.subSoft },
  ];
  const neutral: Swatch[] = [
    { name: 'BG', value: t.neutral.bg },
    { name: 'Surface', value: t.neutral.surface },
    { name: 'Surface 2', value: t.neutral.surface2 },
    { name: 'Border', value: t.neutral.border },
    { name: 'Text', value: t.neutral.text },
    { name: 'Muted', value: t.neutral.muted },
  ];
  const semantic: Swatch[] = [
    { name: 'Success', value: t.semantic.success },
    { name: 'Warning', value: t.semantic.warning },
    { name: 'Danger', value: t.semantic.danger },
    { name: 'Info', value: t.semantic.info },
  ];

  return (
    <>
      {t.mood && <p className="ds-intro">무드: {t.mood}</p>}

      <section className="ds-section">
        <h3>색상</h3>
        <SwatchRow title="Brand" items={brand} />
        <SwatchRow title="Neutral" items={neutral} />
        <SwatchRow title="Semantic" items={semantic} />
      </section>

      <section className="ds-section">
        <h3>타이포그래피</h3>
        <p className="ds-intro">
          제목: {t.fontHeading} · 본문: {t.fontBody}
        </p>
        <div className="ds-type">
          {t.typeScale.map((s) => (
            <div className="ds-type-row" key={s.name}>
              <div className="ds-type-label">
                {s.name} · {s.size}px · {s.weight} · lh{s.lineHeight}
              </div>
              <div
                className="ds-type-sample"
                style={{
                  fontSize: s.size,
                  fontWeight: s.weight,
                  lineHeight: s.lineHeight,
                }}
              >
                다람쥐 헌 쳇바퀴에 타고파 · Ag 123
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="ds-section ds-two-col">
        <div>
          <h3>간격 (Spacing)</h3>
          <div className="ds-spacing">
            {t.spacing.map((s) => (
              <div className="ds-spacing-row" key={s}>
                <span className="ds-spacing-label">{s}</span>
                <span
                  className="ds-spacing-bar"
                  style={{ width: s * 4, background: t.brand.main }}
                />
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3>라운드 (Radius)</h3>
          <div className="ds-radius">
            {(['sm', 'md', 'lg', 'full'] as const).map((k) => (
              <div className="ds-radius-item" key={k}>
                <div
                  className="ds-radius-box"
                  style={{ borderRadius: t.radius[k] }}
                />
                <span>
                  {k} · {t.radius[k] >= 999 ? '∞' : `${t.radius[k]}px`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ds-section">
        <h3>컴포넌트</h3>
        <div className="ds-components">
          <div className="ds-comp">
            <span className="ds-comp-label">버튼</span>
            <div className="ds-comp-row">
              <button
                className="dsc-btn"
                style={{
                  background: t.brand.main,
                  borderColor: t.brand.main,
                  color: '#fff',
                }}
              >
                Primary
              </button>
              <button
                className="dsc-btn"
                style={{
                  background: t.brand.sub,
                  borderColor: t.brand.sub,
                  color: '#fff',
                }}
              >
                Sub
              </button>
              <button className="dsc-btn dsc-btn-ghost">Ghost</button>
              <button className="dsc-btn dsc-btn-danger">Danger</button>
            </div>
          </div>

          <div className="ds-comp">
            <span className="ds-comp-label">배지 / 칩</span>
            <div className="ds-comp-row">
              <span
                className="dsc-chip"
                style={{ background: t.brand.mainSoft, color: t.brand.main }}
              >
                브랜드
              </span>
              <span className="dsc-chip dsc-chip-high">높음</span>
              <span className="dsc-chip dsc-chip-med">보통</span>
              <span className="dsc-chip dsc-chip-low">낮음</span>
            </div>
          </div>

          <div className="ds-comp">
            <span className="ds-comp-label">카드</span>
            <div
              className="dsc-card"
              style={{ borderRadius: t.radius.md }}
            >
              <div className="dsc-card-title">카드 제목</div>
              <div className="dsc-card-sub">
                본문 설명 텍스트. 라운드/색이 토큰을 따릅니다.
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export function DesignSystem({ design }: { design: Design | null }) {
  return (
    <div className="ds">
      <div className="ds-head">
        <h2>디자인 시스템</h2>
        {design?.status === 'draft' && (
          <span className="badge draft-badge">초안</span>
        )}
      </div>

      {design ? (
        <Tokens t={design.tokens} />
      ) : (
        <p className="empty">
          디자인 시스템이 아직 없습니다. 대상 프로젝트에서 <code>/ib-design</code>으로
          메인 컬러를 정해 생성하세요.
        </p>
      )}
    </div>
  );
}
