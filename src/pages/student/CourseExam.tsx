import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import {
  API_ORIGIN,
  lectureApi,
  type ExamResultItem,
  type ExamSession,
  type ExamState,
} from '../../api/lectures';
import { StudentNav } from '../../layouts/StudentLayout';
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

export default function CourseExam() {
  const [params] = useSearchParams();
  const courseId = params.get('course') ?? '';
  const navigate = useNavigate();

  const [state, setState] = useState<ExamState | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [phase, setPhase] = useState<Phase>('intro');
  const [session, setSession] = useState<ExamSession | null>(null);
  // 문항별 선택(표시 순서 기준 인덱스 집합). question_id → Set<displayIdx>
  const [picks, setPicks] = useState<Record<string, number[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    total: number; correct: number; results: ExamResultItem[];
    progress: { mastered: number; total: number }; passed: boolean; perfect: boolean; stale: number;
  } | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  // 수료증 팝업 — 합격 직후 자동으로 열고(아래 submit), 인트로·결과지 버튼으로도 다시 연다.
  // 발급 자체(서버 수료 검증 → 캔버스 렌더 → 저장)는 CertificateModal이 맡는다.
  const [certOpen, setCertOpen] = useState(false);
  // 오답 쿨다운 남은 시간(초). 방금 틀린 문항은 잠시 뒤에 다시 나온다 — 빈 시험을 보여주는
  // 대신 언제 열리는지 알려주고 초 단위로 줄여 준다.
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [cooldownMin, setCooldownMin] = useState(0);

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
      });
      setResult(res as any);
      setPhase('result');
      // 합격 처리 직후 수료증을 바로 보여준다(사용자 요청). 닫아도 인트로·나의 기록에서 다시 열 수 있다.
      if ((res as any)?.passed) setCertOpen(true);
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
            <h1 className="ce-cd-title">잠시 뒤에 다시 풀 수 있어요</h1>
            <p className="ce-cd-sub">
              방금 틀린 문항은 해설을 충분히 읽도록 {cooldownMin}분 뒤에 다시 나와요.
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
                {cooldownLeft > 0 ? '기다리는 중…' : '이어서 풀기'}
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
                      이번 회차 {session.questions.length}문항 · 다 맞히지 못한 문항은 다음 회차에 다시 나와요.
                      {session.progress && (
                        <> 지금까지 <b>{session.progress.mastered}/{session.progress.total}</b> 정복.</>
                      )}
                    </>
                  )}
                </p>
              </div>
              <span className="ce-answered">{answeredCount}/{session.questions.length} 선택</span>
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
            <p className="ce-hint">
              선택하지 않은 문항은 오답으로 처리돼요(찍기 강요 없음 — 모르면 다음 회차에 다시 도전).
            </p>
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
                  <i className="ph-fill ph-arrow-right" /> 다음 회차 풀기
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

      {/* 수료증 팝업 — 합격 직후 자동 노출 + 버튼으로 다시 열기 */}
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
  const pct = state.question_count ? Math.round((state.mastered_count / state.question_count) * 100) : 0;
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
              : '이 코스의 모든 시험 문항을 정복했어요. 수료를 축하해요! 🎉'}
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
          <button className="ce-btn ce-btn--soft ce-btn--lg" onClick={onCertificate}>
            <i className="ph-fill ph-certificate" /> 수료증 보기
          </button>
          <Link to={PATHS.STUDENT_LECTURES} className="ce-btn ce-btn--ghost">강의 목록으로</Link>
        </>
      ) : state.available ? (
        <>
          <p className="ce-sub">
            문항 <b>{state.question_count}</b>개를 모두 맞히면 수료해요. 틀린 문항은 다음 회차에 다시
            나오니 부담 없이 도전하세요.
          </p>
          <div className="ce-progress">
            <div className="ce-progresshead">
              <span>정복 진행</span>
              <span>{state.mastered_count}/{state.question_count}</span>
            </div>
            <div className="ce-progressbar"><div className="ce-progressfill" style={{ width: `${pct}%` }} /></div>
          </div>
          <button className="ce-btn ce-btn--primary ce-btn--lg" onClick={() => onStart(false)}>
            <i className="ph-fill ph-play" /> {state.mastered_count > 0 ? '이어서 풀기' : '시험 시작'}
          </button>
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
  result: { total: number; correct: number; progress: { mastered: number; total: number };
    passed: boolean; perfect: boolean; stale: number };
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
            : '이 코스의 모든 시험 문항을 정복했어요. 완벽 통과에도 도전해 보세요!'}
        </p>
      </div>
    );
  }
  return (
    <div className="ce-hero">
      <h1 className="ce-title">이번 회차 결과</h1>
      <p className="ce-sub">
        {result.total}문항 중 <b>{result.correct}</b>개 정답 · 지금까지{' '}
        <b>{result.progress.mastered}/{result.progress.total}</b> 정복했어요.
        {result.stale > 0 && (
          <><br />일부 문항({result.stale}개)이 바뀌어 다음 회차에서 새로 나와요.</>
        )}
      </p>
      <p className="ce-encourage">틀린 문항은 다음 회차에 다시 나와요. 한 문항씩 정복해 수료까지 가봐요! 🌱</p>
    </div>
  );
}
