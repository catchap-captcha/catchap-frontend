import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { authApi } from '../../api/auth';
import { setTokens } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import mascot from '../../assets/characters/catchap-logo.png';
import './ActivatePage.css';

/**
 * 학생 코드 활성화 가입 — 학교가 준 가입 코드로 별명·비밀번호만 정하면 끝.
 * 이메일·인증코드 없음(저학년 개인정보 보호). 성공 시 즉시 로그인 → 학습 홈.
 */
export default function ActivatePage() {
  const navigate = useNavigate();
  const { reloadMe } = useAuth();
  const [params] = useSearchParams();
  const [step, setStep] = useState<1 | 2>(1);
  const [code, setCode] = useState((params.get('code') ?? '').toUpperCase());
  const [nickname, setNickname] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const next = () => {
    if (code.trim().length < 6) {
      setErr('가입 코드를 정확히 입력해 주세요.');
      return;
    }
    setErr('');
    setStep(2);
  };

  const submit = async () => {
    if (!nickname.trim()) return setErr('별명을 정해 주세요.');
    if (pw.length < 4) return setErr('비밀번호는 4자 이상으로 정해 주세요.');
    if (pw !== pw2) return setErr('비밀번호가 서로 달라요.');
    setErr('');
    setBusy(true);
    try {
      const tokens = await authApi.activateStudent({ code: code.trim(), nickname: nickname.trim(), password: pw });
      setTokens(tokens.access_token, tokens.refresh_token);
      await reloadMe();
      navigate(PATHS.STUDENT_HOME, { replace: true });
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setErr(typeof detail === 'string' ? detail : '가입 코드를 확인해 주세요.');
      setBusy(false);
    }
  };

  return (
    <div className="ac-root">
      <div className="ac-blob ac-blob1" />
      <div className="ac-blob ac-blob2" />
      <div className="ac-card">
        <div className="ac-mascot-row">
          <div className="ac-mascot"><img src={mascot} alt="냥이" /></div>
        </div>

        <div className="ac-steps">
          <span className={`ac-stepdot${step >= 1 ? ' ac-stepdot--on' : ''}`}>1</span>
          <span className="ac-stepline" />
          <span className={`ac-stepdot${step >= 2 ? ' ac-stepdot--on' : ''}`}>2</span>
        </div>

        {step === 1 ? (
          <>
            <h1 className="ac-title">가입 코드를 넣어줘!</h1>
            <p className="ac-sub">선생님이 준 <b>가입 코드</b>를 입력하면 냥이랑 시작할 수 있어요.</p>
            <input
              className="ac-code-input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && next()}
              placeholder="JOIN-XXXX-XXXX"
              autoFocus
            />
            {err && <div className="ac-err"><i className="ph-fill ph-warning-circle" />{err}</div>}
            <button className="ac-primary" onClick={next}><i className="ph-fill ph-arrow-right" />다음</button>
            <p className="ac-foot">이미 가입했나요? <Link to={PATHS.LOGIN} className="ac-link">로그인</Link></p>
          </>
        ) : (
          <>
            <h1 className="ac-title">나를 꾸며볼까?</h1>
            <p className="ac-sub">별명과 비밀번호만 정하면 가입 끝! <b>이메일은 필요 없어요.</b></p>
            <label className="ac-lbl">별명</label>
            <input className="ac-input" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="예: 용감한 냥이" maxLength={20} />
            <label className="ac-lbl">비밀번호</label>
            <input className="ac-input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="4자 이상" />
            <label className="ac-lbl">비밀번호 확인</label>
            <input className="ac-input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="한 번 더" />
            {err && <div className="ac-err"><i className="ph-fill ph-warning-circle" />{err}</div>}
            <div className="ac-row">
              <button className="ac-ghost" onClick={() => { setErr(''); setStep(1); }}>뒤로</button>
              <button className="ac-primary ac-primary--grow" onClick={submit} disabled={busy}>
                <i className="ph-fill ph-sparkle" />{busy ? '시작하는 중…' : '가입하고 시작!'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
