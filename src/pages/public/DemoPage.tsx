import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import './DemoPage.css';

/**
 * 가입 없이 둘러보는 '체험 모드'(/demo) — 랜딩 히어로에서 진입.
 * ★자체완결: 실 API·계정·결제를 전혀 건드리지 않는다(읽기전용). 샘플 강의 1개로 이 제품의
 *  유일한 차별점 — '재생 중 확인 문제로 시청을 검증' — 을 직접 눌러 경험하게 한다.
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

export default function DemoPage() {
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [quizIdx, setQuizIdx] = useState<number | null>(null);
  const [passed, setPassed] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [wrong, setWrong] = useState(false);
  const [done, setDone] = useState(false);

  // 재생 — 진행률 전진(가짜 타임라인)
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setProgress((p) => Math.min(100, p + 0.6)), 55);
    return () => window.clearInterval(id);
  }, [playing]);

  // 체크포인트(확인 문제) / 완료 감시
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
      setPlaying(true); // 통과 → 이어서 재생
    } else {
      setWrong(true); // 오답 → 다시 보고 답하게(건너뛰기 방지)
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
        <div className="dm-intro">
          <h1 className="dm-h1">
            이게 <b>시청 검증</b>이에요
          </h1>
          <p className="dm-sub">
            재생 중 무작위 시점에 확인 문제가 떠요. 건너뛰기·배속·딴짓으론 못 풀죠 — 그래서 “봤다”가
            증명됩니다. <b>직접 재생을 눌러보세요.</b>
          </p>
        </div>

        <div className="dm-stage">
          <div className="dm-player">
            <div className="dm-scene">
              <span className="dm-scene-tag">
                {LECTURE.subject} · {LECTURE.chapter}
              </span>
              <div className="dm-scene-title">{LECTURE.title}</div>
              {!started && (
                <button type="button" className="dm-bigplay" onClick={play}>
                  <i className="ph-fill ph-play" /> 재생하기
                </button>
              )}
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
                      <i className="ph-fill ph-warning" /> 그 대목을 다시 보고 답해 주세요 — 찍어선
                      통과 못 해요.
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
                  <h2>시청 완료 — 검증됐어요</h2>
                  <p>
                    방금 그 과정이 CatChap의 <b>시청 검증</b>이에요. 실제 서비스에선 시청 데이터와
                    확인 문제 기록이 남아 “진짜 학습”을 증명합니다.
                  </p>
                  <div className="dm-done-cta">
                    <Link to={PATHS.LOGIN} className="dm-cta-primary">
                      지금 시작하기
                    </Link>
                    <button type="button" className="dm-cta-ghost" onClick={restart}>
                      다시 체험
                    </button>
                  </div>
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

          <aside className="dm-side">
            <div className="dm-side-item">
              <i className="ph-bold ph-fast-forward" />
              <div>
                <b>건너뛰기·배속 차단</b>
                <span>안 본 구간은 서버가 막아요.</span>
              </div>
            </div>
            <div className="dm-side-item">
              <i className="ph-bold ph-seal-question" />
              <div>
                <b>무작위 시점 확인 문제</b>
                <span>실제로 본 사람만 풀 수 있어요.</span>
              </div>
            </div>
            <div className="dm-side-item">
              <i className="ph-bold ph-shield-check" />
              <div>
                <b>시청 = 증명</b>
                <span>수료가 곧 학습의 증거가 됩니다.</span>
              </div>
            </div>
            <p className="dm-side-note">* 가입 없이 보는 체험이에요. 강의·문항은 소개용 예시입니다.</p>
          </aside>
        </div>
      </div>
    </div>
  );
}
