import { useMemo } from 'react';
import './WeeklyLearningChart.css';

export interface WeekPoint {
  label: string;
  v: number; // 주간 학습 활동 지표(0~100, 최고 주 대비)
  minutes: number; // 주간 학습 시간(분) — learning_attempts 실집계(문제 풀이·복습)
}

function fmtMin(m: number): string {
  if (m <= 0) return '0분';
  const h = Math.floor(m / 60);
  const mm = Math.round(m % 60);
  if (h > 0) return mm > 0 ? `${h}시간 ${mm}분` : `${h}시간`;
  return `${mm}분`;
}

/**
 * '나의 기록 · 요약' 주간 학습 추이 그래프.
 *
 * data.weeks(라벨/분/활동%)는 서버가 내려주지만 화면엔 그동안 렌더되지 않던 값이었다.
 * 여기서 최근 4주 학습 시간을 면적+선 그래프로 그린다(문제 풀이·복습에 쓴 시간 기준).
 * 데이터가 전부 0이면 빈 상태를 보여 준다(가짜 곡선을 그리지 않는다).
 */
export default function WeeklyLearningChart({ weeks }: { weeks: WeekPoint[] }) {
  const data = useMemo(() => (weeks || []).slice(-4), [weeks]);

  const geom = useMemo(() => {
    const W = 320;
    const H = 150;
    const padX = 30; // 좌우 여백(첫·끝 점이 잘리지 않게)
    const padT = 26; // 위 값 라벨 자리
    const padB = 26; // 아래 주 라벨 자리
    const n = data.length;
    const maxMin = Math.max(...data.map((d) => d.minutes), 1);
    const ceil = maxMin * 1.18; // 최고점이 천장에 붙지 않게 헤드룸
    const plotW = W - padX * 2;
    const plotH = H - padT - padB;
    const x = (i: number) => (n <= 1 ? W / 2 : padX + (i / (n - 1)) * plotW);
    const y = (m: number) => padT + (1 - m / ceil) * plotH;
    const pts = data.map((d, i) => ({ ...d, cx: x(i), cy: y(d.minutes) }));
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(' ');
    const baseY = padT + plotH;
    const area = pts.length
      ? `M${pts[0].cx.toFixed(1)},${baseY} ` +
        pts.map((p) => `L${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(' ') +
        ` L${pts[pts.length - 1].cx.toFixed(1)},${baseY} Z`
      : '';
    return { W, H, pts, line, area, baseY };
  }, [data]);

  if (data.length === 0) return null;

  const total = data.reduce((s, w) => s + w.minutes, 0);
  const hasData = total > 0;
  const cur = data[data.length - 1]?.minutes ?? 0;
  const prev = data[data.length - 2]?.minutes ?? 0;
  const delta = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;

  return (
    <div className="wlc">
      <div className="wlc-head">
        <h3 className="wlc-title">주간 학습 추이</h3>
        <p className="wlc-cap">최근 4주간 문제 풀이·복습에 쓴 시간이에요.</p>
      </div>

      {hasData ? (
        <div className="wlc-chartwrap">
          <svg className="wlc-svg" viewBox={`0 0 ${geom.W} ${geom.H}`} role="img" aria-label="주간 학습 시간 추이 그래프">
            <defs>
              <linearGradient id="wlc-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* 기준선 */}
            <line className="wlc-axis" x1="0" y1={geom.baseY} x2={geom.W} y2={geom.baseY} />
            {/* 면적 + 선 */}
            <path className="wlc-area" d={geom.area} fill="url(#wlc-fill)" />
            <path className="wlc-line" d={geom.line} />
            {/* 각 주 점 + 값 라벨 */}
            {geom.pts.map((p, i) => {
              const isCur = i === geom.pts.length - 1;
              return (
                <g key={p.label + i}>
                  <line className="wlc-guide" x1={p.cx} y1={p.cy} x2={p.cx} y2={geom.baseY} />
                  <circle className={`wlc-dot${isCur ? ' wlc-dot-cur' : ''}`} cx={p.cx} cy={p.cy} r={isCur ? 5 : 4} />
                  <text className={`wlc-vlabel${isCur ? ' wlc-vlabel-cur' : ''}`} x={p.cx} y={p.cy - 11} textAnchor="middle">
                    {fmtMin(p.minutes)}
                  </text>
                  <text className={`wlc-xlabel${isCur ? ' wlc-xlabel-cur' : ''}`} x={p.cx} y={geom.baseY + 17} textAnchor="middle">
                    {p.label}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="wlc-foot">
            <span className="wlc-foot-total">
              <i className="ph-fill ph-clock" /> 4주 합계 {fmtMin(total)}
            </span>
            {delta != null && (
              <span className={`wlc-delta ${delta >= 0 ? 'wlc-delta-up' : 'wlc-delta-down'}`}>
                <i className={`ph-bold ${delta >= 0 ? 'ph-trend-up' : 'ph-trend-down'}`} />
                지난주 {delta >= 0 ? '+' : ''}
                {delta}%
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="wlc-empty">
          <i className="ph-fill ph-chart-line-up" />
          <p>학습 기록이 쌓이면 여기에 주간 추이가 그려져요.</p>
        </div>
      )}
    </div>
  );
}
