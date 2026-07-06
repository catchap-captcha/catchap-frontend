import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import mascot from '../../assets/characters/catchap-logo.png';
import './CaptchaPage.css';

type Phase = 'challenge' | 'success' | 'locked';
type Slot = 'loading' | 'ready';

export default function CaptchaPage() {
  // The actual challenge is served by the CatChap Guard API and mounted into #captcha-mount.
  // This component only renders the surrounding widget chrome + lifecycle states.
  const [phase, setPhase] = useState<Phase>('challenge');
  const [slot, setSlot] = useState<Slot>('loading');
  const [error, setError] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [seconds, setSeconds] = useState(0);

  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;
  const slotRef = useRef<Slot>(slot);
  slotRef.current = slot;
  const attemptsRef = useRef(attempts);
  attemptsRef.current = attempts;
  const loadT = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Simulates fetching a challenge from the API; real integration replaces this with the SDK mount call.
  const loadChallenge = () => {
    setSlot('loading');
    setError(false);
    if (loadT.current) clearTimeout(loadT.current);
    loadT.current = setTimeout(() => setSlot('ready'), 1100);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      if (phaseRef.current === 'challenge') setSeconds((s) => s + 1);
    }, 1000);
    loadChallenge();
    return () => {
      clearInterval(timer);
      if (loadT.current) clearTimeout(loadT.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shuffle = () => {
    loadChallenge();
  };

  // In production this reads the token from the mounted widget and verifies server-side.
  // Demo: first check "fails" to show the retry button; after retry the next check succeeds.
  // Wire to the API result (token valid / risk cleared) in real use.
  const verify = () => {
    if (slotRef.current !== 'ready') return;
    if (attemptsRef.current === 0) {
      setAttempts(1);
      setError(true);
      setErrorText('앗, 다시 한 번 해볼까요? 문제를 완료하고 눌러요.');
      return;
    }
    setPhase('success');
  };

  const retryChallenge = () => {
    setError(false);
    loadChallenge();
  };

  const restart = () => {
    setPhase('challenge');
    setError(false);
    setAttempts(0);
    setSeconds(0);
    loadChallenge();
  };

  const isChallenge = phase === 'challenge';
  const isSuccess = phase === 'success';
  const isLocked = phase === 'locked';
  const slotReady = slot === 'ready';
  const slotLoading = slot === 'loading';
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  const timerLabel = (mm > 0 ? mm + 'm ' : '') + (ss < 10 ? '0' + ss : ss) + 's';

  // warm palette per phase
  let hc1 = '#FF8A5B';
  let hc2 = '#FF5A4D';
  let hTitle = '사람인지 확인해요 🐱';
  let hSub = '냥이랑 잠깐 확인하고 이어가요';
  if (isSuccess) {
    hc1 = '#33C892';
    hc2 = '#17B08C';
    hTitle = '확인되었어요!';
    hSub = '정상 사용자로 확인됐어요';
  }
  if (isLocked) {
    hc1 = '#FFB43C';
    hc2 = '#FF922E';
    hTitle = '조금 쉬어가요';
    hSub = '잠시 후 다시 시도할 수 있어요';
  }

  return (
    <div className="cp-page">
      {/* floating cute shapes */}
      <div className="cp-shape1"></div>
      <div className="cp-shape2"></div>
      <div className="cp-shape3"></div>
      <div className="cp-shape4"></div>

      {/* WIDGET */}
      <div className="cp-widget">
        {/* peeking mascot */}
        <div className="cp-peek">
          <div className="cp-peek-float">
            <img src={mascot} alt="냥냥이" className="cp-peek-img" />
          </div>
        </div>

        <div className={`cp-shell${error ? ' cp-shell-shake' : ''}`}>
          {/* HEADER */}
          <div
            className="cp-header"
            style={{ '--cp-hc1': hc1, '--cp-hc2': hc2 } as React.CSSProperties}
          >
            <div className="cp-guard-chip">
              <i className="ph-fill ph-cat cp-guard-icon"></i>
              <span className="cp-guard-text">냥이 지킴이</span>
            </div>
            <div className="cp-h-title">{hTitle}</div>
            <div className="cp-h-sub">{hSub}</div>
          </div>

          {/* BODY */}
          <div className="cp-body">
            {/* WHY BANNER */}
            {isChallenge && (
              <div className="cp-why">
                <span className="cp-why-icon">
                  <i className="ph-fill ph-hand-waving cp-why-icon-i"></i>
                </span>
                <span className="cp-why-text">
                  평소와 조금 다른 접속이 보여서 한 번만 확인할게요. 사람이라면 아주 쉬워요! 🐾
                </span>
              </div>
            )}

            {/* CHALLENGE (API-mounted captcha slot) */}
            {isChallenge && (
              <>
                <div className="cp-ch-row">
                  <span className="cp-prompt">아래에서 문제를 풀어요</span>
                  <button onClick={shuffle} title="새 문제 불러오기" className="cp-shuffle">
                    <i className="ph-bold ph-arrow-clockwise cp-shuffle-icon"></i>
                  </button>
                </div>

                {/* ▼▼▼ CAPTCHA API MOUNT SLOT — 실제 캡챠 위젯이 이 컨테이너 안에 렌더링됩니다 ▼▼▼ */}
                <div id="captcha-mount" data-captcha-slot="true" className="cp-slot">
                  {slotLoading && (
                    <div className="cp-loading">
                      <div className="cp-spinner"></div>
                      <span className="cp-loading-text">냥이가 문제를 준비하고 있어요…</span>
                      <span className="cp-loading-api">GET /v1/captcha/challenge</span>
                    </div>
                  )}
                  {slotReady && (
                    <div className="cp-ready">
                      <span className="cp-ready-icon">
                        <i className="ph-fill ph-puzzle-piece cp-ready-icon-i"></i>
                      </span>
                      <span className="cp-ready-title">API 캡챠 위젯 자리</span>
                      <span className="cp-ready-desc">
                        실제 챌린지(그림 고르기·퍼즐 등)는 CatChap Guard API가
                        <br />이 컨테이너에 쏙 넣어줘요. <code className="cp-ready-code">#captcha-mount</code>
                      </span>
                    </div>
                  )}
                </div>
                {/* ▲▲▲ CAPTCHA API MOUNT SLOT ▲▲▲ */}

                {error && (
                  <div className="cp-error">
                    <i className="ph-fill ph-warning-circle cp-error-icon"></i>
                    <span className="cp-error-text">{errorText}</span>
                  </div>
                )}

                {/* timer */}
                <div className="cp-timer-row">
                  <span className="cp-timer">
                    <i className="ph-fill ph-timer cp-timer-icon"></i>
                    {timerLabel}
                  </span>
                </div>

                {error && (
                  <button onClick={retryChallenge} className="cp-retry">
                    <i className="ph-bold ph-arrow-clockwise cp-btn-icon"></i>다시 해볼게요
                  </button>
                )}
                {!error && (
                  <button onClick={verify} className="cp-verify">
                    <i className="ph-fill ph-check-circle cp-btn-icon"></i>확인했어요!
                  </button>
                )}
              </>
            )}

            {/* SUCCESS */}
            {isSuccess && (
              <div className="cp-success">
                <div className="cp-success-float">
                  <img src={mascot} alt="마스코트" className="cp-success-img" />
                  <span className="cp-success-seal">
                    <i className="ph-fill ph-seal-check cp-success-seal-icon"></i>
                  </span>
                </div>
                <h2 className="cp-success-title">확인 완료! 🎉</h2>
                <p className="cp-success-sub">
                  사람인 게 확인됐어요.
                  <br />
                  이어서 재미있게 학습해요!
                </p>
                <Link to={PATHS.STUDENT_HOME} className="cp-success-btn">
                  학습 계속하기 <i className="ph-fill ph-arrow-right cp-success-arrow"></i>
                </Link>
              </div>
            )}

            {/* LOCKED */}
            {isLocked && (
              <div className="cp-locked">
                <div className="cp-locked-float">
                  <img src={mascot} alt="마스코트" className="cp-locked-img" />
                  <span className="cp-locked-badge">
                    <i className="ph-fill ph-moon-stars cp-locked-badge-icon"></i>
                  </span>
                </div>
                <h2 className="cp-locked-title">잠깐 쉬어가요 😴</h2>
                <p className="cp-locked-sub">
                  여러 번 확인에 실패했어요. 잠시 후 다시 하거나
                  <br />
                  선생님·부모님께 도움을 요청해요.
                </p>
                <button onClick={restart} className="cp-locked-btn">
                  <i className="ph-bold ph-arrow-clockwise cp-locked-btn-icon"></i>다시 해볼게요
                </button>
              </div>
            )}
          </div>

          {/* FOOTER */}
          <div className="cp-footer">
            <span className="cp-foot-brand">
              <i className="ph-fill ph-shield-check cp-foot-shield"></i>CatChap Guard가 지켜줘요
            </span>
            <div className="cp-foot-links">
              <a href="#" className="cp-foot-link">
                도움말
              </a>
              <span className="cp-foot-dot">·</span>
              <Link to={PATHS.ORG_SECURITY_POLICY} className="cp-foot-link">
                개인정보
              </Link>
            </div>
          </div>
        </div>

        {/* risk chip under widget */}
        <div className="cp-risk">
          <span className="cp-risk-dot"></span>
          <span className="cp-risk-text">
            위험 신호 <b className="cp-risk-b">보통</b> · 조작 미숙과는 따로 채점돼요
          </span>
        </div>
      </div>
    </div>
  );
}
