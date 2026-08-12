import { useEffect, useMemo, useRef, useState } from 'react';
import './WeeklyLearningChart.css';

export interface DayPoint {
  label: string; // 요일(월~일)
  solved: number; // 그날 푼 문제 수
  watchMin: number; // 그날 강의 시청 분(근사)
}

/* 그래프는 고정 픽셀 높이 + 컨테이너 실측 폭으로 그린다. viewBox를 폭에 맞춰 확대하던
   옛 방식은 글자까지 폭 비례로 커져(넓은 화면에서 라벨이 60px+) 거대하게 떴다. */
const H = 230; // 고정 높이(px)
const PAD_X = 22;
const PAD_T = 42; // 값 라벨 자리
const PAD_B = 40; // 요일 라벨 자리

function fmtLabel(d: DayPoint): string {
  const parts: string[] = [];
  if (d.solved > 0) parts.push(`${d.solved}문제`);
  if (d.watchMin > 0) parts.push(`${d.watchMin}분`);
  return parts.join('·');
}

export default function WeeklyLearningChart({ days }: { days: DayPoint[] }) {
  const data = useMemo(() => (days || []).slice(-7), [days]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(680);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect.width;
      if (cw && cw > 0) setW(Math.round(cw));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const totals = useMemo(() => {
    const solved = data.reduce((s, d) => s + (d.solved || 0), 0);
    const watch = data.reduce((s, d) => s + (d.watchMin || 0), 0);
    return { solved, watch, hasAny: solved > 0 || watch > 0 };
  }, [data]);

  const geom = useMemo(() => {
    const n = data.length || 1;
    const val = (d: DayPoint) => (d.watchMin || 0) + (d.solved || 0);
    const ceil = Math.max(...data.map(val), 1) * 1.32;
    const plotW = Math.max(1, w - PAD_X * 2);
    const plotH = H - PAD_T - PAD_B;
    const x = (i: number) => (n <= 1 ? w / 2 : PAD_X + (i / (n - 1)) * plotW);
    const y = (v: number) => PAD_T + (1 - v / ceil) * plotH;
    const baseY = PAD_T + plotH;
    const pts = data.map((d, i) => ({ ...d, i, v: val(d), cx: x(i), cy: y(val(d)) }));
    const active = pts.filter((p) => p.v > 0);
    const line =
      active.length >= 2
        ? active.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(' ')
        : '';
    const area =
      active.length >= 2
        ? `M${active[0].cx.toFixed(1)},${baseY} ` +
          active.map((p) => `L${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(' ') +
          ` L${active[active.length - 1].cx.toFixed(1)},${baseY} Z`
        : '';
    const grid = [0.34, 0.67].map((f) => PAD_T + f * plotH);
    return { pts, active, line, area, baseY, grid };
  }, [data, w]);

  if (data.length === 0) return null;

  return (
    <div className="wlc">
      <div className="wlc-head">
        <h3 className="wlc-title">학습 추이</h3>
        <p className="wlc-cap">최근 7일간 푼 문제와 강의 시청 기록이에요.</p>
      </div>

      {totals.hasAny ? (
        <div className="wlc-chartwrap" ref={wrapRef}>
          <svg
            className="wlc-svg"
            width={w}
            height={H}
            viewBox={`0 0 ${w} ${H}`}
            role="img"
            aria-label="최근 7일 학습 추이 그래프"
          >
            <defs>
              <linearGradient id="wlc-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.14" />
                <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {geom.grid.map((gy, i) => (
              <line key={i} className="wlc-grid" x1={PAD_X} y1={gy} x2={w - PAD_X} y2={gy} />
            ))}
            <line className="wlc-axis" x1={PAD_X} y1={geom.baseY} x2={w - PAD_X} y2={geom.baseY} />
            {geom.area && <path className="wlc-area" d={geom.area} fill="url(#wlc-fill)" />}
            {geom.line && <path className="wlc-line" d={geom.line} />}
            {geom.pts.map((p) => {
              const isToday = p.i === geom.pts.length - 1;
              const on = p.v > 0;
              return (
                <g key={p.i}>
                  {on && (
                    <circle
                      className={`wlc-dot${isToday ? ' wlc-dot-cur' : ''}`}
                      cx={p.cx}
                      cy={p.cy}
                      r={isToday ? 6 : 4.5}
                    />
                  )}
                  {on && (
                    <text
                      className={`wlc-vlabel${isToday ? ' wlc-vlabel-cur' : ''}`}
                      x={p.cx}
                      y={p.cy - 15}
                      textAnchor="middle"
                    >
                      {fmtLabel(p)}
                    </text>
                  )}
                  <text
                    className={`wlc-xlabel${isToday ? ' wlc-xlabel-cur' : ''}`}
                    x={p.cx}
                    y={geom.baseY + 24}
                    textAnchor="middle"
                  >
                    {p.label}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="wlc-foot">
            <span className="wlc-foot-total">
              <i className="ph-fill ph-puzzle-piece" /> 문제 {totals.solved}개
            </span>
            <span className="wlc-foot-total">
              <i className="ph-fill ph-television" /> 강의 {totals.watch}분
            </span>
          </div>
        </div>
      ) : (
        <div className="wlc-empty">
          <i className="ph-fill ph-chart-line-up" />
          <p>문제를 풀거나 강의를 들으면 여기에 학습 추이가 그려져요.</p>
        </div>
      )}
    </div>
  );
}
