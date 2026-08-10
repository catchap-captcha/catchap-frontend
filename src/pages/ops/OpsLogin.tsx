import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { PATHS } from '../../routes/paths';
import wordmarkWhite from '../../assets/brand/catchap-wordmark-white.png';
import PasswordInput from '../../components/common/PasswordInput';
import SocialLoginButtons from '../../components/auth/SocialLoginButtons';
import ForestCaptcha from '../../components/captcha/ForestCaptcha';
// 학습자 로그인(/login)과 같은 화면 규격을 쓴다 — 문구만 다르고 레이아웃·색·간격은 동일(사용자 요청).
// 그래서 전용 스타일시트(OpsLogin.css) 없이 LoginPage.css의 lg-* 를 그대로 재사용한다.
import '../auth/LoginPage.css';
import './OpsLogin.css';

/**
 * 운영자(ops)·강사(instructor) 전용 로그인.
 * 일반 로그인 폼(/login)과 완전히 분리된 숨겨진 진입구 — 어디에도 링크하지 않는다.
 * 백엔드는 /auth/ops-login 에서만 ops·instructor 계정에 토큰을 발급하고,
 * 일반 /auth/login 은 두 역할 모두 거부한다. 강사는 로그인 후 강의 콘솔로 간다.
 *
 * 서버 에러(계정 중지·5회 실패 캡차 요구 등)는 원문을 그대로 보여준다 —
 * 전부 "정보가 올바르지 않습니다"로 뭉개면 임시비밀번호가 맞는데도
 * 원인을 모른 채 재설정만 반복하게 된다.
 *
 * 테마 토글은 App의 GlobalThemeToggle(로그인 전 전역 고정)이 담당 — 학습자 로그인과 동일.
 * (종전엔 이 페이지가 토글을 하나 더 그려 같은 자리에 두 개가 겹쳐 있었다.)
 */
/** 로그인 뒤 돌아갈 앱 내부 경로. 없거나 외부 주소면 null.
 *  ★'/'로 시작하되 '//'·'/\'가 아닌 값만 통과시킨다 — 쿼리스트링은 누구나 만들 수 있어서,
 *  검사 없이 navigate 하면 로그인 직후 외부 사이트로 튕기는 오픈 리다이렉트가 된다. */
function safeNext(value: string | null): string | null {
  return value && /^\/(?![/\\])/.test(value) ? value : null;
}

