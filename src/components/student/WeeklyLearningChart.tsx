import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import './WeeklyLearningChart.css';

export interface DayPoint {
  label: string; // 요일(월~일)
  solved: number; // 그날 푼 문제 수
  watchMin: number; // 그날 강의 시청 분(근사)
}

/* 그래프는 고정 픽셀 높이 + 컨테이너 실측 폭으로 그린다. viewBox를 폭에 맞춰 확대하던
   옛 방식은 글자까지 폭 비례로 커져(넓은 화면에서 라벨이 60px+) 거대하게 떴다. */
const H = 200; // 고정 높이(px)
const PAD_X = 22;
const PAD_T = 42; // 값 라벨 자리
const PAD_B = 40; // 요일 라벨 자리

/** 단일 지표(문제 수 또는 시청 분) 라인 차트 — 학습 추이를 지표별로 따로 그린다.
 *  종전엔 문제+시청을 한 선(합계)으로 겹쳐 그려 무엇이 얼마인지 구분이 안 됐다(사용자 요청으로 분리). */
function MetricChart({
  data,
  getVal,
  fmtValue,
  gradId,
  title,
  cap,
  foot,
  empty,
}: {
  data: DayPoint[];
  getVal: (d: DayPoint) => number;
  fmtValue: (v: number) => string;
  gradId: string;
  title: string;
  cap: string;
  foot: ReactNode;
  empty: string;
}) {
  const roRef = useRef<ResizeObserver | null>(null);
  const [w, setW] = useState(0);

  // 콜백 ref — 차트 래퍼가 붙는 순간 clientWidth를 실측(SVG는 width:100%라 부모를 못 넘김).
  const setWrap = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!el) return;
    const measure = () => {
      const cw = el.clientWidth;
      if (cw && cw > 0) setW(Math.round(cw));
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      roRef.current = ro;
    }
  }, []);

  const hasAny = useMemo(() => data.some((d) => getVal(d) > 0), [data, getVal]);

  const geom = useMemo(() => {
    const n = data.length || 1;
    const ceil = Math.max(...data.map(getVal), 1) * 1.32;
    const plotW = Math.max(1, w - PAD_X * 2);
    const plotH = H - PAD_T - PAD_B;
    const x = (i: number) => (n <= 1 ? w / 2 : PAD_X + (i / (n - 1)) * plotW);
    const y = (v: number) => PAD_T + (1 - v / ceil) * plotH;
    const baseY = PAD_T + plotH;
    const pts = data.map((d, i) => ({ ...d, i, v: getVal(d), cx: x(i), cy: y(getVal(d)) }));
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
  }, [data, w, getVal]);

  return (
    <div className="wlc-metric">
      <div className="wlc-metric-head">
        <h4 className="wlc-subtitle">{title}</h4>
        <p className="wlc-cap">{cap}</p>
      </div>
      {hasAny ? (
        <div className="wlc-chartwrap" ref={setWrap}>
          {w > 0 && (
            <svg
              className="wlc-svg"
              width="100%"
              height={H}
              viewBox={`0 0 ${w} ${H}`}
              role="img"
              aria-label={`${title} 최근 7일 추이 그래프`}
            >
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.14" />
                  <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {geom.grid.map((gy, i) => (
                <line key={i} className="wlc-grid" x1={PAD_X} y1={gy} x2={w - PAD_X} y2={gy} />
              ))}
              <line className="wlc-axis" x1={PAD_X} y1={geom.baseY} x2={w - PAD_X} y2={geom.baseY} />
              {geom.area && <path className="wlc-area" d={geom.area} fill={`url(#${gradId})`} />}
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
                        textAnchor={isToday ? 'end' : p.i === 0 ? 'start' : 'middle'}
                      >
                        {fmtValue(p.v)}
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
          )}
          <div className="wlc-foot">{foot}</div>
        </div>
      ) : (
        <div className="wlc-empty">
          <i className="ph-fill ph-chart-line-up" />
          <p>{empty}</p>
        </div>
      )}
    </div>
  );
}

export default function WeeklyLearningChart({ days }: { days: DayPoint[] }) {
  const data = useMemo(() => (days || []).slice(-7), [days]);
  const totals = useMemo(() => {
    const solved = data.reduce((s, d) => s + (d.solved || 0), 0);
    const watch = data.reduce((s, d) => s + (d.watchMin || 0), 0);
    return { solved, watch };
  }, [data]);

  if (data.length === 0) return null;

  return (
    <div className="wlc">
      <div className="wlc-head">
        <h3 className="wlc-title">학습 추이</h3>
        <p className="wlc-cap">최근 7일간 문제 풀이와 강의 시청 기록을 나눠서 보여줘요.</p>
      </div>

      {/* 문제 풀이 → 그 아래 강의 시청, 두 그래프로 분리(사용자 요청) */}
      <div className="wlc-stack">
        <MetricChart
          data={data}
          getVal={(d) => d.solved || 0}
          fmtValue={(v) => `${v}문제`}
          gradId="wlc-fill-solved"
          title="문제 풀이"
          cap="최근 7일간 하루에 푼 문제 수예요."
          empty="문제를 풀면 여기에 추이가 그려져요."
          foot={
            <span className="wlc-foot-total">
              <i className="ph-fill ph-puzzle-piece" /> 문제 {totals.solved}개
            </span>
          }
        />
        <MetricChart
          data={data}
          getVal={(d) => d.watchMin || 0}
          fmtValue={(v) => `${v}분`}
          gradId="wlc-fill-watch"
          title="강의 시청"
          cap="최근 7일간 하루 강의 시청 시간(분)이에요."
          empty="강의를 들으면 여기에 추이가 그려져요."
          foot={
            <span className="wlc-foot-total">
              <i className="ph-fill ph-television" /> 강의 {totals.watch}분
            </span>
          }
        />
      </div>
    </div>
  );
}
