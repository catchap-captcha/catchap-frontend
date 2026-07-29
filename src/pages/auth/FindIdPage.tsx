import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { authApi, type FoundAccount } from '../../api/auth';
import wordmarkWhite from '../../assets/brand/catchap-wordmark-white.png';
import './PasswordResetPage.css'; // 레이아웃·단계표시(pr-*)를 비밀번호 재설정과 공유한다
import './FindIdPage.css';

/**
 * 아이디 찾기 — 가입 이메일로 본인 확인 후 로그인 아이디를 알려주는 화면.
 *
 * 비밀번호 재설정(/password-reset)과 같은 2단(브랜드 패널 + 카드) 레이아웃·단계 표시를 그대로
 * 쓴다(pr-* 클래스 재사용). 다른 건 마지막 단계뿐 — 새 비밀번호를 받는 대신 찾은 아이디를 보여준다.
 *
 * 서버에 `/auth/find-id` 가 아직 없어서(백엔드 미구현) 그 경우 '준비 중' 안내로 분기한다.
 * 뭉뚱그린 실패로 보이지 않게, 준비 중과 진짜 오류를 구분해서 알린다.
 */

type Step = 'email' | 'code' | 'done';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_TTL_SECONDS = 5 * 60; // 백엔드 인증 코드 만료(5분)와 동기화

const ROLE_LABEL: Record<string, string> = {
  student: '학습자',
  parent: '학부모',
  instructor: '강사',
  ops: '운영자',
};

