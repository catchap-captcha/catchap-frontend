import { useMemo } from 'react';
import './WeeklyLearningChart.css';

export interface DayPoint {
  label: string; // 요일(월~일)
  solved: number; // 그날 푼 문제 수
  watchMin: number; // 그날 강의 시청 분(근사)
}

/**
 * '나의 기록 · 요약' 학습 추이 그래프 — 최근 7일 일자별.
 *
 * 왜 일자별·개수 기준인가: 옛 주간·시간(solve_time_ms) 그래프는 문제은행 위젯이
 * solve_time=0으로 기록해, 하루에 문제를 풀어도 '시간 0 → 빈 그래프'가 됐다. 그래서
 * 문제는 '개수'(항상 집계됨)로 세고 강의는 시청 분을 더해 하루라도 활동이 있으면 점이
 * 찍히게 한다. 활동한 날이 하나면 점 하나, 둘 이상이면 선으로 잇는다. 활동이 아예
 * 없으면(문제·강의 모두 0) 비어 있는 안내를 보여 준다.
 */
export default function WeeklyLearningChart({ days }: { days: DayPoint[] }) {
  const data = useMemo(() => (days || []).slice(-7), [days]);

  const totals = useMemo(() => {
    const solved = data.reduce((s, d) => s + (d.solved || 0), 0);
    const watch = data.reduce((s, d) => s + (d.watchMin || 0), 0);
    return { solved, watch, hasAny: solved > 0 || watch > 0 };
  }, [data]);

  const geom = useMemo(() => {
    const W = 320;
    const H = 152;
    const padX = 26;
    const padT = 30; // 값 라벨 자리
    const padB = 24; // 요일 라벨 자리
    const n = data.length || 1;
    // 학습량 = 강의 시청 분 + 푼 문제 수(문제 1개를 1분 등가로 봐 높이만 합산 — 라벨은 실제 내역)
    const val = (d: DayPoint) => (d.watchMin || 0) + (d.solved || 0);
    const ceil = Math.max(...data.map(val), 1) * 1.25;
    const plotW = W - padX * 2;
    const plotH = H - padT - padB;
    const x = (i: number) => (n <= 1 ? W / 2 : padX + (i / (n - 1)) * plotW);
    const y = (v: number) => padT + (1 - v / ceil) * plotH;
    const baseY = padT + plotH;
    const pts = data.map((d, i) => ({ ...d, i, v: val(d), cx: x(i), cy: y(val(d)) }));
    const active = pts.filter((p) => p.v > 0);
    const line =
      active.length >= 2
        ? active.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(' ')
        : '';
    return { W, H, baseY, pts, activeCount: active.length, line };
  }, [data]);

  if (data.length === 0) return null; // 구버전 서버(days 미제공) — 조용히 미표시

  const dayLabel = (d: DayPoint) => {
    const parts: string[] = [];
    if (d.solved > 0) parts.push(`${d.solved}문제`);
    if (d.watchMin > 0) parts.push(`${d.watchMin}분`);
    return parts.join('·');
  };

  return (
    <div className="wlc">
      <div className="wlc-head">
        <h3 className="wlc-title">학습 추이</h3>
        <p className="wlc-cap">최근 7일간 푼 문제와 강의 시청 기록이에요.</p>
      </div>

      {totals.hasAny ? (
        <div className="wlc-chartwrap">
          <svg className="wlc-svg" viewBox={`0 0 ${geom.W} ${geom.H}`} role="img" aria-label="최근 7일 학습 추이 그래프">
            <line className="wlc-axis" x1="0" y1={geom.baseY} x2={geom.W} y2={geom.baseY} />
            {geom.activeCount >= 2 && <path className="wlc-line" d={geom.line} />}
            {geom.pts.map((p) => {
              const isToday = p.i === geom.pts.length - 1;
              const on = p.v > 0;
              return (
                <g key={p.i}>
                  {on && <title>{`${p.label}요일 · ${dayLabel(p)}`}</title>}
                  {on && (
                    <circle
                      className={`wlc-dot${isToday ? ' wlc-dot-cur' : ''}`}
                      cx={p.cx}
                      cy={p.cy}
                      r={isToday ? 5 : 4}
                    />
                  )}
                  {on && (
                    <text
                      className={`wlc-vlabel${isToday ? ' wlc-vlabel-cur' : ''}`}
                      x={p.cx}
                      y={p.cy - 10}
                      textAnchor="middle"
                    >
                      {dayLabel(p)}
                    </text>
                  )}
                  <text
                    className={`wlc-xlabel${isToday ? ' wlc-xlabel-cur' : ''}`}
                    x={p.cx}
                    y={geom.baseY + 16}
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