export default function OpsLogin() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const { opsLogin, me, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // 5회+ 실패 시 서버가 captcha_required를 알림 — 이후 시도는 캡차 통과 후 재시도
  const [captchaNeeded, setCaptchaNeeded] = useState(false);
  const [captchaOpen, setCaptchaOpen] = useState(false);

  // 이미 운영자/강사로 로그인돼 있으면 각자 콘솔로 보냄. (다른 역할이면 여기 머무름)
  useEffect(() => {
    if (loading) return;
    if (me?.role === 'ops') navigate(next ?? PATHS.OPS_DASHBOARD, { replace: true });
    else if (me?.role === 'instructor') navigate(next ?? PATHS.OPS_LECTURES, { replace: true });
  }, [loading, me, navigate, next]);

  const doLogin = async (captchaToken?: string) => {
    setBusy(true);
    setError('');
    try {
      const loaded = await opsLogin(email.trim(), password, captchaToken);
      setCaptchaNeeded(false);
      const dest =
        next ??
        (loaded.role === 'ops'
          ? PATHS.OPS_DASHBOARD
          : loaded.role === 'instructor'
            ? PATHS.OPS_LECTURES
            : PATHS.HOME);
      navigate(dest, { replace: true });
    } catch (err) {
      const detail = (err as {
        response?: { data?: { detail?: string | { message?: string; captcha_required?: boolean } } };
      })?.response?.data?.detail;
      const detailObj = typeof detail === 'object' && detail !== null ? detail : undefined;
      if (detailObj?.captcha_required) {
        // 캡차 요구 시 모달을 즉시 연다 — 버튼 재클릭을 기다리면 "완료해 주세요" 안내만
        // 뜨고 정작 풀 캡차가 안 보여 갇힌 것처럼 느껴진다(benja123 신고).
        setCaptchaNeeded(true);
        setCaptchaOpen(true);
      }
      const msg =
        (typeof detail === 'string' ? detail : detailObj?.message) ??
        '운영자 계정 정보가 올바르지 않습니다.';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!email.trim() || !password) {
      setError('아이디와 비밀번호를 입력해 주세요.');
      return;
    }
    if (captchaNeeded) setCaptchaOpen(true);
    else void doLogin();
  };

  // 메인 캡차 통과 → 단일사용 토큰을 실어 재시도
  const onCaptchaToken = (token: string) => {
    setCaptchaOpen(false);
    void doLogin(token);
  };

  return (
    <div className="lg-root">
      {/* LEFT BRAND PANEL — 학습자 로그인과 같은 구조. 문구만 콘솔용. */}
      <div className="lg-left">
        <div className="lg-left-pin">
          <Link to={PATHS.HOME} className="lg-brand" title="메인으로">
            <img src={wordmarkWhite} alt="CATCHAP" className="lg-brand-wordmark" />
          </Link>
          <div className="lg-hero">
            <h1 className="lg-hero-title">
              운영자와 강사를 위한
              <br />
              관리 콘솔
            </h1>
            <p className="lg-hero-sub">
              기관 승인, 강의·문항 검수, 행동 데이터, 시스템 상태를 한곳에서 운영합니다. 접근
              권한은 계정 역할에 따라 자동으로 제한됩니다.
            </p>
          </div>
          <div className="lg-badges">
            <span>내부 전용 · 초대제</span>
            <span className="lg-badge-dot" />
            <span>역할 기반 접근 제어</span>
            <span className="lg-badge-dot" />
            <span>감사 로그 기록</span>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL — 학습자 로그인 폼과 동일 규격 */}
      <div className="lg-right">
        <form className="lg-login" onSubmit={submit}>
          <h2 className="lg-h2">운영자·강사 로그인</h2>
          <p className="lg-login-sub">내부 운영자와 초대받은 강사 전용 페이지입니다</p>

          <label className="lg-label">아이디 (이메일)</label>
          <div className="lg-field lg-mb16">
            <i className="ph ph-user-circle lg-field-icon" />
            <input
              type="text"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="계정 이메일을 입력해 주세요"
              className="lg-input"
            />
          </div>

          <label className="lg-label">비밀번호</label>
          <div className="lg-field lg-mb12">
            <i className="ph ph-lock-key lg-field-icon" />
            <PasswordInput
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력해 주세요"
              className="lg-input"
            />
          </div>

          {/* 학습자 로그인의 '로그인 유지 / 찾기' 줄과 같은 자리.
              콘솔 계정은 공용 PC 사용을 가정해 로그인 유지를 두지 않고 찾기 링크만 오른쪽에 둔다. */}
          <div className="lg-rememberrow opl-findonly">
            <span className="lg-findrow">
              <Link to={PATHS.FIND_ID} className="lg-forgot">
                아이디 찾기
              </Link>
              <span className="lg-findsep" aria-hidden="true" />
              <Link to={PATHS.PASSWORD_RESET} className="lg-forgot">
                비밀번호를 잊으셨나요?
              </Link>
            </span>
          </div>

          {error && (
            <div className="lg-formerr">
              <i className="ph-fill ph-warning-circle" />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="lg-primary" disabled={busy}>
            <i className="ph-bold ph-sign-in" />
            {busy ? '확인 중…' : captchaNeeded ? '보안 확인 후 로그인' : '로그인'}
          </button>

          {/* 간편 로그인 — 콘솔 계정은 프로필에서 직접 연결한 경우에만 통한다.
              연결하지 않은 계정은 서버가 400과 함께 연결 방법을 알려 준다(자동 연결 없음). */}
          <SocialLoginButtons withDivider />

          <div className="lg-divider">
            <div className="lg-divider-line" />
            <span>또는</span>
            <div className="lg-divider-line" />
          </div>
          <button type="button" onClick={() => navigate(PATHS.LOGIN)} className="lg-secondary">
            <i className="ph ph-student" />
            학습자 로그인
          </button>

          <div className="lg-notice">
            <i className="ph ph-info" />
            <p>
              이 페이지는 외부에 노출되지 않는 내부 진입구입니다. 접근 권한이 없으면 로그인이
              거부되며, 모든 시도는 감사 로그에 기록됩니다.
            </p>
          </div>
        </form>
      </div>

      {captchaOpen && (
        <div className="opl-cap-overlay" onClick={() => setCaptchaOpen(false)}>
          <div className="opl-cap-box" onClick={(e) => e.stopPropagation()}>
            <div className="opl-cap-head">
              <span>보안 확인</span>
              <button type="button" className="opl-cap-close" onClick={() => setCaptchaOpen(false)}>
                <i className="ph-bold ph-x" />
              </button>
            </div>
            <ForestCaptcha onToken={onCaptchaToken} />
          </div>
        </div>
      )}
    </div>
  );
}
