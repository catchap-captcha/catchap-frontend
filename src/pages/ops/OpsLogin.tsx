import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { PATHS } from '../../routes/paths';
import mascot from '../../assets/characters/catchap-logo.png';
import './OpsLogin.css';
import PasswordInput from '../../components/common/PasswordInput';

/**
 * 운영자(ops) 전용 로그인.
 * 일반 로그인 폼(/login)과 완전히 분리된 숨겨진 진입구 — 어디에도 링크하지 않는다.
 * 백엔드는 /auth/ops-login 에서만 ops 계정에 토큰을 발급하고,
 * 일반 /auth/login 은 ops 계정을 거부한다.
 */
export default function OpsLogin() {
  const navigate = useNavigate();
  const { opsLogin, me, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // 이미 운영자로 로그인돼 있으면 콘솔로 보냄. (다른 역할이면 여기 머무름)
  useEffect(() => {
    if (!loading && me?.role === 'ops') {
      navigate(PATHS.OPS_APPROVAL, { replace: true });
    }
  }, [loading, me, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    if (!email.trim() || !password) {
      setError('아이디와 비밀번호를 입력해 주세요.');
      return;
    }
    setBusy(true);
    try {
      const loaded = await opsLogin(email.trim(), password);
      navigate(loaded.role === 'ops' ? PATHS.OPS_APPROVAL : PATHS.HOME, { replace: true });
    } catch {
      setError('운영자 계정 정보가 올바르지 않습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="opl-root">
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
          운영자 로그인
        </h1>
        <p className="opl-sub">내부 운영자 전용 페이지입니다.</p>

        <label className="opl-label">아이디(이메일)</label>
        <div className="opl-field">
          <i className="ph-fill ph-user-circle" />
          <input
            type="text"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="운영자 이메일"
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
          {busy ? '확인 중…' : '로그인'}
        </button>
      </form>
    </div>
  );
}
