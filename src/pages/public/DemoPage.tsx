import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import './DemoPage.css';

/**
 * 가입 없이 둘러보는 '체험 모드'(/demo) — 랜딩 히어로에서 진입.
 * ★자체완결: 실 API·계정·결제를 전혀 건드리지 않는다(읽기전용). 번호로 나뉜 3구간으로 훑는다:
 *   1) 시청 검증(재생 중 확인 문제) — 이 제품의 핵심 차별점을 직접 조작
 *   2) 문제은행 맛보기 — 한 문제 풀어보기
 *   3) 더 있어요 — 수료증 등 기능 정리(+수료증 미니 미리보기)
 *  콘텐츠(강의·문항)는 서비스 소개용 예시.
 */
const LECTURE = { subject: '클라우드', chapter: 'AWS IAM 입문 · 2강', title: '사용자와 그룹으로 권한 관리하기' };
const DURATION_LABEL = '2:36';
const DURATION_SEC = 156;

type Checkpoint = { at: number; q: string; options: string[]; answer: number };
const CHECKPOINTS: Checkpoint[] = [
  {
    at: 34,
    q: '여러 사용자에게 같은 권한을 한 번에 주려면 어떻게 하나요?',
    options: [
      '사용자마다 정책을 하나씩 복사해 붙인다',
      'IAM 그룹에 정책을 연결하고 사용자를 그룹에 넣는다',
      '루트 계정을 함께 쓴다',
      '모두에게 AdministratorAccess를 준다',
    ],
    answer: 1,
  },
  {
    at: 74,
    q: '최소 권한 원칙(least privilege)에 가장 맞는 설정은?',
    options: [
      '필요한 작업에 필요한 권한만 부여한다',
      '혹시 모르니 AdministratorAccess를 준다',
      '액세스 키를 소스 코드에 하드코딩한다',
      '권한을 안 줘서 아무것도 못 하게 한다',
    ],
    answer: 0,
  },
];

const BANK = {
  subject: 'IT 기초',
  level: '난이도 ★★☆',
  q: 'HTTP 상태 코드 404는 무엇을 뜻하나요?',
  options: ['요청 성공', '서버 내부 오류', '요청한 자원을 찾을 수 없음', '권한 없음'],
  answer: 2,
};

const FEATURES = [
  { icon: 'ph-certificate', title: '수료증 발급', desc: '코스를 수료하면 수료증을 발급·다운로드해요.' },
  { icon: 'ph-chart-line-up', title: '나의 학습 기록', desc: '시청 시간·정답률·완주율을 한눈에.' },
  { icon: 'ph-notebook', title: '오답노트', desc: '틀린 확인 문제만 모아 복습해요.' },
  { icon: 'ph-cards-three', title: '문제은행', desc: '과목별 연습 문제로 실력을 다져요.' },
  { icon: 'ph-exam', title: '수료 시험', desc: '코스 완전학습을 시험으로 확인해요.' },
  { icon: 'ph-target', title: '맞춤 추천', desc: '관심사·기록으로 다음 강의를 추천해요.' },
];

function SecHead({ num, kicker, title, desc }: { num: number; kicker: string; title: string; desc: string }) {
  return (
    <div className="dm-sec-head">
      <span className="dm-sec-num">{num}</span>
      <div className="dm-sec-headtext">
        <span className="dm-sec-kicker">{kicker}</span>
        <h2 className="dm-sec-title">{title}</h2>
        <p className="dm-sec-desc">{desc}</p>
      </div>
    </div>
  );
}

