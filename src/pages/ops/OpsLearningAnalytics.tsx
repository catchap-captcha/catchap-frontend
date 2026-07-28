import { useEffect, useState } from 'react';
import { lectureApi, type InstructorAnalytics } from '../../api/lectures';
import OpsNav from '../../components/ops/OpsNav';
import './OpsApproval.css';
import './OpsRenewalShared.css';
import './OpsLearningAnalytics.css';

const pct = (r: number | null): string => (r == null ? '-' : `${Math.round(r * 100)}%`);
const rateColor = (r: number): string =>
  r < 0.55 ? 'var(--brand)' : r < 0.7 ? 'var(--warn)' : 'var(--ok)';

/**
 * 학습 분석 — CatChap '학습 분석' 리뉴얼 화면 그대로. 시청 완주·확인문항 통과·코스 수료
 * 흐름을 본다. GET /ops/instructor/analytics. 강의 완주 추이는 근사치(서버 응답 주석 참조),
 * 확인문항 통과율·코스 수료율은 실측 이벤트/기록 집계다.
 */
export default function OpsLearningAnalytics() {
  const [data, setData] = useState<InstructorAnalytics | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = () => {
    setState('loading');
    lectureApi
      .opsInstructorAnalytics()
      .then((d) => {
        setData(d);
        setState('ready');
      })
      .catch(() => setState('error'));
  };
  useEffect(load, []);

  return (
    // 헤더 셸은 강사 홈·강의 관리와 같은 공통 규격(op-*) — 이 화면만 orn-* 셸이라 제목 크기
    // (32/700 vs 30/800)·본문 폭·여백이 형제 페이지들과 어긋났다.
    <div className="op-root">
      <OpsNav />
      <main className="op-main la-page">
        <div className="op-head">
          <div>
            <h1 className="op-title">학습 분석</h1>
            <p className="op-sub">시청 완주·확인문항 통과·코스 수료 흐름을 분석합니다.</p>
          </div>
          <span className="la-period"><i className="ph ph-calendar-blank" />최근 8주</span>
        </div>

        {state === 'loading' && <div className="orn-loading"><i className="ph-duotone ph-spinner-gap" />불러오는 중…</div>}
        {state === 'error' && (
          <div className="orn-card orn-empty"><i className="ph ph-warning-circle" /><p>학습 분석을 불러오지 못했어요.</p></div>
        )}

        {state === 'ready' && data && <Body data={data} />}
      </main>
    </div>
  );
}

