import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { authApi } from '../../api/auth';
import mascot from '../../assets/characters/catchap-logo.png';
import './PasswordResetPage.css';
import PasswordInput from '../../components/common/PasswordInput';

type Step = 'email' | 'code' | 'reset' | 'done';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_TTL_SECONDS = 5 * 60; // 백엔드 인증 코드 만료(5분)와 동기화

export default function PasswordResetPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [emailErr, setEmailErr] = useState(false);
  const [codeErr, setCodeErr] = useState(false);
  const [pw1Err, setPw1Err] = useState(false);
  const [pw2Err, setPw2Err] = useState(false);

  // 실제 카운트다운 — 코드 발송 시 5:00부터 감소, 0이면 만료(재전송 유도)
  const [remain, setRemain] = useState(CODE_TTL_SECONDS);
  const timerRef = useRef<number | null>(null);
  const expired = remain <= 0;

  const startTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setRemain(CODE_TTL_SECONDS);
    timerRef.current = window.setInterval(() => {
      setRemain((s) => {
        if (s <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  useEffect(
    () => () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    },
    [],
  );

  const fmtRemain = `${String(Math.floor(remain / 60)).padStart(2, '0')}:${String(remain % 60).padStart(2, '0')}`;

  const toCode = async () => {
    if (!EMAIL_RE.test(email)) {
      setEmailErr(true);
      return;
    }
    try {
      await authApi.passwordResetRequest(email);
      setStep('code');
      startTimer();
    } catch {
      setEmailErr(true);
    }
  };

  const resend = async () => {
    // 재전송: 타이머 5:00부터 재시작 (성공/실패와 무관하게 화면 흐름은 원본 그대로)
    try {
      await authApi.passwordResetRequest(email);
    } catch {
      /* no-op */
    }
    setCode('');
    setCodeErr(false);
    startTimer();
  };

  const toReset = () => {
    if (expired) {
      setCodeErr(true);
      return;
    }
    if (code.length === 6) {
      setStep('reset');
    } else {
      setCodeErr(true);
    }
  };

  const toDone = async () => {
    const shortPw = pw1.length < 8;
    const mismatch = pw1 !== pw2;
    if (shortPw || mismatch) {
      setPw1Err(shortPw);
      setPw2Err(mismatch);
      return;
    }
    try {
      await authApi.passwordResetConfirm(email, code, pw1);
      setStep('done');
    } catch {
      setPw1Err(true);
      setPw2Err(true);
    }
  };

  return (
    <div className="pr-page">
      {/* LEFT BRAND PANEL */}
      <div className="pr-left">
        <div className="pr-deco-1"></div>
        <div className="pr-deco-2"></div>
        <div className="pr-deco-3"></div>
        <div className="pr-deco-4"></div>

        <Link to={PATHS.LOGIN} className="pr-brand">
          <div className="pr-brand-badge">
            <img src={mascot} alt="CatChap" className="pr-brand-img" />
          </div>
          <span className="pr-brand-name">CatChap</span>
        </Link>

        <div className="pr-hero">
          <div className="pr-hero-row">
            <div className="pr-mascot">
              <img src={mascot} alt="마스코트" className="pr-mascot-img" />
              <span className="pr-mascot-badge">
                <i className="ph-fill ph-key pr-mascot-badge-icon"></i>
              </span>
            </div>
          </div>
          <h1 className="pr-title">
            비밀번호를
            <br />
            잊어버렸나요?
          </h1>
          <p className="pr-desc">
            가입하신 이메일로 인증코드를 보내드려요. 본인 확인 후 새 비밀번호를 안전하게 설정할 수
            있어요.
          </p>
        </div>

        <div className="pr-chips">
          <span className="pr-chip">
            <i className="ph-fill ph-envelope-simple pr-chip-icon"></i>이메일 본인확인
          </span>
          <span className="pr-chip">
            <i className="ph-fill ph-shield-check pr-chip-icon"></i>안전한 비밀번호 보호
          </span>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="pr-right">
        <div className="pr-card">
          <Link to={PATHS.LOGIN} className="pr-back">
            <i className="ph-bold ph-arrow-left pr-back-icon"></i>로그인으로 돌아가기
          </Link>

          {/* STEP INDICATOR */}
          {step === 'email' && (
            <div className="pr-steps">
              <span className="pr-step pr-step-active">1</span>
              <span className="pr-bar"></span>
              <span className="pr-step pr-step-idle">2</span>
              <span className="pr-bar"></span>
              <span className="pr-step pr-step-idle">3</span>
            </div>
          )}
          {step === 'code' && (
            <div className="pr-steps">
              <span className="pr-step pr-step-done">
                <i className="ph-bold ph-check"></i>
              </span>
              <span className="pr-bar pr-bar-done"></span>
              <span className="pr-step pr-step-active">2</span>
              <span className="pr-bar"></span>
              <span className="pr-step pr-step-idle">3</span>
            </div>
          )}
          {step === 'reset' && (
            <div className="pr-steps">
              <span className="pr-step pr-step-done">
                <i className="ph-bold ph-check"></i>
              </span>
              <span className="pr-bar pr-bar-done"></span>
              <span className="pr-step pr-step-done">
                <i className="ph-bold ph-check"></i>
              </span>
              <span className="pr-bar pr-bar-done"></span>
              <span className="pr-step pr-step-active">3</span>
            </div>
          )}
          {step === 'done' && (
            <div className="pr-steps">
              <span className="pr-step pr-step-done">
                <i className="ph-bold ph-check"></i>
              </span>
              <span className="pr-bar pr-bar-done"></span>
              <span className="pr-step pr-step-done">
                <i className="ph-bold ph-check"></i>
              </span>
              <span className="pr-bar pr-bar-done"></span>
              <span className="pr-step pr-step-done">
                <i className="ph-bold ph-check"></i>
              </span>
            </div>
          )}

          {/* ===== STEP 1: EMAIL ===== */}
          {step === 'email' && (
            <div>
              <h2 className="pr-h2">이메일 확인</h2>
              <p className="pr-sub">
                가입하신 이메일 주소를 입력하면
                <br />
                비밀번호 재설정 인증코드를 보내드려요.
              </p>

              <label className="pr-label">이메일 주소</label>
              <div className="pr-field pr-field-email">
                <i className="ph-fill ph-envelope-simple pr-input-icon"></i>
                <input
                  type="email"
                  placeholder="example@email.com"
                  className={`pr-input${emailErr ? ' pr-input-error' : ''}`}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailErr(false);
                  }}
                />
              </div>

              <button onClick={toCode} className="pr-btn">
                <i className="ph-fill ph-paper-plane-tilt pr-btn-icon"></i>인증코드 받기
              </button>

              <div className="pr-info">
                <i className="ph-fill ph-info pr-info-icon"></i>
                <p className="pr-info-text">
                  학생 계정은 보호자 또는 소속 기관 이메일로 재설정할 수 있어요.
                </p>
              </div>
            </div>
          )}

          {/* ===== STEP 2: CODE ===== */}
          {step === 'code' && (
            <div>
              <h2 className="pr-h2">인증코드 입력</h2>
              <p className="pr-sub pr-sub-code">
                <strong className="pr-strong">{email || 'example@email.com'}</strong> 으로
                <br />
                보내드린 6자리 코드를 입력해 주세요.
              </p>

              <label className="pr-label">인증코드</label>
              <div className="pr-field pr-field-code">
                <i className="ph-fill ph-shield-check pr-input-icon"></i>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="6자리 코드"
                  className={`pr-input pr-input-code${codeErr ? ' pr-input-error' : ''}`}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setCodeErr(false);
                  }}
                />
              </div>

              <div className="pr-timer-row">
                <span className="pr-timer">
                  <i className="ph-fill ph-clock pr-timer-icon"></i>
                  {expired ? '코드가 만료됐어요 — 재전송해 주세요' : `${fmtRemain} 남음`}
                </span>
                <button onClick={resend} className="pr-resend">
                  코드 재전송
                </button>
              </div>

              <button onClick={toReset} className="pr-btn">
                <i className="ph-fill ph-check-circle pr-btn-icon"></i>코드 확인
              </button>

              <button onClick={() => setStep('email')} className="pr-again">
                이메일 주소를 잘못 입력했나요?
              </button>
            </div>
          )}

          {/* ===== STEP 3: NEW PASSWORD ===== */}
          {step === 'reset' && (
            <div>
              <h2 className="pr-h2">새 비밀번호 설정</h2>
              <p className="pr-sub">새로 사용할 비밀번호를 입력해 주세요.</p>

              <label className="pr-label">새 비밀번호</label>
              <div className="pr-field pr-field-pw1">
                <i className="ph-fill ph-lock-key pr-input-icon"></i>
                <PasswordInput
                  placeholder="8자 이상 입력해 주세요"
                  className={`pr-input${pw1Err ? ' pr-input-error' : ''}`}
                  value={pw1}
                  onChange={(e) => {
                    setPw1(e.target.value);
                    setPw1Err(false);
                  }}
                />
              </div>

              <label className="pr-label">새 비밀번호 확인</label>
              <div className="pr-field pr-field-pw2">
                <i className="ph-fill ph-lock-key-open pr-input-icon"></i>
                <PasswordInput
                  placeholder="비밀번호를 다시 입력해 주세요"
                  className={`pr-input${pw2Err ? ' pr-input-error' : ''}`}
                  value={pw2}
                  onChange={(e) => {
                    setPw2(e.target.value);
                    setPw2Err(false);
                  }}
                />
              </div>

              <div className="pr-rules">
                <div className="pr-rules-title">비밀번호 조건</div>
                <div className="pr-rules-list">
                  <span className="pr-rule">
                    <i className="ph-fill ph-check-circle pr-rule-icon"></i>8자 이상
                  </span>
                  <span className="pr-rule">
                    <i className="ph-fill ph-check-circle pr-rule-icon"></i>영문·숫자 조합
                  </span>
                  <span className="pr-rule">
                    <i className="ph-fill ph-check-circle pr-rule-icon"></i>이전 비밀번호와 다르게
                  </span>
                </div>
              </div>

              <button onClick={toDone} className="pr-btn">
                <i className="ph-fill ph-lock-key pr-btn-icon"></i>비밀번호 변경하기
              </button>
            </div>
          )}

          {/* ===== STEP 4: DONE ===== */}
          {step === 'done' && (
            <div className="pr-done">
              <div className="pr-done-badge">
                <i className="ph-fill ph-check-circle pr-done-badge-icon"></i>
              </div>
              <h2 className="pr-h2 pr-done-title">비밀번호가 변경되었어요!</h2>
              <p className="pr-done-sub">
                새 비밀번호로 다시 로그인해 주세요.
                <br />
                고양이 친구가 기다리고 있어요 🐱
              </p>
              <Link to={PATHS.LOGIN} className="pr-done-btn">
                <i className="ph-fill ph-sign-in pr-btn-icon"></i>로그인하러 가기
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
