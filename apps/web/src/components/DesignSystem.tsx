import { useState } from 'react';
import type { Design, DesignTokens } from '@issue-board/shared';

/**
 * 디자인 시스템 탭. 저장된 토큰을 트렌디한 쇼케이스로 렌더한다.
 * 없으면 안내(빈 상태). 생성은 대상 프로젝트에서 /ib-design.
 */

/** 클릭하면 hex를 복사하는 색 타일 */
function ColorTile({ name, value }: { name: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    });
  };
  return (
    <button className="ds-tile" onClick={copy} title="클릭하면 복사">
      <span className="ds-tile-swatch" style={{ background: value }} />
      <span className="ds-tile-info">
        <span className="ds-tile-name">{name}</span>
        <span className={`ds-tile-hex${copied ? ' copied' : ''}`}>
          {copied ? '복사됨 ✓' : value}
        </span>
      </span>
    </button>
  );
}

function ColorGroup({
  label,
  items,
}: {
  label: string;
  items: { name: string; value: string }[];
}) {
  return (
    <div className="ds-color-group">
      <div className="ds-group-label">{label}</div>
      <div className="ds-tiles">
        {items.map((c) => (
          <ColorTile key={c.name} name={c.name} value={c.value} />
        ))}
      </div>
    </div>
  );
}

