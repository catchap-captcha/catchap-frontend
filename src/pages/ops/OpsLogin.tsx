import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { PATHS } from '../../routes/paths';
import mascot from '../../assets/characters/catchap-logo.png';
import './OpsLogin.css';
import PasswordInput from '../../components/common/PasswordInput';
import ForestCaptcha from '../../components/captcha/ForestCaptcha';
import ThemeToggle from '../../components/common/ThemeToggle';

/**
 * 운영자(ops)·강사(instructor) 전용 로그인.
 * 일반 로그인 폼(/login)과 완전히 분리된 숨겨진 진입구 — 어디에도 링크하지 않는다.
 * 백엔드는 /auth/ops-login 에서만 ops·instructor 계정에 토큰을 발급하고,
 * 일반 /auth/login 은 두 역할 모두 거부한다. 강사는 로그인 후 강의 콘솔로 간다.
 *
 * 서버 에러(계정 중지·5회 실패 캡차 요구 등)는 원문을 그대로 보여준다 —
 * 전부 "정보가 올바르지 않습니다"로 뭉개면 임시비밀번호가 맞는데도
 * 원인을 모른 채 재설정만 반복하게 된다.
 */
export default function OpsLogin() {
  const navigate = useNavigate();
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
    if (me?.role === 'ops') navigate(PATHS.OPS_APPROVAL, { replace: true });
    else if (me?.role === 'instructor') navigate(PATHS.OPS_LECTURES, { replace: true });
  }, [loading, me, navigate]);

  const doLogin = async (captchaToken?: string) => {
    setBusy(true);
    setError('');
    try {
      const loaded = await opsLogin(email.trim(), password, captchaToken);
      setCaptchaNeeded(false);
      const dest =
        loaded.role === 'ops'
          ? PATHS.OPS_APPROVAL
          : loaded.role === 'instructor'
            ? PATHS.OPS_LECTURES
            : PATHS.HOME;
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
    <div className="opl-root">
      <ThemeToggle className="theme-toggle--fixed" />
      <form className="opl-card" onSubmit={submit}>
        <div className="opl-brand">
          <img src={mascot} alt="CatChap" className="opl-logo" />
          <div>
            <div className="opl-brand-name">CatChap</div>
            <div className="opl-brand-sub">운영 콘솔</div>
          </div>
        </div>

        <h1 className="opl-title">
          <i className="ph-fill ph-shield-star" />
          운영자·강사 로그인
        </h1>
        <p className="opl-sub">내부 운영자와 초대받은 강사 전용 페이지입니다.</p>

        <label className="opl-label">아이디(이메일)</label>
        <div className="opl-field">
          <i className="ph-fill ph-user-circle" />
          <input
            type="text"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="계정 이메일"
            className="opl-input"
          />
        </div>

        <label className="opl-label">비밀번호</label>
        <div className="opl-field">
          <i className="ph-fill ph-lock-key" />
          <PasswordInput
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            className="opl-input"
          />
        </div>

        {error && (
          <div className="opl-error">
            <i className="ph-fill ph-warning-circle" />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" className="opl-btn" disabled={busy}>
          <i className="ph-fill ph-sign-in" />
          {busy ? '확인 중…' : captchaNeeded ? '보안 확인 후 로그인' : '로그인'}
        </button>
      </form>

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
