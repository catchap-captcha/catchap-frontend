import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import {
  API_ORIGIN,
  lectureApi,
  type ExamSession,
  type ExamState,
  type ExamSubmitResult,
} from '../../api/lectures';
import { StudentNav } from '../../layouts/StudentLayout';
import { MotionCollector, watchPointer } from '../../lib/motionSummary';
import CertificateModal from '../../components/course/CertificateModal';
import './CourseExam.css';

/* eslint-disable @typescript-eslint/no-explicit-any */
/* CatChap 수료 시험 — handoff `CatChap 수료 시험.dc.html` */

/**
 * 코스 수료 시험 — 완전학습(mastery). 배움(강의) → 연습(문제은행 Q) → 증명(수료 시험)의
 * 마지막 조각. 캡차 위젯을 쓰지 않는 자체 UI(설계 §6 — 시험은 부정 방지가 아니라 학습
 * 완성 장치라, 회차 문항을 한 화면에 모아 풀고 서버가 채점한다).
 *
 * 상태 흐름: intro(상태 카드) → taking(회차 응시) → result(결과지 + 진행/수료).
 * 틀린 문항은 다음 회차에 다시 나오고, 전 문항을 누적 정답하면 수료.
 */
type Phase = 'intro' | 'taking' | 'result' | 'cooldown';

// 회차 제한시간 — 문항당 이 초(사용자 결정 2026-08-05: '제한시간 적게'). 10문항이면 5분.
// 0이 되면 자동 제출(무응답=오답). 백엔드 수료 기준 EXAM_PASS_RATIO(80%=10문항 중 8개)와 짝.
const EXAM_SEC_PER_Q = 30;
const PASS_RATIO = 0.8;