function Body({ data }: { data: InstructorAnalytics }) {
  const weekly = data.weekly;
  const maxLec = Math.max(1, ...weekly.map((w) => w.lecture_completions));
  const last = weekly[weekly.length - 1];
  const prev = weekly[weekly.length - 2];
  let trendBadge: { label: string; down: boolean } | null = null;
  if (last && prev) {
    if (prev.lecture_completions > 0) {
      const delta = Math.round(((last.lecture_completions - prev.lecture_completions) / prev.lecture_completions) * 100);
      trendBadge = { label: `지난주 대비 ${delta >= 0 ? '+' : ''}${delta}%`, down: delta < 0 };
    } else if (last.lecture_completions > 0) {
      trendBadge = { label: '지난주 대비 신규', down: false };
    }
  }

  const funnel = [
    { label: '강의 시작', rate: 1, icon: 'ph-play-circle', color: 'var(--ink-2)' },
    { label: '시청 완주', rate: data.watch_completion_rate, icon: 'ph-monitor-play', color: 'var(--info)' },
    { label: '확인문항 통과', rate: data.checkpoint_pass_rate, icon: 'ph-seal-question', color: 'var(--warn)' },
    { label: '코스 수료', rate: data.course_completion_rate, icon: 'ph-seal-check', color: 'var(--ok)' },
  ];

  const lecturesWithData = data.per_lecture
    .filter((l) => l.checkpoint_pass_rate != null)
    .sort((a, b) => (a.checkpoint_pass_rate ?? 0) - (b.checkpoint_pass_rate ?? 0));

  return (
    <>
      <div className="orn-kpigrid la-kpigrid">
        <div className="orn-card orn-kpi">
          <span className="orn-kpi-num">{data.active_learners}</span>
          <span className="orn-kpi-lb">학습 학생</span>
        </div>
        <div className="orn-card orn-kpi">
          <span className="orn-kpi-num">{pct(data.watch_completion_rate)}</span>
          <span className="orn-kpi-lb">평균 완주율</span>
        </div>
        <div className="orn-card orn-kpi">
          <span className="orn-kpi-num">{pct(data.checkpoint_pass_rate)}</span>
          <span className="orn-kpi-lb">확인문항 통과율</span>
        </div>
        <div className="orn-card orn-kpi">
          <span className="orn-kpi-num">{weekly.reduce((s, w) => s + w.course_completions, 0)}</span>
          <span className="orn-kpi-lb">코스 수료</span>
        </div>
      </div>

      <div className="la-cols">
        <section className="orn-card la-card">
          <div className="la-card-head">
            <h2>주간 시청 완주</h2>
            {trendBadge && (
              <span className={'la-card-badge' + (trendBadge.down ? ' la-card-badge--down' : '')}>
                <i className={trendBadge.down ? 'ph ph-trend-down' : 'ph ph-trend-up'} />
                {trendBadge.label}
              </span>
            )}
          </div>
          <p className="la-card-sub">최근 8주 · 완주된 강의 수(근사)</p>
          <div className="la-chart">
            {weekly.map((w, i) => {
              const isLast = i === weekly.length - 1;
              const h = Math.round((w.lecture_completions / maxLec) * 100);
              const d = new Date(w.week_start);
              const label = `${d.getMonth() + 1}/${d.getDate()}`;
              return (
                <div key={w.week_start} className="la-bar-wrap">
                  <span className={'la-bar-val' + (isLast ? ' la-bar-val--now' : '')}>{w.lecture_completions}</span>
                  <div className={'la-bar' + (isLast ? ' la-bar--now' : '')} style={{ height: `${h}%` }} />
                  <span className="la-bar-lb">{label}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="orn-card la-card">
          <h2 style={{ marginBottom: 18 }}>시청 검증 퍼널</h2>
          <div className="la-funnel">
            {funnel.map((f) => (
              <div key={f.label}>
                <div className="la-funnel-row-top">
                  <span className="la-funnel-label"><i className={`ph ${f.icon}`} />{f.label}</span>
                  <span className="la-funnel-val">{pct(f.rate)}</span>
                </div>
                <div className="la-funnel-bar">
                  <div
                    className="la-funnel-bar-fill"
                    style={{ width: f.rate != null ? `${Math.round(f.rate * 100)}%` : '0%', background: f.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="orn-card la-lecsection">
        <div className="la-lecsection-head">
          <i className="ph ph-chart-bar" />
          <h2>강의별 확인문항 통과율</h2>
        </div>
        <p className="la-lecsection-sub">
          통과율이 낮을수록 학생이 그 강의를 어려워해요 — 강의 보강이나 문항 검토를 권해요.
        </p>
        {lecturesWithData.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600, margin: 0 }}>
            아직 확인문항 응시 데이터가 없어요.
          </p>
        ) : (
          lecturesWithData.map((l) => {
            const rate = l.checkpoint_pass_rate ?? 0;
            const color = rateColor(rate);
            return (
              <div key={l.lecture_id} className="la-lecrow">
                <div className="la-lec-name">
                  <div className="la-lec-title">{l.title}</div>
                  <div className="la-lec-meta">{l.subject} · 학생 {l.checkpoint_learners}명</div>
                </div>
                <div className="la-lec-bar">
                  <div className="la-lec-bar-fill" style={{ width: pct(rate), background: color }} />
                </div>
                <span className="la-lec-rate" style={{ color }}>{pct(rate)}</span>
                {rate < 0.55 && <span className="la-lec-flag">보강 권장</span>}
              </div>
            );
          })
        )}
      </section>
    </>
  );
}
