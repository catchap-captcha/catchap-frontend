import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { lectureApi, type InstructorDashboard } from '../../api/lectures';
import OpsNav from '../../components/ops/OpsNav';
import { PATHS } from '../../routes/paths';
import './OpsApproval.css';
import './OpsInstructorHome.css';

/**
 * 강사 홈 대시보드 — 강의 목록에 바로 떨구는 대신, 로그인하면 '지금 할 일(검수 대기)'과
 * '학생이 어디서 막히나(약한 문항)'를 먼저 보여준다. 강의가 여러 개인 강사도 검수 대기 문항을
 * 한 화면에서(강의별 목록) 파악하게 한다. 데이터는 GET /ops/instructor/dashboard(강사 스코프).
 * 되감기 히트맵·확인문항 문항별 이해도는 계측이 없어 제외(P1).
 */
export default function OpsInstructorHome() {
  const [data, setData] = useState<InstructorDashboard | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = () => {
    setState('loading');
    lectureApi
      .opsInstructorDashboard()
      .then((d) => {
        setData(d);
        setState('ready');
      })
      .catch(() => setState('error'));
  };
  useEffect(load, []);

  const pct = (r: number) => `${Math.round(r * 100)}%`;

  return (
    <div className="op-root">
      <OpsNav />
      <main className="op-main">
        <div className="op-head">
          <div>
            <h1 className="op-title">강사 홈</h1>
            <p className="op-sub">검수할 문항과 학생이 막히는 지점을 한눈에 봅니다.</p>
          </div>
          <button className="op-refresh" onClick={load} disabled={state === 'loading'}>
            새로고침
          </button>
        </div>

        {state === 'loading' && (
          <div className="op-empty">
            <i className="ph-fill ph-spinner-gap" />
            <p>불러오는 중…</p>
          </div>
        )}
        {state === 'error' && (
          <div className="op-empty">
            <i className="ph-fill ph-warning-circle" />
            <p>대시보드를 불러오지 못했어요.</p>
          </div>
        )}

        {state === 'ready' && data && (
          <>
            {/* KPI 요약 */}
            <div className="ih-kpis">
              <div className="ih-kpi">
                <span className="ih-kpi-num">{data.lecture_count}</span>
                <span className="ih-kpi-lb">내 강의</span>
              </div>
              <div className="ih-kpi">
                <span className="ih-kpi-num">{data.course_count}</span>
                <span className="ih-kpi-lb">내 코스</span>
              </div>
              <div className="ih-kpi">
                <span className="ih-kpi-num">{data.active_learners}</span>
                <span className="ih-kpi-lb">학습 학생</span>
              </div>
              <div className="ih-kpi">
                <span className="ih-kpi-num">{data.course_completions}</span>
                <span className="ih-kpi-lb">코스 수료</span>
              </div>
            </div>

            <div className="ih-cols">
              {/* 할 일 — 검수 대기 */}
              <section className="ih-card">
                <div className="ih-card-head">
                  <i className="ph-bold ph-checks" />
                  <h2 className="ih-card-title">검수 대기</h2>
                </div>
                {/* 총 건수를 큰 숫자로 따로 세우지 않는다(사용자 요청) — 아래 내역이
                    같은 수를 종류별로 이미 말해 주고, 강의별 건수도 목록에 다시 나온다. */}
                <div className="ih-todo">
                  <span className="ih-todo-break">
                    확인문항 {data.draft_lecture_questions} · 수료 시험 문항 {data.draft_exam_questions}
                  </span>
                </div>

                {data.lectures_without_checkpoint > 0 && (
                  <div className="ih-warn">
                    <i className="ph-bold ph-warning" />
                    확인문항이 없는 강의 {data.lectures_without_checkpoint}개 — 시청 검증이 걸리지
                    않습니다.
                  </div>
                )}

                {data.draft_by_lecture?.length > 0 ? (
                  <ul className="ih-lec-list">
                    {data.draft_by_lecture.map((l) => (
                      <li key={l.lecture_id} className="ih-lec-row">
                        <span className="ih-lec-title">{l.title}</span>
                        <span className="ih-lec-badge">{l.draft_count}건 검수 대기</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="ih-none">강의 확인문항은 모두 검수됐어요.</p>
                )}

                <Link className="ih-cta" to={PATHS.OPS_LECTURES}>
                  강의 관리로 이동 <i className="ph-bold ph-arrow-right" />
                </Link>
              </section>

              {/* 표본 검수 — 검수 대기 문항 무작위 표본으로 생성 품질을 빠르게 점검(문제은행 2단계) */}
              {data.review_sample?.length > 0 && (
                <section className="ih-card">
                  <div className="ih-card-head">
                    <i className="ph-bold ph-list-magnifying-glass" />
                    <h2 className="ih-card-title">표본 검수</h2>
                  </div>
                  {/* 옆 '검수 대기' 카드와 같은 자리·같은 형식의 요약 한 줄. 제목이 같은 강의가
                      있을 수 있어 title 이 아니라 lecture_id 로 센다. */}
                  <div className="ih-todo">
                    <span className="ih-todo-break">
                      표본 {data.review_sample.length}개 · 강의{' '}
                      {new Set(data.review_sample.map((q) => q.lecture_id)).size}개
                    </span>
                  </div>
                  <ul className="ih-sample-list">
                    {data.review_sample.map((q) => (
                      <li key={q.question_id} className="ih-sample-row">
                        <div className="ih-sample-main">
                          <span className="ih-sample-prompt">{q.prompt}</span>
                          <span className="ih-sample-lec">{q.lecture_title}</span>
                        </div>
                        {q.suggested_placement && (
                          <span className={`ih-verdict ih-verdict--${q.suggested_placement}`}>
                            {q.suggested_placement === 'captcha'
                              ? '확인 문항 적합'
                              : q.suggested_placement === 'bank'
                                ? '은행 적합'
                                : '불량 의심'}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <Link className="ih-cta" to={PATHS.OPS_LECTURES}>
                    강의 관리에서 검수 <i className="ph-bold ph-arrow-right" />
                  </Link>
                </section>
              )}
            </div>

            {/* 문항별 — 특정 확인문항이 유독 어렵거나 잘못 만들어졌는지(question_id 계측 후 데이터).
                구체적인 문항 단위 확인이 강의 단위 통계보다 먼저 봐야 할 정보라 위로 옮김(0727). */}
            {data.weak_checkpoint_questions?.length > 0 && (
              <section className="ih-card ih-card--wide">
                <div className="ih-card-head">
                  <i className="ph-bold ph-warning-diamond" />
                  <h2 className="ih-card-title">다시 봐야 할 확인문항</h2>
                </div>
                <p className="ih-card-sub">
                  통과율이 낮은 문항이에요 — 너무 어렵거나 잘못 만들어졌을 수 있어요.
                  <b> 검토 권장</b>은 통과율이 특히 낮아 문항 자체를 살펴볼 것을 권하는 표시예요.
                </p>
                <ul className="ih-cq-list">
                  {data.weak_checkpoint_questions.map((q) => (
                    <li key={q.question_id} className="ih-cq-row">
                      <div className="ih-cq-main">
                        <span className="ih-cq-lec">{q.lecture_title}</span>
                        <p className="ih-cq-prompt">{q.prompt || '(문항 내용 없음)'}</p>
                        <span className="ih-weak-meta">학생 {q.learners}명 · 시도 {q.attempts}회</span>
                      </div>
                      <div className="ih-cq-right">
                        <span className="ih-cq-rate">{pct(q.pass_rate)}</span>
                        {q.review && <span className="ih-cq-flag">검토 권장</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* 이해도 — 강의별 확인문항 통과율(각 강의마다). 강의마다 문항이 다르므로 강의 단위. */}
            <section className="ih-card ih-card--wide">
              <div className="ih-card-head">
                <i className="ph-bold ph-chart-bar" />
                <h2 className="ih-card-title">학생이 어려워하는 강의</h2>
              </div>
              <p className="ih-card-sub">
                강의 중간 확인문항 통과율이 낮을수록 학생이 그 강의를 어려워해요(강의 보강 대상).
              </p>

              {data.weak_lectures?.length > 0 ? (
                <ul className="ih-weak-list">
                  {data.weak_lectures.map((l) => (
                    <li key={l.lecture_id} className="ih-weak-row">
                      <div className="ih-weak-top">
                        <span className="ih-weak-prompt ih-weak-prompt--title">{l.title}</span>
                        <span className="ih-weak-rate">{pct(l.pass_rate)}</span>
                      </div>
                      <div className="ih-weak-bar">
                        <div className="ih-weak-bar-fill" style={{ width: pct(l.pass_rate) }} />
                      </div>
                      <span className="ih-weak-meta">
                        확인문항 통과율 · 학생 {l.learners}명 · 시도 {l.attempts}회
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ih-none">
                  아직 확인문항 응시 데이터가 없어요. 학생이 강의를 보며 확인문항을 풀면 여기에
                  강의별 통과율이 떠요.
                </p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
