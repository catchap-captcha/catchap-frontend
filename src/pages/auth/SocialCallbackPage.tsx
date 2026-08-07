/**
 * 소셜 로그인 착지 페이지 — provider가 code·state를 들고 돌려보내는 곳(/auth/social/callback).
 *
 * 세 갈래로 끝난다:
 *   1) 이미 연결된 계정 / 검증된 이메일로 기존 계정에 연결 → 토큰 저장 후 역할 홈으로
 *   2) 신규 → 서버가 signup_required + signup_token만 준다(계정은 아직 없다).
 *      여기서 별명·생년월일·약관 동의를 받아 /auth/social/signup 으로 가입을 마친다.
 *      ★생년월일을 여기서 받는 이유: 만 14세 미만 보호자 동의 게이트 때문이다. provider가
 *      생년월일을 안 주는 경우(구글은 항상, 카카오·네이버는 미동의 시)가 있어, 서버는 이 값을
 *      받기 전에는 계정을 만들지 않는다.
 *   3) 실패(동의 거부·만료·이미 쓰는 이메일 등) → 사유를 보여 주고 로그인으로 되돌린다.
 *
 * '연결하기'로 출발한 경우(intent=connect)는 로그인이 아니라 연결 API를 부르고 출발한 화면으로
 * 돌아간다(학생 마이페이지 / 콘솔 프로필 — 경로는 출발할 때 sessionStorage에 남겨 둔다).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AxiosError } from 'axios';
import {
  clearSocialIntent,
  readSocialIntent,
  readSocialReturn,
  resolveCallbackProvider,
  socialApi,
  type SocialLoginResponse,
  type SocialProvider,
} from '../../api/social';
import { setTokens } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { PATHS } from '../../routes/paths';
import { ROLE_HOME } from '../../routes/roleRoutes';
import './SocialCallbackPage.css';

const LABELS: Record<SocialProvider, string> = {
  kakao: '카카오',
  naver: '네이버',
  google: '구글',
};

function errorMessage(err: unknown, fallback: string): string {
  const detail = (err as AxiosError<{ detail?: string | { message?: string } }>)?.response?.data
    ?.detail;
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object' && typeof detail.message === 'string')
    return detail.message;
  return fallback;
}

/** 만 나이 — 생일이 안 지났으면 1 뺀다(서버 _age_on과 같은 규칙). */
function ageOn(birth: string): number | null {
  const b = new Date(birth);
  if (Number.isNaN(b.getTime())) return null;
  const t = new Date();
  let age = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate()))
    age -= 1;
  return age;
}