/** 초 → MM:SS. 재응시 게이트 카운트다운 표시용. */
const fmtMMSS = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// 시험 화면에서만 듣는다. 화면을 벗어나면 해제된다.
export default function CourseExam() {
  const [params] = useSearchParams();
  const courseId = params.get('course') ?? '';
  const navigate = useNavigate();

  const [state, setState] = useState<ExamState | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [phase, setPhase] = useState<Phase>('intro');
  /** 푸는 동안의 포인터 움직임. 좌표는 이 안에서만 살아 있다. */
  const motionRef = useRef(new MotionCollector());
  const [session, setSession] = useState<ExamSession | null>(null);
  // 문항별 선택(표시 순서 기준 인덱스 집합). question_id → Set<displayIdx>
  const [picks, setPicks] = useState<Record<string, number[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ExamSubmitResult | null>(null);
  const [startedAt, setStartedAt] = useState(0);

  // 문제를 푸는 동안에만 듣는다. 안내·결과 화면에서는 볼 이유가 없다.
  useEffect(() => {
    if (phase !== 'taking') return;
    return watchPointer(motionRef.current);
  }, [phase]);
  // 수료증 팝업 — 합격 직후 자동으로 열고(아래 submit), 인트로·결과지 버튼으로도 다시 연다.
  // 발급 자체(서버 수료 검증 → 캔버스 렌더 → 저장)는 CertificateModal이 맡는다.
  const [certOpen, setCertOpen] = useState(false);
  // 제출 직후 결과 팝업(점수·통과 여부) — 통과면 여기서 '수료증 보기'로 수료증을 연다.
  const [resultPop, setResultPop] = useState(false);
  // 오답 쿨다운 남은 시간(초). 방금 틀린 문항은 잠시 뒤에 다시 나온다 — 빈 시험을 보여주는
  // 대신 언제 열리는지 알려주고 초 단위로 줄여 준다.
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [cooldownMin, setCooldownMin] = useState(0);
  // 응시 제한시간(초) — 회차 시작 시 문항수×EXAM_SEC_PER_Q로 세팅, 0이면 자동 제출.
  const [timeLeft, setTimeLeft] = useState(0);
  // 미통과 결과 팝업의 재응시 게이트 남은 초 — 제출 응답 retry_after_sec에서 시작해 1초씩 준다.
  const [retryLeft, setRetryLeft] = useState(0);

  const loadState = useCallback(() => {
    if (!courseId) return;
    lectureApi
      .examState(courseId)
      .then(setState)
      .catch((e: any) =>
        setLoadErr(e?.response?.data?.detail ?? '수료 시험 정보를 불러오지 못했어요.'),
      );
  }, [courseId]);

  useEffect(loadState, [loadState]);

  const start = async (perfectChallenge = false) => {
    setLoadErr('');
    try {
      const s = await lectureApi.examSession(courseId, perfectChallenge);
      if (s.passed && !s.questions) {
        // 발급 대신 이미 (완벽) 수료 — 상태 새로고침 후 인트로 갱신
        loadState();
        return;
      }
      if (s.cooldown) {
        // 남은 문항이 전부 쿨다운 중이라 회차가 없다. 몇 초 뒤에 열리는지 보여준다.
        setCooldownLeft(Math.max(0, s.retry_after_sec ?? 0));
        setCooldownMin(s.cooldown_minutes ?? 0);
        setPhase('cooldown');
        return;
      }
      setSession(s);
      setPicks({});
      setStartedAt(Date.now());
      setTimeLeft((s.questions?.length ?? 0) * EXAM_SEC_PER_Q);
      setPhase('taking');
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      setLoadErr((typeof d === 'string' ? d : d?.message) ?? '시험을 시작하지 못했어요.');
    }
  };

  const toggle = (qid: string, idx: number, multi: boolean) => {
    setPicks((prev) => {
      const cur = prev[qid] ?? [];
      if (multi) {
        const next = cur.includes(idx) ? cur.filter((i) => i !== idx) : [...cur, idx];
        return { ...prev, [qid]: next };
      }
      // 단답: 한 개만 — 같은 걸 다시 누르면 해제(무응답 허용)
      return { ...prev, [qid]: cur.includes(idx) ? [] : [idx] };
    });
  };

  const submit = async () => {
    if (!session?.sitting_id || !session.questions) return;
    setSubmitting(true);
    try {
      const res = await lectureApi.examSubmit(courseId, {
        sitting_id: session.sitting_id,
        answers: session.questions.map((q) => ({
          question_id: q.question_id,
          picks: picks[q.question_id] ?? [],
        })),
        solve_time_ms: Math.max(0, Date.now() - startedAt),
        // 푸는 동안의 포인터 움직임 요약. 좌표는 안 보낸다(`lib/motionSummary.ts`).
        // "무엇을 아는가" 가 아니라 "누가 푸는가" 를 보는 값이다 — LLM 으로 답을
        // 맞히는 봇은 정답률로는 안 걸리고 궤적으로 걸린다. 지금은 기록만 한다.
        motion: motionRef.current.take(),
      });
      setResult(res);
      setPhase('result');
      // 제출 직후 결과 팝업(점수·통과 여부)을 먼저 띄운다. 통과면 그 팝업의 '수료증 보기'로 수료증을 연다.
      setResultPop(true);
      // 미통과면 10분 재응시 게이트 시작 — 팝업 카운트다운의 시작값(초).
      setRetryLeft(res.retry_after_sec ?? 0);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      // detail 은 문자열일 수도, {message, ...} 객체일 수도 있다. 객체를 그대로 렌더하면
      // React 가 죽으므로 문구만 꺼낸다.
      const msg =
        (typeof detail === 'string' ? detail : detail?.message) ??
        '제출에 실패했어요. 다시 시도해 주세요.';
      if (e?.response?.status === 429) {
        // 너무 빨리 제출했거나 응시 상한 — 답안을 살려 둔 채 그 자리에서 알린다.
        // 인트로로 되돌리면 고른 답이 전부 날아간다.
        setLoadErr(msg);
      } else {
        // 이미 제출된 회차(409) 등 — 정직하게 알리고 상태를 새로고침
        setLoadErr(msg);
        loadState();
        setPhase('intro');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 쿨다운 카운트다운 — 1초씩 줄이고 0이 되면 멈춘다(자동 재시도는 하지 않는다.
  // 학생이 직접 누르게 두는 편이 '갑자기 시험이 시작됨'보다 낫다).
  useEffect(() => {
    if (phase !== 'cooldown' || cooldownLeft <= 0) return;
    const t = setInterval(() => setCooldownLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(t);
  }, [phase, cooldownLeft]);

  // 결과 팝업 재응시 게이트 카운트다운 — 팝업이 떠 있는 동안 1초씩 줄인다(0이면 재응시 열림).
  useEffect(() => {
    if (!resultPop || retryLeft <= 0) return;
    const t = setInterval(() => setRetryLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(t);
  }, [resultPop, retryLeft]);

  // 응시 제한시간 — 1초씩 줄이고, 0이 되면 자동 제출(무응답=오답). 결과·인트로로 나가면 멈춘다.
  useEffect(() => {
    if (phase !== 'taking' || timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(t);
  }, [phase, timeLeft]);
  useEffect(() => {
    // 시간 종료 → 한 번만 자동 제출(제출 중이 아니고 회차가 살아 있으면).
    if (phase === 'taking' && timeLeft === 0 && !submitting && session?.sitting_id) submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timeLeft]);

  const answeredCount = useMemo(
    () => (session?.questions ?? []).filter((q) => (picks[q.question_id] ?? []).length > 0).length,
    [session, picks],
  );

  if (!courseId) {
    return (
      <div className="ce-root">
        <StudentNav />
        <div className="ce-wrap">
          <div className="ce-empty">코스를 찾을 수 없어요. <Link to={PATHS.STUDENT_LECTURES}>강의 목록으로</Link></div>
        </div>
      </div>
    );
  }

  return (
    <div className="ce-root">
      <StudentNav />
      <div className="ce-wrap">
        <Link to={PATHS.STUDENT_LECTURES} className="ce-back">
          <i className="ph-bold ph-arrow-left" />
          강의 목록으로
        </Link>

        {loadErr && (
          <div className="ce-err">
            <i className="ph-fill ph-warning-circle" /> {loadErr}
          </div>
        )}

        {/* ===== INTRO — 상태 카드 ===== */}
        {phase === 'intro' && state && (
          <IntroCard state={state} onStart={start} onCertificate={() => setCertOpen(true)} />
        )}
        {phase === 'intro' && !state && !loadErr && <div className="ce-empty">불러오는 중…</div>}

        {/* ===== COOLDOWN — 방금 틀린 문항이 다시 나올 때까지 ===== */}
        {phase === 'cooldown' && (
          <section className="ce-cooldown">
            <i className="ph-fill ph-hourglass-medium" />
            <h1 className="ce-cd-title">
              {cooldownLeft > 0 ? '조금 뒤에 다시 도전할 수 있어요' : '이제 다시 도전할 수 있어요'}
            </h1>
            <p className="ce-cd-sub">
              미통과하면 {cooldownMin}분 간격으로 재응시할 수 있어요. 다음 회차엔 <b>틀린 문제를
              포함한 새 문항</b>이 나와요.
              <br />
              바로 다시 찍는 것보다, 결과지에서 해설을 보고 오면 훨씬 잘 풀려요.
            </p>
            <div className="ce-cd-clock" role="timer" aria-live="polite">
              {cooldownLeft > 0
                ? `${String(Math.floor(cooldownLeft / 60)).padStart(2, '0')}:${String(
                    cooldownLeft % 60,
                  ).padStart(2, '0')}`
                : '지금 열렸어요'}
            </div>
            <div className="ce-cd-actions">
              <button
                className="ce-btn ce-btn--primary"
                onClick={() => start()}
                disabled={cooldownLeft > 0}
              >
                <i className="ph-fill ph-play-circle" />
                {cooldownLeft > 0 ? '기다리는 중…' : '재응시'}
              </button>
              <button
                className="ce-btn ce-btn--ghost"
                onClick={() => {
                  setPhase('intro');
                  loadState();
                }}
              >
                나가기
              </button>
            </div>
          </section>
        )}

        {/* ===== TAKING — 회차 응시 ===== */}
        {phase === 'taking' && session?.questions && (
          <section className="ce-take">
            <header className="ce-take-head">
              <div>
                <h1 className="ce-title">
                  <i className={session.perfect_challenge ? 'ph-fill ph-crown' : 'ph-fill ph-exam'} />
                  {session.perfect_challenge ? '완벽 도전' : (state?.title ?? '수료 시험')}
                </h1>
                <p className="ce-sub">
                  {session.perfect_challenge ? (
                    <>전 문항 {session.questions.length}개를 <b>한 번에 모두 맞히면 완벽 통과</b>! 한 문제라도 틀리면 다시 도전할 수 있어요.</>
                  ) : (
                    <>
                      이번 회차 {session.questions.length}문항 ·{' '}
                      <b>{session.pass_need ?? Math.ceil(session.questions.length * PASS_RATIO)}개 이상</b>{' '}
                      맞히면 수료해요(제한시간 안에). 미통과해도 10분 뒤 새 문항으로 다시 도전할 수 있어요.
                    </>
                  )}
                </p>
              </div>
              <div className="ce-take-status">
                <span
                  className={`ce-timer${timeLeft <= 30 ? ' ce-timer--low' : ''}`}
                  role="timer"
                  aria-live="off"
                >
                  <i className="ph-fill ph-timer" />
                  {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:
                  {String(timeLeft % 60).padStart(2, '0')}
                </span>
                <span className="ce-answered">{answeredCount}/{session.questions.length} 선택</span>
              </div>
            </header>

            <div className="ce-qlist">
              {session.questions.map((q, qi) => {
                const sel = picks[q.question_id] ?? [];
                return (
                  <div key={q.question_id} className="ce-qcard">
                    <div className="ce-qhead">
                      <span className="ce-qnum">{qi + 1}</span>
                      <div className="ce-qmeta">
                        {q.multi && <span className="ce-multi">복수 선택</span>}
                        {q.origin === 'past_exam' && q.source && (
                          <span className="ce-source"><i className="ph-fill ph-bookmark-simple" /> {q.source}</span>
                        )}
                      </div>
                    </div>
                    <p className="ce-prompt">{q.prompt}</p>
                    {q.prompt_image_url && (
                      <img className="ce-qimg" src={API_ORIGIN + q.prompt_image_url} alt="문제 이미지" />
                    )}
                    <div className="ce-opts">
                      {q.options.map((opt, oi) => (
                        <button
                          key={oi}
                          className={`ce-opt${sel.includes(oi) ? ' ce-opt--on' : ''}`}
                          onClick={() => toggle(q.question_id, oi, q.multi)}
                        >
                          <span className="ce-optmark">
                            <i className={sel.includes(oi)
                              ? (q.multi ? 'ph-fill ph-check-square' : 'ph-fill ph-check-circle')
                              : (q.multi ? 'ph ph-square' : 'ph ph-circle')} />
                          </span>
                          {q.option_image_urls?.[oi] && (
                            <img className="ce-optimg" src={API_ORIGIN + q.option_image_urls[oi]!} alt="" />
                          )}
                          <span className="ce-opttext">{opt || (q.option_image_urls?.[oi] ? '(그림 보기)' : '')}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="ce-take-actions">
              <button className="ce-btn ce-btn--ghost" onClick={() => { setPhase('intro'); loadState(); }} disabled={submitting}>
                나중에 하기
              </button>
              <button className="ce-btn ce-btn--primary" onClick={submit} disabled={submitting}>
                <i className="ph-fill ph-check-circle" /> {submitting ? '채점 중…' : '제출하고 채점'}
              </button>
            </div>
          </section>
        )}

        {/* ===== RESULT — 결과지 ===== */}
        {phase === 'result' && result && (
          <section className="ce-result">
            <ResultHero result={result} title={state?.title ?? '수료 시험'} />

            <div className="ce-qlist">
              {result.results.map((r, ri) => (
                <div key={r.question_id} className={`ce-rcard${r.correct ? ' ce-rcard--ok' : ' ce-rcard--no'}`}>
                  <div className="ce-qhead">
                    <span className={`ce-rnum${r.correct ? ' ce-rnum--ok' : ' ce-rnum--no'}`}>
                      <i className={r.correct ? 'ph-fill ph-check' : 'ph-fill ph-x'} />
                    </span>
                    <span className="ce-rlabel">{ri + 1}번 · {r.correct ? '정답' : '오답'}</span>
                    {r.origin === 'past_exam' && r.source && (
                      <span className="ce-source"><i className="ph-fill ph-bookmark-simple" /> {r.source}</span>
                    )}
                  </div>
                  <p className="ce-prompt">{r.prompt}</p>
                  {r.prompt_image_url && (
                    <img className="ce-qimg" src={API_ORIGIN + r.prompt_image_url} alt="문제 이미지" />
                  )}
                  <div className="ce-ropts">
                    {r.options.map((opt, oi) => {
                      const isAnswer = r.answer.includes(oi);
                      const isPicked = r.picked.includes(oi);
                      return (
                        <div
                          key={oi}
                          className={`ce-ropt${isAnswer ? ' ce-ropt--answer' : ''}${isPicked && !isAnswer ? ' ce-ropt--wrong' : ''}`}
                        >
                          <span className="ce-optmark">
                            {isAnswer ? <i className="ph-fill ph-check-circle" />
                              : isPicked ? <i className="ph-fill ph-x-circle" />
                              : <i className="ph ph-circle" />}
                          </span>
                          {r.option_image_urls?.[oi] && (
                            <img className="ce-optimg" src={API_ORIGIN + r.option_image_urls[oi]!} alt="" />
                          )}
                          <span className="ce-opttext">{opt || (r.option_image_urls?.[oi] ? '(그림 보기)' : '')}</span>
                          {isAnswer && <span className="ce-answertag">정답</span>}
                          {isPicked && !isAnswer && <span className="ce-picktag">내 선택</span>}
                        </div>
                      );
                    })}
                  </div>
                  {r.explain && (
                    <div className="ce-explain">
                      <i className="ph-fill ph-lightbulb" /> {r.explain}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="ce-take-actions">
              <Link to={PATHS.STUDENT_LECTURES} className="ce-btn ce-btn--ghost">강의 목록으로</Link>
              {result.passed && (
                <button className="ce-btn ce-btn--soft" onClick={() => setCertOpen(true)}>
                  <i className="ph-fill ph-certificate" /> 수료증 보기
                </button>
              )}
              {!result.passed && (
                <button className="ce-btn ce-btn--primary" onClick={() => { setResult(null); start(); }}>
                  <i className="ph-fill ph-arrow-clockwise" /> 다시 도전
                </button>
              )}
              {result.passed && !result.perfect && (
                // 수료했지만 완벽 통과 미달 — 완벽 도전(전 문항 한 판) 재도전
                <button className="ce-btn ce-btn--primary" onClick={() => { setResult(null); start(true); }}>
                  <i className="ph-fill ph-crown" /> 완벽 도전 다시
                </button>
              )}
              {result.passed && result.perfect && (
                <button className="ce-btn ce-btn--primary" onClick={() => navigate(PATHS.STUDENT_LECTURES)}>
                  <i className="ph-fill ph-confetti" /> 완료
                </button>
              )}
            </div>
          </section>
        )}
      </div>

      {/* 제출 직후 결과 팝업 — 점수·통과 여부. 통과면 '수료증 보기'로 수료증을 연다. */}
      {resultPop && result && (
        <div className="ce-rp-back" onClick={() => setResultPop(false)} role="presentation">
          <div
            className="ce-rp"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="시험 결과"
          >
            <div
              className={`ce-rp-badge ce-rp-badge--${result.passed ? (result.perfect ? 'perfect' : 'pass') : 'fail'}`}
            >
              <i
                className={
                  result.passed
                    ? result.perfect
                      ? 'ph-fill ph-crown'
                      : 'ph-fill ph-seal-check'
                    : 'ph-fill ph-arrow-counter-clockwise'
                }
              />
              {result.passed ? (result.perfect ? '완벽 통과!' : '수료 완료!') : '아쉽게 통과하지 못했어요'}
            </div>
            <div className="ce-rp-score">
              {result.total}문항 중 <b>{result.correct}</b>개 정답
              {!result.passed && <> · 수료하려면 <b>{result.need}개 이상</b> 맞춰야 해요</>}
            </div>
            {result.passed ? (
              <div className="ce-rp-prog">
                {result.perfect ? '전 문항을 한 번에 다 맞혔어요! 🏆' : '수료 기준을 넘겨 통과했어요. 🎉'}
              </div>
            ) : (
              <div className="ce-rp-gate">
                <div className="ce-rp-gate-h">
                  <i className="ph-fill ph-timer" />{' '}
                  {retryLeft > 0 ? `${fmtMMSS(retryLeft)} 뒤 재응시` : '지금 재응시할 수 있어요'}
                </div>
                <p className="ce-rp-gate-s">
                  <b>틀린 문제를 포함한 새 {result.total}문항</b>으로 다시 도전해요
                </p>
              </div>
            )}
            <div className="ce-rp-actions">
              {result.passed ? (
                <>
                  <button className="ce-rp-btn ce-rp-btn--ghost" onClick={() => setResultPop(false)}>
                    결과 보기
                  </button>
                  <button
                    className="ce-rp-btn ce-rp-btn--primary"
                    onClick={() => {
                      setResultPop(false);
                      setCertOpen(true);
                    }}
                  >
                    <i className="ph-fill ph-certificate" /> 수료증 보기
                  </button>
                </>
              ) : (
                <>
                  <button className="ce-rp-btn ce-rp-btn--ghost" onClick={() => setResultPop(false)}>
                    결과 · 해설 보기
                  </button>
                  <button
                    className="ce-rp-btn ce-rp-btn--primary"
                    disabled={retryLeft > 0}
                    onClick={() => {
                      setResultPop(false);
                      setResult(null);
                      start();
                    }}
                  >
                    <i className="ph-fill ph-arrow-clockwise" />{' '}
                    {retryLeft > 0 ? `재응시 ${fmtMMSS(retryLeft)}` : '재응시'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 수료증 팝업 — 결과 팝업의 '수료증 보기' 또는 인트로·나의 기록 버튼으로 연다 */}
      {certOpen && (
        <CertificateModal
          courseId={courseId}
          autoTitle={state?.title}
          onClose={() => setCertOpen(false)}
        />
      )}
    </div>
  );
}

/** 인트로 — 응시 자격·진행·수료 상태를 한 카드에 (잠김/응시 가능/수료/완벽 도전). */
function IntroCard({
  state, onStart, onCertificate,
}: {
  state: ExamState;
  onStart: (perfect?: boolean) => void;
  onCertificate: () => void;
}) {
  if (!state.has_exam) {
    return (
      <div className="ce-introcard">
        <div className="ce-empty">이 코스에는 아직 수료 시험이 없어요.</div>
        <Link to={PATHS.STUDENT_LECTURES} className="ce-btn ce-btn--ghost">강의 목록으로</Link>
      </div>
    );
  }
  const pct = state.exam_size ? Math.round((state.best_correct / state.exam_size) * 100) : 0;
  return (
    <div className="ce-introcard">
      <div className="ce-introicon">
        <i className="ph-fill ph-exam" />
      </div>
      <h1 className="ce-title">{state.title} 수료 시험</h1>

      {state.passed ? (
        <>
          <div className={`ce-badge${state.perfect ? ' ce-badge--perfect' : ''}`}>
            <i className={state.perfect ? 'ph-fill ph-crown' : 'ph-fill ph-seal-check'} />
            {state.perfect ? '완벽 통과!' : '수료 완료!'}
          </div>
          <p className="ce-sub">
            {state.perfect
              ? '전 문항을 한 번에 다 맞혀 완벽하게 수료했어요. 대단해요! 🏆'
              : '수료 기준을 넘겨 이 코스를 수료했어요. 축하해요! 🎉'}
          </p>
          {state.can_perfect_challenge && (
            // 재도전 경로 — 수료했지만 완벽 통과 전이면 전 문항 한 판으로 승급 도전
            <>
              <p className="ce-sub ce-challenge-hint">
                전 문항을 한 번에 다 맞히면 <b>완벽 통과</b>로 올라가요. 도전해 볼까요?
              </p>
              <button className="ce-btn ce-btn--primary ce-btn--lg" onClick={() => onStart(true)}>
                <i className="ph-fill ph-crown" /> 완벽 도전
              </button>
            </>
          )}
          <div className="ce-intro-actions">
            <button className="ce-btn ce-btn--soft ce-btn--lg" onClick={onCertificate}>
              <i className="ph-fill ph-certificate" /> 수료증 보기
            </button>
            <Link to={PATHS.STUDENT_LECTURES} className="ce-btn ce-btn--ghost ce-btn--lg">
              강의 목록으로
            </Link>
          </div>
        </>
      ) : state.available ? (
        <>
          <p className="ce-sub">
            매 회차 <b>{state.exam_size}문항</b> 중 <b>{state.pass_need}개 이상</b> 맞히면 수료해요.
            미통과하면 <b>{state.cooldown_minutes}분 뒤</b>, 틀린 문제를 포함한 새 {state.exam_size}문항으로
            다시 도전할 수 있어요.
          </p>
          {state.attempts > 0 && (
            <div className="ce-progress">
              <div className="ce-progresshead">
                <span>최근 최고 점수</span>
                <span>{state.best_correct}/{state.exam_size}</span>
              </div>
              <div className="ce-progressbar"><div className="ce-progressfill" style={{ width: `${pct}%` }} /></div>
            </div>
          )}
          {state.retry_after_sec > 0 ? (
            <button className="ce-btn ce-btn--primary ce-btn--lg" disabled>
              <i className="ph-fill ph-hourglass-medium" /> 약 {Math.ceil(state.retry_after_sec / 60)}분 뒤 재응시
            </button>
          ) : (
            <button className="ce-btn ce-btn--primary ce-btn--lg" onClick={() => onStart(false)}>
              <i className="ph-fill ph-play" /> {state.attempts > 0 ? '다시 도전' : '시험 시작'}
            </button>
          )}
        </>
      ) : (
        <>
          <div className="ce-lock">
            <i className="ph-fill ph-lock-simple" />
            강의를 전부 완주하면 열려요
          </div>
          <p className="ce-sub">
            수료 시험은 이 코스의 강의를 모두 본 뒤에 응시할 수 있어요.
            지금 <b>{state.lectures_done}/{state.lectures_total}</b>강 완주했어요.
          </p>
          <Link to={PATHS.STUDENT_LECTURES} className="ce-btn ce-btn--primary">
            <i className="ph-fill ph-television" /> 강의 보러 가기
          </Link>
        </>
      )}
    </div>
  );
}

/** 결과지 상단 — 이번 회차 정오 + 전체 진행 + 수료/완벽 통과. */
function ResultHero({
  result, title,
}: {
  result: ExamSubmitResult;
  title: string;
}) {
  if (result.passed) {
    return (
      <div className="ce-hero ce-hero--pass">
        <span className="ce-heroseal"><i className="ph-fill ph-seal-check" /></span>
        <div className={`ce-badge${result.perfect ? ' ce-badge--perfect' : ''}`}>
          <i className={result.perfect ? 'ph-fill ph-crown' : 'ph-fill ph-seal-check'} />
          {result.perfect ? '완벽 통과!' : '수료 완료!'}
        </div>
        <h1 className="ce-title">{title} 수료를 축하해요! 🎉</h1>
        <p className="ce-sub">
          {result.perfect
            ? '전 문항을 한 번에 다 맞혔어요. 정말 대단해요!'
            : '수료 기준을 넘겨 통과했어요. 완벽 통과(전 문항)에도 도전해 보세요!'}
        </p>
      </div>
    );
  }
  return (
    <div className="ce-hero">
      <h1 className="ce-title">이번 회차 결과</h1>
      <p className="ce-sub">
        {result.total}문항 중 <b>{result.correct}</b>개 정답 · 수료 기준은 <b>{result.need}개</b>예요.
        {result.stale > 0 && (
          <><br />일부 문항({result.stale}개)이 바뀌어 다음 회차에서 새로 나와요.</>
        )}
      </p>
      <p className="ce-encourage">10분 뒤, 틀린 문제를 포함한 새 문항으로 다시 도전할 수 있어요. 조금만 더! 🌱</p>
    </div>
  );
}