export default function DemoPage() {
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [quizIdx, setQuizIdx] = useState<number | null>(null);
  const [passed, setPassed] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [wrong, setWrong] = useState(false);
  const [done, setDone] = useState(false);

  const [bankSel, setBankSel] = useState<number | null>(null);
  const [bankGraded, setBankGraded] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setProgress((p) => Math.min(100, p + 0.6)), 55);
    return () => window.clearInterval(id);
  }, [playing]);

  useEffect(() => {
    if (done) return;
    if (quizIdx === null) {
      const cp = CHECKPOINTS.findIndex((c, i) => !passed.includes(i) && progress >= c.at);
      if (cp !== -1) {
        setPlaying(false);
        setProgress(CHECKPOINTS[cp].at);
        setQuizIdx(cp);
        setSelected(null);
        setWrong(false);
        return;
      }
    }
    if (progress >= 100) {
      setPlaying(false);
      setDone(true);
    }
  }, [progress, passed, quizIdx, done]);

  const play = () => {
    setStarted(true);
    setPlaying(true);
  };
  const submit = () => {
    if (quizIdx === null || selected === null) return;
    if (selected === CHECKPOINTS[quizIdx].answer) {
      setPassed((ps) => [...ps, quizIdx]);
      setQuizIdx(null);
      setWrong(false);
      setPlaying(true);
    } else {
      setWrong(true);
    }
  };
  const restart = () => {
    setStarted(false);
    setPlaying(false);
    setProgress(0);
    setQuizIdx(null);
    setPassed([]);
    setSelected(null);
    setWrong(false);
    setDone(false);
  };

  const mmss = (pct: number) => {
    const s = Math.round((pct / 100) * DURATION_SEC);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const cp = quizIdx !== null ? CHECKPOINTS[quizIdx] : null;

  return (
    <div className="dm-root">
      <header className="dm-top">
        <Link to={PATHS.HOME} className="dm-back">
          <i className="ph-bold ph-arrow-left" /> 메인
        </Link>
        <span className="dm-badge">
          <i className="ph-fill ph-play-circle" /> 체험 모드 · 가입 없이 둘러보는 중
        </span>
        <Link to={PATHS.LOGIN} className="dm-signup">
          회원가입
        </Link>
      </header>

      <div className="dm-wrap">
        {/* ── 1. 시청 검증 ── */}
        <section className="dm-sec">
          <SecHead
            num={1}
            kicker="시청 검증"
            title="이게 시청 검증이에요"
            desc="재생 중 무작위 시점에 확인 문제가 떠요. 건너뛰기·배속·딴짓으론 못 풀죠 — 그래서 “봤다”가 증명됩니다. 직접 재생을 눌러보세요."
          />

          <div className="dm-player">
            <div className="dm-scene">
              <span className="dm-scene-tag">
                {LECTURE.subject} · {LECTURE.chapter}
              </span>
              <div className="dm-scene-mid">
                <div className="dm-scene-title">{LECTURE.title}</div>
                {!started && (
                  <button type="button" className="dm-bigplay" onClick={play}>
                    <i className="ph-fill ph-play" /> 재생하기
                  </button>
                )}
              </div>
              {started && !cp && !done && (
                <span className={'dm-live' + (playing ? ' is-on' : '')}>
                  <span className="dm-live-dot" /> {playing ? '재생 중' : '일시정지'}
                </span>
              )}
            </div>

            {cp && (
              <div className="dm-quiz" role="dialog" aria-label="시청 확인 문제">
                <div className="dm-quiz-card">
                  <span className="dm-quiz-kicker">
                    <i className="ph-fill ph-seal-question" /> 확인 문제 · 지금 화면에 답하기
                  </span>
                  <p className="dm-quiz-q">{cp.q}</p>
                  <div className="dm-quiz-opts">
                    {cp.options.map((o, i) => (
                      <button
                        key={o}
                        type="button"
                        className={
                          'dm-opt' +
                          (selected === i ? ' is-sel' : '') +
                          (wrong && selected === i ? ' is-wrong' : '')
                        }
                        onClick={() => {
                          setSelected(i);
                          setWrong(false);
                        }}
                      >
                        <span className="dm-opt-mark">{'ABCD'[i]}</span>
                        {o}
                      </button>
                    ))}
                  </div>
                  {wrong && (
                    <p className="dm-quiz-hint">
                      <i className="ph-fill ph-lightbulb" /> 그 대목을 한 번 더 보면 답이 보여요.
                      편하게 다시 골라 주세요.
                    </p>
                  )}
                  <button type="button" className="dm-quiz-submit" onClick={submit} disabled={selected === null}>
                    답 제출
                  </button>
                </div>
              </div>
            )}

            {done && (
              <div className="dm-done">
                <div className="dm-done-card">
                  <i className="ph-fill ph-check-circle dm-done-ic" />
                  <h3>시청 완료 — 검증됐어요</h3>
                  <p>
                    방금 그 과정이 CatChap의 <b>시청 검증</b>이에요. 실제 서비스에선 시청 데이터와
                    확인 문제 기록이 남아 “진짜 학습”을 증명합니다.
                  </p>
                  <button type="button" className="dm-cta-ghost" onClick={restart}>
                    다시 체험
                  </button>
                </div>
              </div>
            )}

            <div className="dm-bar">
              <button
                type="button"
                className="dm-playbtn"
                onClick={() => (done ? restart() : setPlaying((v) => !v))}
                disabled={cp !== null}
                aria-label={playing ? '일시정지' : '재생'}
              >
                <i className={'ph-fill ' + (done ? 'ph-arrow-counter-clockwise' : playing ? 'ph-pause' : 'ph-play')} />
              </button>
              <div className="dm-track">
                <div className="dm-fill" style={{ width: `${progress}%` }} />
                {CHECKPOINTS.map((c, i) => (
                  <span
                    key={c.at}
                    className={'dm-cpmark' + (passed.includes(i) ? ' is-passed' : '')}
                    style={{ left: `${c.at}%` }}
                    title="확인 문제 지점"
                  />
                ))}
              </div>
              <span className="dm-time">
                {mmss(progress)} / {DURATION_LABEL}
              </span>
            </div>
          </div>

          <div className="dm-points">
            <div className="dm-point">
              <i className="ph-bold ph-fast-forward" />
              <div>
                <b>건너뛰기·배속 차단</b>
                <span>안 본 구간은 서버가 막아요.</span>
              </div>
            </div>
            <div className="dm-point">
              <i className="ph-bold ph-seal-question" />
              <div>
                <b>무작위 시점 확인 문제</b>
                <span>실제로 본 사람만 풀 수 있어요.</span>
              </div>
            </div>
            <div className="dm-point">
              <i className="ph-bold ph-shield-check" />
              <div>
                <b>시청 = 증명</b>
                <span>수료가 곧 학습의 증거가 됩니다.</span>
              </div>
            </div>
          </div>
          <p className="dm-note">가입 없이 보는 체험이에요. 강의·문항은 서비스 소개용 예시입니다.</p>
        </section>

        {/* ── 2. 문제은행 ── */}
        <section className="dm-sec">
          <SecHead
            num={2}
            kicker="문제은행"
            title="과목별 연습 문제도 풀어봐요"
            desc="강의 밖에서도 문제은행으로 실력을 다져요. 아래 한 문제를 풀어보세요."
          />
          <div className="dm-bank">
            <div className="dm-bank-meta">
              <span className="dm-bank-subj">{BANK.subject}</span>
              <span className="dm-bank-lvl">{BANK.level}</span>
            </div>
            <p className="dm-bank-q">{BANK.q}</p>
            <div className="dm-bank-opts">
              {BANK.options.map((o, i) => {
                const state = !bankGraded
                  ? bankSel === i
                    ? ' is-sel'
                    : ''
                  : i === BANK.answer
                    ? ' is-correct'
                    : bankSel === i
                      ? ' is-wrong'
                      : '';
                return (
                  <button
                    key={o}
                    type="button"
                    className={'dm-bank-opt' + state}
                    disabled={bankGraded}
                    onClick={() => setBankSel(i)}
                  >
                    <span className="dm-opt-mark">{'ABCD'[i]}</span>
                    {o}
                  </button>
                );
              })}
            </div>
            {!bankGraded ? (
              <button
                type="button"
                className="dm-bank-submit"
                disabled={bankSel === null}
                onClick={() => setBankGraded(true)}
              >
                채점하기
              </button>
            ) : (
              <div className={'dm-bank-result' + (bankSel === BANK.answer ? ' is-ok' : ' is-no')}>
                <p>
                  <b>{bankSel === BANK.answer ? '정답이에요!' : '아쉬워요.'}</b>
                </p>
                <button
                  type="button"
                  className="dm-bank-retry"
                  onClick={() => {
                    setBankSel(null);
                    setBankGraded(false);
                  }}
                >
                  <i className="ph-bold ph-arrow-counter-clockwise" /> 다시 풀기
                </button>
              </div>
            )}
          </div>
          <p className="dm-note">실제 문제은행엔 과목별 수백 문항이 있어요. 여긴 한 문제 예시.</p>
        </section>

        {/* ── 3. 더 있어요 ── */}
        <section className="dm-sec">
          <SecHead
            num={3}
            kicker="더 있어요"
            title="가입하면 이런 것도 써요"
            desc="수료증부터 학습 기록·오답노트까지 — 학습을 끝까지 이어가게 돕는 기능들."
          />

          <div className="dm-cert">
            <div className="dm-cert-paper">
              <span className="dm-cert-kicker">CERTIFICATE · 수료증</span>
              <div className="dm-cert-title">AWS IAM 입문</div>
              <p className="dm-cert-body">
                위 학습자는 본 과정의 모든 강의를 <b>시청 검증</b>을 통과하며 수료하였음을 증명합니다.
              </p>
              <div className="dm-cert-foot">
                <span>발급 · CatChap</span>
                <span>2026.08.10</span>
              </div>
              <i className="ph-fill ph-seal-check dm-cert-seal" />
            </div>
            <div className="dm-cert-say">
              <h3>진짜 본 사람에게만 나가는 수료증</h3>
              <p>
                코스를 수료하면 이런 수료증이 발급돼요. 시청 검증을 통과한 기록이 근거라, “틀어만
                놓은” 이수와는 무게가 달라요. PDF로 내려받아 제출할 수 있어요.
              </p>
            </div>
          </div>

          <div className="dm-feats">
            {FEATURES.map((f) => (
              <div key={f.title} className="dm-feat">
                <i className={`ph-bold ${f.icon}`} />
                <div>
                  <b>{f.title}</b>
                  <span>{f.desc}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="dm-note">
            강사·기업 기능(강의 업로드·AI 문항 생성·학습 분석)은 로그인 후 또는 도입 문의로 안내해요.
          </p>
        </section>

        {/* ── 최종 CTA ── */}
        <section className="dm-final">
          <h2 className="dm-final-h">지금 CatChap 시작하기</h2>
          <p className="dm-final-p">가입하면 실제 강의·수료증·학습 기록으로 이어집니다.</p>
          <div className="dm-final-cta">
            <Link to={PATHS.LOGIN} className="dm-cta-primary">
              지금 시작하기
            </Link>
            <Link to={PATHS.CONTACT} className="dm-cta-outline">
              도입 문의
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