export default function FindIdPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [emailErr, setEmailErr] = useState('');
  const [codeErr, setCodeErr] = useState('');
  const [busy, setBusy] = useState(false);

  const [accounts, setAccounts] = useState<FoundAccount[]>([]);
  /** 서버에 아이디 찾기 엔드포인트가 없을 때 — 실패가 아니라 '미구현'임을 구분해 알린다 */
  const [unavailable, setUnavailable] = useState(false);

  const [remain, setRemain] = useState(CODE_TTL_SECONDS);
  const timerRef = useRef<number | null>(null);
  const expired = remain <= 0;
  const fmtRemain = `${String(Math.floor(remain / 60)).padStart(2, '0')}:${String(remain % 60).padStart(2, '0')}`;

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

  /** 1단계 — 가입 이메일로 6자리 인증코드 발송 */
  const sendCode = async () => {
    if (!EMAIL_RE.test(email)) {
      setEmailErr('이메일 형식을 확인해 주세요.');
      return;
    }
    setBusy(true);
    setEmailErr('');
    try {
      await authApi.sendEmailCode(email.trim(), 'reset');
      setStep('code');
      setCode('');
      setCodeErr('');
      startTimer();
    } catch (e) {
      setEmailErr(detailOf(e, '인증코드를 보내지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    try {
      await authApi.sendEmailCode(email.trim(), 'reset');
    } catch {
      /* 재전송 실패는 타이머만 되돌리고 흐름은 유지 — 사용자는 다시 누를 수 있다 */
    } finally {
      setBusy(false);
    }
    setCode('');
    setCodeErr('');
    startTimer();
  };

  /** 2단계 — 코드로 본인 확인 + 아이디 조회(서버가 한 번에 처리) */
  const submitCode = async () => {
    if (code.trim().length !== 6) {
      setCodeErr('6자리 인증코드를 입력해 주세요.');
      return;
    }
    if (expired) {
      setCodeErr('인증코드가 만료됐어요. 재전송을 눌러 주세요.');
      return;
    }
    setBusy(true);
    setCodeErr('');
    try {
      const res = await authApi.findId(email.trim(), code.trim());
      setAccounts(res.accounts ?? []);
      setUnavailable(false);
      setStep('done');
    } catch (e) {
      // 서버에 아직 엔드포인트가 없는 경우(404/405/501)와 진짜 실패(코드 불일치 등)를 나눈다.
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 404 || status === 405 || status === 501) {
        setUnavailable(true);
        setAccounts([]);
        setStep('done');
      } else {
        setCodeErr(detailOf(e, '인증코드가 올바르지 않아요. 다시 확인해 주세요.'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pr-page">
      {/* LEFT BRAND PANEL */}
      <div className="pr-left">
        <Link to={PATHS.LOGIN} className="pr-brand">
          <img src={wordmarkWhite} alt="CATCHAP" className="pr-brand-wordmark" />
        </Link>

        <div className="pr-hero">
          {/* 문구·줄바꿈을 비밀번호 재설정('비밀번호를 / 잊어버렸나요?')과 같은 형태로 맞춘다 */}
          <h1 className="pr-title">
            아이디를
            <br />
            잊어버렸나요?
          </h1>
          <p className="pr-desc">
            가입하신 이메일로 인증코드를 보내드려요. 본인 확인이 끝나면 그 이메일로 만든 아이디를
            알려드릴게요.
          </p>
        </div>

        {/* 로그인 패널 하단(.lg-badges)과 같은 '텍스트 · 점' 형태 */}
        <div className="pr-chips">
          <span>이메일 본인확인</span>
          <span className="pr-chip-dot" />
          <span>아이디 안내</span>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="pr-right">
        <div className="pr-card">
          <Link to={PATHS.LOGIN} className="pr-back">
            <i className="ph-bold ph-arrow-left pr-back-icon"></i>로그인으로 돌아가기
          </Link>

          {/* STEP INDICATOR — 2단계 흐름(이메일 → 인증).
              .pr-bar가 flex:1이라 막대가 하나뿐인 2단계에선 폭을 통째로 먹어 점 두 개가
              카드 양 끝으로 벌어진다. 3단계(비밀번호 재설정)와 같은 리듬이 되게 폭을 제한한다. */}
          <div className="pr-steps fid-steps">
            <span className={`pr-step ${step === 'email' ? 'pr-step-active' : 'pr-step-done'}`}>
              {step === 'email' ? '1' : <i className="ph-bold ph-check"></i>}
            </span>
            <span className={`pr-bar ${step === 'email' ? '' : 'pr-bar-done'}`}></span>
            <span
              className={`pr-step ${
                step === 'code' ? 'pr-step-active' : step === 'done' ? 'pr-step-done' : 'pr-step-idle'
              }`}
            >
              {step === 'done' ? <i className="ph-bold ph-check"></i> : '2'}
            </span>
          </div>

          {step === 'email' && (
            <>
              <h2 className="pr-h2">아이디 찾기</h2>
              <p className="pr-sub">가입할 때 사용한 이메일 주소를 입력해 주세요.</p>

              <label className="pr-label">이메일</label>
              <div className="pr-field">
                <i className="ph ph-envelope-simple pr-input-icon"></i>
                <input
                  type="email"
                  autoComplete="email"
                  className={`pr-input${emailErr ? ' pr-input-error' : ''}`}
                  placeholder="example@catchap.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailErr('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && !busy && void sendCode()}
                />
              </div>
              {emailErr && <p className="fid-err">{emailErr}</p>}

              <button className="pr-btn" onClick={sendCode} disabled={busy}>
                <i className="ph-bold ph-paper-plane-tilt pr-btn-icon"></i>
                {busy ? '보내는 중…' : '인증코드 받기'}
              </button>

              <div className="pr-info">
                <i className="ph-fill ph-info pr-info-icon"></i>
                <p className="pr-info-text">
                  운영자·강사 계정은 아이디가 이메일 주소 그 자체예요. 학습자 아이디를 찾을 때
                  이용해 주세요.
                </p>
              </div>
            </>
          )}

          {step === 'code' && (
            <>
              <h2 className="pr-h2">인증코드 입력</h2>
              <p className="pr-sub pr-sub-code">
                <span className="pr-strong">{email}</span> 으로 보낸 6자리 코드를 입력해 주세요.
              </p>

              <label className="pr-label">인증코드</label>
              <div className="pr-field">
                <input
                  inputMode="numeric"
                  maxLength={6}
                  className={`pr-input pr-input-code${codeErr ? ' pr-input-error' : ''}`}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, ''));
                    setCodeErr('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && !busy && void submitCode()}
                />
              </div>
              {codeErr && <p className="fid-err">{codeErr}</p>}

              <div className="pr-timer-row">
                <span className="pr-timer">
                  <i className="ph-fill ph-clock pr-timer-icon"></i>
                  {expired ? '만료됨' : fmtRemain}
                </span>
                <button className="pr-resend" onClick={resend} disabled={busy}>
                  재전송
                </button>
              </div>

              <button className="pr-btn" onClick={submitCode} disabled={busy}>
                <i className="ph-bold ph-magnifying-glass pr-btn-icon"></i>
                {busy ? '확인 중…' : '아이디 찾기'}
              </button>

              <button className="pr-again" onClick={() => setStep('email')} disabled={busy}>
                이메일 다시 입력하기
              </button>
            </>
          )}

          {step === 'done' && (
            <div className="pr-done">
              {unavailable ? (
                <>
                  <span className="pr-done-badge fid-badge-wait">
                    <i className="ph-fill ph-hourglass-medium pr-done-badge-icon"></i>
                  </span>
                  <h2 className="pr-done-title">아직 준비 중이에요</h2>
                  <p className="pr-done-sub">
                    이 서버에는 아이디 찾기 기능이 아직 열려 있지 않아요. 조금만 기다려 주세요.
                  </p>
                  <div className="fid-hint">
                    <p>
                      <i className="ph-fill ph-lightbulb" /> 그동안은 이렇게 확인할 수 있어요
                    </p>
                    <ul>
                      <li>운영자·강사·학부모 계정은 아이디가 가입 이메일 주소와 같아요.</li>
                      <li>학습자 아이디는 고객지원으로 문의하면 확인해 드려요.</li>
                    </ul>
                  </div>
                  <Link className="pr-done-btn" to={PATHS.SUPPORT}>
                    고객지원 문의하기
                  </Link>
                </>
              ) : accounts.length > 0 ? (
                <>
                  <span className="pr-done-badge">
                    <i className="ph-fill ph-check-circle pr-done-badge-icon"></i>
                  </span>
                  <h2 className="pr-done-title">아이디를 찾았어요</h2>
                  <p className="pr-done-sub">
                    <span className="pr-strong">{email}</span> 으로 가입된 계정이에요.
                  </p>

                  <ul className="fid-list">
                    {accounts.map((a) => (
                      <li key={`${a.role}-${a.login_id}`} className="fid-item">
                        <span className="fid-role">{ROLE_LABEL[a.role] ?? a.role}</span>
                        <span className="fid-loginid">{a.login_id}</span>
                        {a.created_at && (
                          <span className="fid-created">
                            {new Date(a.created_at).toLocaleDateString('ko-KR')} 가입
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>

                  <Link className="pr-done-btn" to={PATHS.LOGIN}>
                    로그인하러 가기
                  </Link>
                </>
              ) : (
                <>
                  <span className="pr-done-badge fid-badge-wait">
                    <i className="ph-fill ph-magnifying-glass pr-done-badge-icon"></i>
                  </span>
                  <h2 className="pr-done-title">가입된 계정이 없어요</h2>
                  <p className="pr-done-sub">
                    <span className="pr-strong">{email}</span> 으로 만든 계정을 찾지 못했어요. 다른
                    이메일로 가입하셨는지 확인해 주세요.
                  </p>
                  <button className="pr-done-btn" onClick={() => setStep('email')}>
                    다른 이메일로 찾기
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** 서버가 준 detail 문구를 꺼낸다(없으면 fallback). */
function detailOf(e: unknown, fallback: string): string {
  const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === 'string' && detail) return detail;
  if (detail && typeof detail === 'object') {
    const msg = (detail as { message?: unknown }).message;
    if (typeof msg === 'string' && msg) return msg;
  }
  return fallback;
}
