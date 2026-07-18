import { useMemo, useState } from 'react';
import './ChapterAccuracyChart.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ChapterStat {
  no: number;
  title: string;
  accuracy: number | null;
  total: number;
  stages_done: number;
  low_sample: boolean;
  unlocked: boolean;
  unreviewed_wrong?: number;
}
export interface SubjectStat {
  subject: string;
  unlocked_chapters: number;
  max_chapters: number;
  overall_accuracy: number | null;
  daily_quiz_accuracy: number | null;
  unreviewed_wrong?: number;
  chapters: ChapterStat[];
}

const SUBJECT_COLOR: Record<string, string> = {
  국어: '#FF5A4D', 영어: '#FF922E', 수학: '#17B08C',
  과학: '#2E7BFF', 사회: '#8B6BFF', 생활: '#FF6DA6',
};
const ORDER = ['국어', '영어', '수학', '과학', '사회', '생활'];

/** 전체학습(숙련 축) 과목×챕터별 정답률 차트 — 학생/학부모 공용.
 * 미학습=빈 막대, 표본<5=흐림, 잠금=빗금, 5단계 진행=막대 아래 도트. 챕터 많으면 가로 스크롤. */
export default function ChapterAccuracyChart({ subjects }: { subjects: SubjectStat[] }) {
  const ordered = useMemo(
    () => [...(subjects || [])].sort((a, b) => ORDER.indexOf(a.subject) - ORDER.indexOf(b.subject)),
    [subjects],
  );
  const [active, setActive] = useState(ordered[0]?.subject ?? '국어');
  const cur = ordered.find((s) => s.subject === active) ?? ordered[0];
  if (!cur) return null;
  const color = SUBJECT_COLOR[cur.subject] ?? '#17B08C';
  const hasData = cur.chapters.some((c) => c.total > 0);

  return (
    <div className="cac">
      <div className="cac-tabs" role="tablist">
        {ordered.map((s) => (
          <button
            key={s.subject}
            role="tab"
            aria-selected={s.subject === active}
            className={`cac-tab${s.subject === active ? ' cac-tab-on' : ''}`}
            style={s.subject === active ? { color: SUBJECT_COLOR[s.subject], borderColor: SUBJECT_COLOR[s.subject] } : undefined}
            onClick={() => setActive(s.subject)}
          >
            {s.subject}
          </button>
        ))}
      </div>

      <div className="cac-head">
        <div className="cac-overall">
          <span className="cac-overall-num" style={{ color }}>
            {cur.overall_accuracy != null ? `${cur.overall_accuracy}%` : '—'}
          </span>
          <span className="cac-overall-lbl">문제은행 정답률</span>
        </div>
        <div className="cac-badges">
          {cur.daily_quiz_accuracy != null && (
            <span className="cac-badge" title="오늘의 퀴즈(습관)는 별도 지표예요">
              <i className="ph-fill ph-lightning" /> 오늘의 퀴즈 {cur.daily_quiz_accuracy}%
            </span>
          )}
          <span className="cac-badge cac-badge-soft">
            열린 {cur.unlocked_chapters} / 전체 {cur.max_chapters} 챕터
          </span>
        </div>
      </div>

      {hasData ? (
        <div className="cac-chartwrap">
          <div className="cac-chart" style={{ '--cac-color': color } as React.CSSProperties}>
            {cur.chapters.map((c) => {
              const h = c.accuracy != null ? Math.max(4, c.accuracy) : 0;
              const cls = !c.unlocked
                ? 'cac-bar cac-bar-lock'
                : c.total === 0
                  ? 'cac-bar cac-bar-empty'
                  : c.low_sample
                    ? 'cac-bar cac-bar-low'
                    : 'cac-bar';
              const label =
                !c.unlocked ? '🔒' : c.total === 0 ? '·' : c.low_sample ? `${c.total}개` : `${c.accuracy}`;
              return (
                <div key={c.no} className="cac-col" title={`${c.no}챕터 · ${c.title}${c.total ? ` · ${c.total}문제` : ' · 아직'}`}>
                  <span className="cac-val">{label}</span>
                  <div className="cac-track">
                    <div className={cls} style={{ height: `${h}%` }} />
                  </div>
                  <div className="cac-stages" aria-hidden="true">
                    {Array.from({ length: 5 }, (_, i) => (
                      <span key={i} className={`cac-dot${i < c.stages_done ? ' cac-dot-on' : ''}`} />
                    ))}
                  </div>
                  <span className="cac-no">{c.no}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="cac-empty">
          <i className="ph-fill ph-chart-bar" />
          <p>아직 {cur.subject} 문제은행 기록이 없어요. 한 챕터 풀면 여기에 정답률이 그려져요!</p>
        </div>
      )}

      <div className="cac-legend">
        <span><i className="cac-lg" style={{ background: color }} /> 정답률</span>
        <span><i className="cac-lg cac-lg-low" /> 표본 적음</span>
        <span><i className="cac-lg cac-lg-lock" /> 잠금</span>
        <span><i className="cac-lg cac-lg-empty" /> 아직</span>
      </div>
    </div>
  );
}
