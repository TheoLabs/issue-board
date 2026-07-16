import { useEffect, useState } from 'react';
import type { Issue, DailyActivityPoint } from '@issue-board/shared';
import { api } from '../api/client';

/**
 * 대시보드 "작업 현황" 섹션 — 최근 1주(7일) 일별 이슈 생성 vs 완료(꺾은선). 활동 로그 시계열(서버).
 * applicationId가 있으면 그 앱 기준, 없으면 프로젝트 전체.
 * 차트는 무의존 inline SVG. 색은 앱 토큰(--accent=생성, --prio-low=완료) 재사용.
 */
export function Analytics({
  projectId,
  issues,
  applicationId,
}: {
  projectId: string;
  issues: Issue[];
  /** 선택된 앱(전달 표면). null이면 프로젝트 전체 기준 */
  applicationId?: string | null;
}) {
  const [trend, setTrend] = useState<DailyActivityPoint[] | null>(null);

  useEffect(() => {
    let alive = true;
    setTrend(null);
    api
      .getActivityDailyTrend(projectId, 7, applicationId ?? undefined)
      .then((t) => alive && setTrend(t))
      .catch(() => alive && setTrend([]));
    return () => {
      alive = false;
    };
  }, [projectId, issues, applicationId]);

  return (
    <section className="ov-card">
      <h3 className="ov-card-title">작업 현황</h3>
      {trend ? (
        <WorkStatusChart data={trend} />
      ) : (
        <p className="ov-daily-empty">불러오는 중…</p>
      )}
    </section>
  );
}

/** 'YYYY-MM-DD' → 'M/D' */
function md(date: string): string {
  const [, m, d] = date.split('-');
  return `${Number(m)}/${Number(d)}`;
}

/** 일별 생성(파랑)·완료(초록) 꺾은선. 점 개수가 늘어도 겹침이 없다. */
function WorkStatusChart({ data }: { data: DailyActivityPoint[] }) {
  // 카드가 전체 폭이라 뷰박스를 넓고 낮게 잡아 렌더 높이를 줄인다(폭:높이 ≈ 5:1).
  // padT는 최상단(최댓값) 점 위의 수량 라벨이 잘리지 않도록 여유를 둔다.
  const W = 600,
    H = 122,
    padL = 26,
    padR = 14,
    padT = 22,
    padB = 20;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = data.length;
  const max = Math.max(1, ...data.map((d) => Math.max(d.created, d.done)));
  const x = (i: number) =>
    padL + (n <= 1 ? plotW / 2 : (plotW * i) / (n - 1));
  const y = (v: number) => padT + plotH * (1 - v / max);
  const baseY = padT + plotH;

  const series: { key: 'created' | 'done'; label: string }[] = [
    { key: 'created', label: '생성' },
    { key: 'done', label: '완료' },
  ];
  const line = (key: 'created' | 'done') =>
    data.map((d, i) => `${x(i)},${y(d[key])}`).join(' ');

  // x축 라벨 솎기: 최대 7~8개만, 마지막(오늘)은 항상 표시 → 겹침 방지
  const step = Math.max(1, Math.ceil(n / 7));
  const showTick = (i: number) => i % step === 0 || i === n - 1;

  return (
    <div>
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.key} className="chart-legend-item">
            <span className={`chart-swatch chart-swatch--${s.key}`} />
            {s.label}
          </span>
        ))}
      </div>
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="일별 생성·완료 현황"
      >
        <line className="chart-axis" x1={padL} y1={baseY} x2={W - padR} y2={baseY} />
        {series.map((s) => (
          <g key={s.key}>
            {n > 1 && (
              <polyline
                className={`chart-line chart-line--${s.key}`}
                points={line(s.key)}
              />
            )}
            {data.map((d, i) => (
              <circle
                key={i}
                className={`chart-dot chart-dot--${s.key}`}
                cx={x(i)}
                cy={y(d[s.key])}
                r={2.5}
              >
                <title>{`${md(d.date)}: ${s.label} ${d[s.key]}`}</title>
              </circle>
            ))}
            {/* 실제 수량 라벨 — 계열 색으로. 밀집 구간(2주+)은 x축과 같게 솎고 0은 생략 */}
            {data.map((d, i) =>
              showTick(i) && d[s.key] > 0 ? (
                <text
                  key={`v-${i}`}
                  className={`chart-endlabel chart-endlabel--${s.key}`}
                  x={x(i)}
                  y={y(d[s.key]) - 6}
                  textAnchor="middle"
                >
                  {d[s.key]}
                </text>
              ) : null,
            )}
          </g>
        ))}
        {data.map((d, i) =>
          showTick(i) ? (
            <text
              key={d.date}
              className="chart-xlabel"
              x={x(i)}
              y={baseY + 14}
              textAnchor="middle"
            >
              {md(d.date)}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}
