import { useEffect, useState } from 'react';
import type { Issue, WeeklyActivityPoint } from '@issue-board/shared';
import { api } from '../api/client';

/**
 * 대시보드 "진행 분석" 섹션.
 * - 주간 완료 속도(velocity) + 누적 생성 vs 완료(번다운): 활동 로그 시계열(서버).
 * 차트는 무의존 inline SVG. 색은 앱 토큰(--accent, --prio-low) 재사용.
 * 상태 전이 이력은 최근분부터 쌓이므로 시계열은 초기엔 얇게 보인다.
 */
export function Analytics({
  projectId,
  issues,
}: {
  projectId: string;
  issues: Issue[];
}) {
  const [trend, setTrend] = useState<WeeklyActivityPoint[] | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .getActivityTrend(projectId, 12)
      .then((t) => alive && setTrend(t))
      .catch(() => alive && setTrend([]));
    return () => {
      alive = false;
    };
  }, [projectId, issues]);

  return (
    <div className="ov-grid2">
      <section className="ov-card">
        <h3 className="ov-card-title">주간 완료 속도</h3>
        {trend ? (
          <VelocityChart data={trend} />
        ) : (
          <p className="ov-daily-empty">불러오는 중…</p>
        )}
      </section>
      <section className="ov-card">
        <h3 className="ov-card-title">누적 생성 vs 완료</h3>
        {trend ? (
          <CumulativeChart data={trend} />
        ) : (
          <p className="ov-daily-empty">불러오는 중…</p>
        )}
      </section>
    </div>
  );
}

// ─── 시계열 차트 공통 ───

/** weekStart(YYYY-MM-DD) → 'M/D' */
function md(weekStart: string): string {
  const [, m, d] = weekStart.split('-');
  return `${Number(m)}/${Number(d)}`;
}

// ─── 주간 완료 속도 (막대) ───

function VelocityChart({ data }: { data: WeeklyActivityPoint[] }) {
  const W = 320,
    H = 150,
    padL = 22,
    padR = 12,
    padT = 16,
    padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = data.length;
  const band = plotW / Math.max(1, n);
  const barW = Math.min(band * 0.55, 34);
  const max = Math.max(1, ...data.map((d) => d.done));
  const baseY = padT + plotH;

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="주간 완료 속도">
      <line className="chart-axis" x1={padL} y1={baseY} x2={W - padR} y2={baseY} />
      {data.map((d, i) => {
        const cx = padL + band * i + band / 2;
        const h = (d.done / max) * plotH;
        const y = baseY - h;
        return (
          <g key={d.weekStart}>
            {d.done > 0 && (
              <rect
                className="chart-bar"
                x={cx - barW / 2}
                y={y}
                width={barW}
                height={h}
                rx={3}
              >
                <title>{`주 ${md(d.weekStart)}: 완료 ${d.done}`}</title>
              </rect>
            )}
            {d.done > 0 && (
              <text className="chart-vallabel" x={cx} y={y - 4} textAnchor="middle">
                {d.done}
              </text>
            )}
            <text className="chart-xlabel" x={cx} y={baseY + 14} textAnchor="middle">
              {md(d.weekStart)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── 누적 생성 vs 완료 (라인) ───

function CumulativeChart({ data }: { data: WeeklyActivityPoint[] }) {
  const W = 320,
    H = 160,
    padL = 26,
    padR = 44,
    padT = 14,
    padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = data.length;

  let cc = 0,
    cd = 0;
  const pts = data.map((d) => {
    cc += d.created;
    cd += d.done;
    return { week: d.weekStart, created: cc, done: cd };
  });
  const max = Math.max(1, cc);
  const x = (i: number) => padL + (n <= 1 ? plotW / 2 : (plotW * i) / (n - 1));
  const y = (v: number) => padT + plotH * (1 - v / max);
  const baseY = padT + plotH;

  const line = (key: 'created' | 'done') =>
    pts.map((p, i) => `${x(i)},${y(p[key])}`).join(' ');
  const last = pts[pts.length - 1];

  const series: { key: 'created' | 'done'; label: string; cls: string }[] = [
    { key: 'created', label: '생성', cls: 'created' },
    { key: 'done', label: '완료', cls: 'done' },
  ];

  return (
    <div>
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.key} className="chart-legend-item">
            <span className={`chart-swatch chart-swatch--${s.cls}`} />
            {s.label}
          </span>
        ))}
      </div>
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="누적 생성 vs 완료"
      >
        <line className="chart-axis" x1={padL} y1={baseY} x2={W - padR} y2={baseY} />
        {series.map((s) => (
          <g key={s.key}>
            {n > 1 && (
              <polyline
                className={`chart-line chart-line--${s.cls}`}
                points={line(s.key)}
              />
            )}
            {pts.map((p, i) => (
              <circle
                key={i}
                className={`chart-dot chart-dot--${s.cls}`}
                cx={x(i)}
                cy={y(p[s.key])}
                r={3}
              >
                <title>{`주 ${md(p.week)}: ${s.label} ${p[s.key]}`}</title>
              </circle>
            ))}
            <text
              className={`chart-endlabel chart-endlabel--${s.cls}`}
              x={x(pts.length - 1) + 6}
              y={y(last[s.key]) + 3}
            >
              {s.label} {last[s.key]}
            </text>
          </g>
        ))}
        {data.map((d, i) => (
          <text
            key={d.weekStart}
            className="chart-xlabel"
            x={x(i)}
            y={baseY + 14}
            textAnchor="middle"
          >
            {md(d.weekStart)}
          </text>
        ))}
      </svg>
    </div>
  );
}