function Tokens({ t, status }: { t: DesignTokens; status: string }) {
  const brand = [
    { name: 'Main', value: t.brand.main },
    { name: 'Hover', value: t.brand.mainHover },
    { name: 'Soft', value: t.brand.mainSoft },
    { name: 'Sub', value: t.brand.sub },
    { name: 'Sub Soft', value: t.brand.subSoft },
  ];
  const neutral = [
    { name: 'BG', value: t.neutral.bg },
    { name: 'Surface', value: t.neutral.surface },
    { name: 'Surface 2', value: t.neutral.surface2 },
    { name: 'Border', value: t.neutral.border },
    { name: 'Text', value: t.neutral.text },
    { name: 'Muted', value: t.neutral.muted },
  ];
  const semantic = [
    { name: 'Success', value: t.semantic.success },
    { name: 'Warning', value: t.semantic.warning },
    { name: 'Danger', value: t.semantic.danger },
    { name: 'Info', value: t.semantic.info },
  ];

  return (
    <>
      {/* 히어로 — 메인·서브 그라디언트 */}
      <div
        className="ds-hero"
        style={{
          background: `linear-gradient(135deg, ${t.brand.main} 0%, ${t.brand.sub} 100%)`,
        }}
      >
        <div className="ds-hero-top">
          <span className="ds-hero-eyebrow">DESIGN SYSTEM</span>
          {status === 'draft' && <span className="ds-hero-badge">초안</span>}
        </div>
        {t.mood && <div className="ds-hero-mood">{t.mood}</div>}
        <div className="ds-hero-dots">
          {[
            t.brand.main,
            t.brand.sub,
            t.semantic.success,
            t.semantic.warning,
            t.semantic.danger,
          ].map((c, i) => (
            <span key={i} className="ds-hero-dot" style={{ background: c }} />
          ))}
        </div>
      </div>

      {/* 색상 */}
      <section className="ds-block">
        <h3 className="ds-block-title">색상</h3>
        <ColorGroup label="Brand" items={brand} />
        <ColorGroup label="Neutral" items={neutral} />
        <ColorGroup label="Semantic" items={semantic} />
      </section>

      {/* 타이포그래피 */}
      <section className="ds-block">
        <h3 className="ds-block-title">타이포그래피</h3>
        <div className="ds-fonts">
          <span className="ds-font-chip">제목 · {t.fontHeading}</span>
          <span className="ds-font-chip">본문 · {t.fontBody}</span>
        </div>
        <div className="ds-specimen">
          {t.typeScale.map((s) => (
            <div className="ds-specimen-row" key={s.name}>
              <div
                className="ds-specimen-text"
                style={{
                  fontSize: s.size,
                  fontWeight: s.weight,
                  lineHeight: s.lineHeight,
                }}
              >
                다람쥐 헌 쳇바퀴에 타고파 Ag
              </div>
              <div className="ds-specimen-meta">
                <span className="ds-specimen-name">{s.name}</span>
                <span>
                  {s.size}px · {s.weight} · {s.lineHeight}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 간격 & 라운드 */}
      <section className="ds-block ds-grid2">
        <div>
          <h3 className="ds-block-title">간격</h3>
          <div className="ds-spacing">
            {t.spacing.map((s) => (
              <div className="ds-spacing-row" key={s}>
                <span
                  className="ds-spacing-bar"
                  style={{ width: s * 4, background: t.brand.main }}
                />
                <span className="ds-spacing-num">{s}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="ds-block-title">라운드</h3>
          <div className="ds-radius">
            {(['sm', 'md', 'lg', 'full'] as const).map((k) => (
              <div className="ds-radius-item" key={k}>
                <div
                  className="ds-radius-box"
                  style={{
                    borderRadius: t.radius[k],
                    borderColor: t.brand.main,
                  }}
                />
                <span>
                  {k} · {t.radius[k] >= 999 ? '∞' : t.radius[k]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 컴포넌트 캔버스 */}
      <section className="ds-block">
        <h3 className="ds-block-title">컴포넌트</h3>
        <div className="ds-canvas">
          <div className="ds-canvas-row">
            <button
              className="dsc-btn"
              style={{ background: t.brand.main, color: '#fff' }}
            >
              Primary
            </button>
            <button
              className="dsc-btn"
              style={{ background: t.brand.sub, color: '#fff' }}
            >
              Sub
            </button>
            <button
              className="dsc-btn ds-ghost"
              style={{ borderColor: t.brand.main, color: t.brand.main }}
            >
              Ghost
            </button>
            <button
              className="dsc-btn"
              style={{ background: t.semantic.danger, color: '#fff' }}
            >
              Danger
            </button>
          </div>
          <div className="ds-canvas-row">
            <span
              className="dsc-pill"
              style={{ background: t.brand.mainSoft, color: t.brand.main }}
            >
              브랜드
            </span>
            <span
              className="dsc-pill"
              style={{
                background: `${t.semantic.success}22`,
                color: t.semantic.success,
              }}
            >
              성공
            </span>
            <span
              className="dsc-pill"
              style={{
                background: `${t.semantic.warning}22`,
                color: t.semantic.warning,
              }}
            >
              경고
            </span>
            <span
              className="dsc-pill"
              style={{
                background: `${t.semantic.danger}22`,
                color: t.semantic.danger,
              }}
            >
              위험
            </span>
          </div>
          <div className="ds-canvas-row">
            <div
              className="dsc-card"
              style={{ borderRadius: t.radius.md }}
            >
              <div
                className="dsc-card-accent"
                style={{ background: t.brand.main }}
              />
              <div className="dsc-card-body">
                <div className="dsc-card-title">카드 컴포넌트</div>
                <div className="dsc-card-sub">
                  라운드·액센트가 토큰을 따릅니다.
                </div>
                <button
                  className="dsc-btn dsc-btn-sm"
                  style={{ background: t.brand.main, color: '#fff' }}
                >
                  액션
                </button>
              </div>
            </div>
            <div
              className="dsc-input"
              style={{ borderRadius: t.radius.sm }}
            >
              입력 필드 예시
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export function DesignSystem({ design }: { design: Design | null }) {
  if (!design) {
    return (
      <div className="ds">
        <div className="ds-empty">
          <div className="ds-empty-icon">🎨</div>
          <p>
            디자인 시스템이 아직 없습니다.
            <br />
            대상 프로젝트에서 <code>/ib-design</code>으로 메인 컬러를 정해
            생성하세요.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="ds">
      <Tokens t={design.tokens} status={design.status} />
    </div>
  );
}
