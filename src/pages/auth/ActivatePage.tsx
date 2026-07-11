import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { authApi } from '../../api/auth';
import { setTokens } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import mascot from '../../assets/characters/catchap-logo.png';
import './ActivatePage.css';
import PasswordInput from '../../components/common/PasswordInput';

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
  const [loginId, setLoginId] = useState('');
  // 아이디 중복 확인 상태 — 'available'이어야 가입 진행 가능
  const [idCheck, setIdCheck] = useState<'idle' | 'checking' | 'available' | 'taken' | 'empty'>('idle');
  // 중복일 때 서버가 주는 사용 가능한 추천 아이디 (아이가 중복으로 계속 막히지 않도록)
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [nickname, setNickname] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const next = async () => {
    const c = code.trim();
    if (c.length < 6) {
      setErr('가입 코드를 정확히 입력해 주세요.');
      return;
    }
    setErr('');
    setBusy(true);
    try {
      // 아이디/비번 단계로 넘어가기 전에 코드를 먼저 서버 검증(소비 안 함).
      // 없는 코드·이미 가입에 쓴 코드·만료 코드면 여기서 막는다.
      const r = await authApi.verifyJoinCode(c);
      if (!r.valid) {
        setErr(
          r.reason === 'used'
            ? '이미 가입에 사용된 코드예요. 처음 가입할 때 받은 새 코드를 넣어 주세요.'
            : r.reason === 'expired'
              ? '코드가 만료됐어요. 선생님께 새 코드를 받아 주세요.'
              : '가입 코드가 올바르지 않아요. 다시 확인해 주세요.',
        );
        return;
      }
      setStep(2);
    } catch {
      setErr('코드를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  const checkId = (idArg?: string) => {
    const id = (idArg ?? loginId).trim();
    if (id.length < 3) {
      setIdCheck('empty');
      setSuggestions([]);
      return;
    }
    setIdCheck('checking');
    authApi
      .checkStudentId(id)
      .then((r) => {
        setIdCheck(r.available ? 'available' : 'taken');
        setSuggestions(r.available ? [] : r.suggestions);
      })
      .catch(() => {
        setIdCheck('taken');
        setSuggestions([]);
      });
  };

  // 추천 아이디를 누르면 그 값으로 채우고 바로 다시 확인 (사용 가능 표시)
  const pickSuggestion = (id: string) => {
    setLoginId(id);
    setSuggestions([]);
    checkId(id);
  };

  const submit = async () => {
    if (idCheck !== 'available') return setErr('아이디 중복 확인을 먼저 해주세요.');
    if (!nickname.trim()) return setErr('별명을 정해 주세요.');
    if (pw.length < 4) return setErr('비밀번호는 4자 이상으로 정해 주세요.');
    if (pw !== pw2) return setErr('비밀번호가 서로 달라요.');
    setErr('');
    setBusy(true);
    try {
      const tokens = await authApi.activateStudent({
        code: code.trim(),
        student_login_id: loginId.trim(),
        nickname: nickname.trim(),
        password: pw,
      });
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
            <button className="ac-primary" onClick={next} disabled={busy}>
              <i className="ph-fill ph-arrow-right" />{busy ? '코드 확인 중…' : '다음'}
            </button>
            <p className="ac-foot">이미 가입했나요? <Link to={PATHS.LOGIN} className="ac-link">로그인</Link></p>
          </>
        ) : (
          <>
            <h1 className="ac-title">나를 꾸며볼까?</h1>
            <p className="ac-sub">아이디·별명·비밀번호만 정하면 가입 끝! <b>이메일은 필요 없어요.</b></p>
            <label className="ac-lbl">아이디</label>
            <div className="ac-idrow">
              <input
                className="ac-input ac-input--grow"
                value={loginId}
                onChange={(e) => { setLoginId(e.target.value); setIdCheck('idle'); }}
                placeholder="로그인할 때 쓸 아이디 (3자 이상)"
                maxLength={30}
              />
              <button
                type="button"
                className={'ac-idbtn' + (idCheck === 'available' ? ' ac-idbtn--ok' : '')}
                onClick={() => checkId()}
                disabled={idCheck === 'checking'}
              >
                {idCheck === 'available' ? '사용 가능' : idCheck === 'checking' ? '확인 중…' : '중복 확인'}
              </button>
            </div>
            {idCheck === 'available' && (
              <p className="ac-idmsg ac-idmsg--ok"><i className="ph-fill ph-check-circle" />이 아이디를 쓸 수 있어요.</p>
            )}
            {idCheck === 'taken' && (
              <p className="ac-idmsg ac-idmsg--bad"><i className="ph-fill ph-warning-circle" />이미 쓰고 있는 아이디예요. 다른 걸로 정해 줘.</p>
            )}
            {idCheck === 'taken' && suggestions.length > 0 && (
              <div className="ac-suggests">
                <span className="ac-suggests-lb"><i className="ph-fill ph-lightbulb" />이런 아이디는 어때?</span>
                <div className="ac-suggests-row">
                  {suggestions.map((s) => (
                    <button key={s} type="button" className="ac-suggest" onClick={() => pickSuggestion(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {idCheck === 'empty' && (
              <p className="ac-idmsg ac-idmsg--bad"><i className="ph-fill ph-warning-circle" />아이디를 3자 이상 넣고 중복 확인을 눌러 줘.</p>
            )}
            <label className="ac-lbl">별명</label>
            <input className="ac-input" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="예: 용감한 냥이" maxLength={20} />
            <label className="ac-lbl">비밀번호</label>
            <PasswordInput className="ac-input" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="4자 이상" />
            <label className="ac-lbl">비밀번호 확인</label>
            <PasswordInput className="ac-input" value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="한 번 더" />
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