export default function SocialCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { reloadMe } = useAuth();

  const [phase, setPhase] = useState<'working' | 'signup' | 'error'>('working');
  const [error, setError] = useState('');
  const [provider, setProvider] = useState<SocialProvider | null>(null);
  const [signup, setSignup] = useState<SocialLoginResponse | null>(null);
  // 연결(connect) 왕복이 실패했을 때 되돌아갈 곳. 로그인 왕복이면 null이라 로그인 화면으로 간다.
  // (콘솔 사용자를 학생 로그인으로 보내지 않기 위해 출발지를 기억한다)
  const [returnTo, setReturnTo] = useState<string | null>(null);

  // 가입 폼
  const [nickname, setNickname] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 인가 코드는 1회용이다. StrictMode의 이중 실행이나 새로고침으로 두 번 보내면
  // 두 번째가 반드시 실패하므로, 교환은 이 화면에서 정확히 한 번만 시작한다.
  const started = useRef(false);

  const finishLogin = useCallback(
    async (tokens: { access_token: string; refresh_token: string }) => {
      setTokens(tokens.access_token, tokens.refresh_token);
      localStorage.setItem('catchap_login_ts', String(Date.now()));
      const me = await reloadMe();
      clearSocialIntent();
      navigate(me ? ROLE_HOME[me.role] : PATHS.STUDENT_HOME, { replace: true });
    },
    [navigate, reloadMe],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const code = params.get('code');
    const state = params.get('state');
    const denied = params.get('error');
    const target = resolveCallbackProvider(state);
    setProvider(target);

    if (denied) {
      // 사용자가 동의 화면에서 취소한 경우가 대부분 — 오류처럼 겁주지 않는다.
      clearSocialIntent();
      setError(
        denied === 'access_denied'
          ? '간편 로그인을 취소했어요. 다시 시도하거나 아이디로 로그인해 주세요.'
          : '간편 로그인이 완료되지 않았어요. 다시 시도해 주세요.',
      );
      setPhase('error');
      return;
    }
    if (!code || !state || !target) {
      clearSocialIntent();
      setError('로그인 정보가 올바르지 않아요. 처음부터 다시 시도해 주세요.');
      setPhase('error');
      return;
    }

    const intent = readSocialIntent();
    if (intent === 'connect') {
      // 출발한 화면으로 되돌린다 — 학생 마이페이지와 콘솔 프로필이 이 화면을 공유한다.
      const back = readSocialReturn() ?? `${PATHS.STUDENT_MYPAGE}?tab=account`;
      setReturnTo(back);
      socialApi
        .connect(target, code, state)
        .then(() => {
          clearSocialIntent();
          navigate(`${back}${back.includes('?') ? '&' : '?'}linked=${target}`, { replace: true });
        })
        .catch((err) => {
          clearSocialIntent();
          setError(errorMessage(err, '계정을 연결하지 못했어요.'));
          setPhase('error');
        });
      return;
    }

    socialApi
      .callback(target, code, state)
      .then(async (res) => {
        if (res.status === 'logged_in' && res.tokens) {
          await finishLogin(res.tokens);
          return;
        }
        setSignup(res);
        setNickname(res.profile?.nickname ?? '');
        setBirthDate(res.profile?.birth_date ?? '');
        setPhase('signup');
      })
      .catch((err) => {
        clearSocialIntent();
        setError(errorMessage(err, '간편 로그인에 실패했어요. 다시 시도해 주세요.'));
        setPhase('error');
      });
  }, [params, navigate, finishLogin]);

  const submitSignup = async () => {
    if (!signup?.signup_token) return;
    const needsBirth = signup.profile?.needs_birth_date ?? true;
    if (!agreed) {
      setError('이용약관과 개인정보 처리방침에 동의해 주세요.');
      return;
    }
    if (needsBirth && !birthDate) {
      setError('생년월일을 입력해 주세요.');
      return;
    }
    const age = needsBirth ? ageOn(birthDate) : null;
    if (age !== null && age < 14) {
      // 서버도 400으로 막지만, 왕복 전에 이유를 먼저 알려 준다.
      setError(
        '만 14세 미만은 보호자(법정대리인) 동의가 필요해요. 이메일 가입으로 진행해 주세요.',
      );
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await socialApi.signup(
        signup.signup_token,
        needsBirth ? birthDate : undefined,
        nickname.trim() || undefined,
      );
      if (res.tokens) await finishLogin(res.tokens);
      else throw new Error('no tokens');
    } catch (err) {
      setError(errorMessage(err, '가입을 마치지 못했어요. 다시 시도해 주세요.'));
      setSubmitting(false);
    }
  };

  const label = provider ? LABELS[provider] : '간편';

  return (
    <div className="sc-root">
      <div className="sc-card">
        {phase === 'working' && (
          <div className="sc-center">
            <i className="ph-bold ph-circle-notch sc-spin" />
            <h1 className="sc-title">{label} 계정을 확인하고 있어요</h1>
            <p className="sc-sub">잠시만 기다려 주세요.</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="sc-center">
            <span className="sc-badge sc-badge--bad">
              <i className="ph-fill ph-warning-circle" />
            </span>
            <h1 className="sc-title">
              {returnTo ? '계정을 연결하지 못했어요' : '로그인을 마치지 못했어요'}
            </h1>
            <p className="sc-sub">{error}</p>
            <Link to={returnTo ?? PATHS.LOGIN} className="sc-primary" replace>
              <i className="ph-bold ph-arrow-left" />{' '}
              {returnTo ? '돌아가기' : '로그인으로 돌아가기'}
            </Link>
          </div>
        )}

        {phase === 'signup' && signup && (
          <>
            <span className="sc-badge">
              <i className="ph-fill ph-user-plus" />
            </span>
            <h1 className="sc-title">{label} 계정으로 시작하기</h1>
            <p className="sc-sub">
              캣챱스터디를 처음 이용하시네요. 아래만 확인하면 바로 시작할 수 있어요.
            </p>

            {signup.profile?.email && (
              <div className="sc-readonly">
                <span className="sc-readonly-label">이메일</span>
                <span className="sc-readonly-value">{signup.profile.email}</span>
              </div>
            )}

            <label className="sc-label" htmlFor="sc-nickname">
              별명
            </label>
            <input
              id="sc-nickname"
              className="sc-input"
              type="text"
              maxLength={50}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="학습 화면에 표시될 이름"
            />

            {signup.profile?.needs_birth_date ? (
              <>
                <label className="sc-label" htmlFor="sc-birth">
                  생년월일
                </label>
                <p className="sc-helper">
                  만 14세 미만은 보호자(법정대리인) 동의가 필요해서 확인해요.
                </p>
                <input
                  id="sc-birth"
                  className="sc-input"
                  type="date"
                  value={birthDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setBirthDate(e.target.value)}
                />
              </>
            ) : (
              <div className="sc-readonly">
                <span className="sc-readonly-label">생년월일</span>
                <span className="sc-readonly-value">
                  {signup.profile?.birth_date}
                  <em className="sc-from">{label}에서 받아왔어요</em>
                </span>
              </div>
            )}

            <label className="sc-terms">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <span>
                <Link to={PATHS.TERMS} target="_blank" rel="noreferrer">
                  서비스 이용약관
                </Link>
                과{' '}
                <Link to={PATHS.PRIVACY} target="_blank" rel="noreferrer">
                  개인정보 처리방침
                </Link>
                에 동의합니다. (필수)
              </span>
            </label>

            {error && (
              <div className="sc-error">
                <i className="ph-fill ph-warning-circle" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              className="sc-primary sc-primary--block"
              onClick={submitSignup}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <i className="ph-bold ph-circle-notch sc-spin sc-spin--sm" /> 가입하는 중…
                </>
              ) : (
                <>
                  <i className="ph-bold ph-check" /> 동의하고 시작하기
                </>
              )}
            </button>
            <Link to={PATHS.LOGIN} className="sc-cancel" replace>
              취소하고 로그인으로
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
