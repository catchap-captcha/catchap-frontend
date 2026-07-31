import { useMemo } from 'react';
import './HabitTrendLine.css';

export interface HabitDay {
  date: string;
  attempts: number;
  /** 그날 일일 목표(Q_DAILY_GOAL) 달성 여부 — 옛 done(완료 과목 수)을 대체(Q 통합 3단계-c) */
  goal_met: boolean;
  accuracy: number | null;
}

/**
 * 오늘의 Q(습관 축) — 일별 정답률 라인 + 일별 활동 스트립.
 *
 * 종전엔 정답률 라인 위에 완료 '점'을 찍었는데, preserveAspectRatio="none"으로 SVG가 가로로
 * 늘어나 원이 알약처럼 찌그러졌고(특히 데이터가 적은 날), 코랄 area·점선 그리드가 모노크롬
 * 리뉴얼과 어긋났다. 이제 라인은 잉크로 두고, '목표 달성/학습/미학습'은 아래 사각 셀 스트립으로
 * 옮겨 늘어남과 무관하게 또렷하게 보인다(라이브러리 없이 순수 SVG + HTML).
 */
export default function HabitTrendLine({ days, streak }: { days: HabitDay[]; streak: number }) {
  const W = 320;
  const H = 74;
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
  // area는 연속 구간이 하나로 이어질 때만(끊긴 구간은 채우면 이상해진다)
  const areaPath =
    segments.length === 1
      ? `M${segments[0].map((p) => `${p.x},${p.y}`).join(' L')} L${segments[0][segments[0].length - 1].x},${H - PAD} L${segments[0][0].x},${H - PAD} Z`
      : '';

  const cellTitle = (d: HabitDay) =>
    `${d.date} · ${d.accuracy != null ? `정답률 ${d.accuracy}%` : '미학습'}${d.goal_met ? ' · 목표 달성' : ''}`;

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
        <>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="htl-svg"
            preserveAspectRatio="none"
            role="img"
            aria-label="일별 오늘의 Q 정답률 추세"
          >
            {/* 가운데 한 줄만 옅게(점선 대신 실선) — 데이터가 적어도 시끄럽지 않게 */}
            <line
              className="htl-grid"
              x1={PAD}
              x2={W - PAD}
              y1={H - PAD - 0.5 * (H - PAD * 2)}
              y2={H - PAD - 0.5 * (H - PAD * 2)}
            />
            {areaPath && <path d={areaPath} className="htl-area" />}
            {segments.map((s, i) => (
              <polyline key={i} points={s.map((p) => `${p.x},${p.y}`).join(' ')} className="htl-line" />
            ))}
          </svg>

          {/* 일별 활동 스트립 — 목표 달성(초록)·학습만(회색)·미학습(빈칸) */}
          <div className="htl-strip">
            {days.map((d, i) => (
              <span
                key={i}
                className={`htl-cell${d.goal_met ? ' htl-cell-goal' : d.attempts > 0 ? ' htl-cell-act' : ''}`}
                title={cellTitle(d)}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="htl-empty">아직 오늘의 Q 기록이 없어요. 한 판 풀면 추세가 그려져요!</div>
      )}

      <div className="htl-legend">
        <span>
          <i className="htl-lg-line" /> 정답률
        </span>
        <span>
          <i className="htl-lg-cell htl-lg-goal" /> 목표 달성
        </span>
        <span>
          <i className="htl-lg-cell htl-lg-act" /> 학습한 날
        </span>
      </div>
    </div>
  );
}
