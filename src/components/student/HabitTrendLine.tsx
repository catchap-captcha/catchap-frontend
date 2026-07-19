import { useMemo } from 'react';
import './HabitTrendLine.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface HabitDay {
  date: string;
  attempts: number;
  /** 그날 일일 목표(Q_DAILY_GOAL) 달성 여부 — 옛 done(완료 과목 수)을 대체(Q 통합 3단계-c) */
  goal_met: boolean;
  accuracy: number | null;
}

/** 오늘의 퀴즈(습관 축) 일별 정답률 라인 + 완료 과목 점 오버레이 — 나의 기록 습관 섹션.
 * 정답률 없는 날(미학습)은 선을 끊고, 활동한 날만 점을 찍는다. 순수 SVG(라이브러리 없음). */
export default function HabitTrendLine({ days, streak }: { days: HabitDay[]; streak: number }) {
  const W = 320;
  const H = 96;
  const PAD = 6;
  const pts = useMemo(() => {
    const n = Math.max(1, days.length);
    return days.map((d, i) => ({
      x: PAD + (i * (W - PAD * 2)) / Math.max(1, n - 1),
      y: d.accuracy == null ? null : H - PAD - (d.accuracy / 100) * (H - PAD * 2),
      d,
    }));
  }, [days]);

  // 정답률이 있는 연속 구간마다 폴리라인을 끊어 그린다(미학습 날은 선 단절)
  const segments: { x: number; y: number }[][] = [];
  let seg: { x: number; y: number }[] = [];
  for (const p of pts) {
    if (p.y == null) {
      if (seg.length) segments.push(seg);
      seg = [];
    } else {
      seg.push({ x: p.x, y: p.y });
    }
  }
  if (seg.length) segments.push(seg);

  const hasData = pts.some((p) => p.y != null);
  const areaPath =
    segments.length === 1
      ? `M${segments[0].map((p) => `${p.x},${p.y}`).join(' L')} L${segments[0][segments[0].length - 1].x},${H - PAD} L${segments[0][0].x},${H - PAD} Z`
      : '';

  return (
    <div className="htl">
      <div className="htl-head">
        <div className="htl-streak">
          <i className="ph-fill ph-fire" />
          <b>{streak}일</b> 연속 도전
        </div>
        <span className="htl-cap">최근 {days.length}일 · 일별 정답률</span>
      </div>
      {hasData ? (
        <svg viewBox={`0 0 ${W} ${H}`} className="htl-svg" preserveAspectRatio="none" role="img"
             aria-label="일별 오늘의 Q 정답률 추세">
          {[25, 50, 75].map((g) => (
            <line key={g} x1={PAD} x2={W - PAD} y1={H - PAD - (g / 100) * (H - PAD * 2)}
                  y2={H - PAD - (g / 100) * (H - PAD * 2)} className="htl-grid" />
          ))}
          {areaPath && <path d={areaPath} className="htl-area" />}
          {segments.map((s, i) => (
            <polyline key={i} points={s.map((p) => `${p.x},${p.y}`).join(' ')} className="htl-line" />
          ))}
          {pts.map((p, i) =>
            p.y == null ? null : (
              <circle key={i} cx={p.x} cy={p.y} r={p.d.goal_met ? 3.6 : 2.4}
                      className={`htl-dot${p.d.goal_met ? ' htl-dot-full' : ''}`}>
                <title>{`${p.d.date} · 정답률 ${p.d.accuracy}%${p.d.goal_met ? ' · 목표 달성' : ''}`}</title>
              </circle>
            ),
          )}
        </svg>
      ) : (
        <div className="htl-empty">아직 오늘의 퀴즈 기록이 없어요. 한 판 풀면 추세가 그려져요!</div>
      )}
      <div className="htl-legend">
        <span><i className="htl-lg-line" /> 정답률</span>
        <span><i className="htl-lg-dot htl-lg-full" /> 6과목 완료한 날</span>
      </div>
    </div>
  );
}
