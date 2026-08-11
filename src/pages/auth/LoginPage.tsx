import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/auth';
import wordmarkWhite from '../../assets/brand/catchap-wordmark-white.png';
import ForestCaptcha from '../../components/captcha/ForestCaptcha';
import { useAuth } from '../../hooks/useAuth';
import { PATHS } from '../../routes/paths';
import { ROLE_HOME } from '../../routes/roleRoutes';
import './LoginPage.css';
import PasswordInput from '../../components/common/PasswordInput';
import SocialLoginButtons from '../../components/auth/SocialLoginButtons';

// 제품 전환: 기관/교사(0717)·학부모(0718) 로그인 탭·가입 흐름은 전부 제거됐다 —
// 남은 것은 학생(학습자) 단일 흐름. 종전 코드는 git 이력 참고.

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

// 검증 실패 표시는 디자인 토큰으로 — 하드코딩 hex(라이트 전용)는 다크모드에서 입력칸을
// 흰 박스로 튀게 한다. 정상(리셋)은 빈 문자열로 되돌려 .lg-input의 CSS 토큰이 다시 적용되게 한다.
function markField(el: HTMLElement, bad: boolean) {
  el.style.borderColor = bad ? 'var(--danger)' : '';
  el.style.background = bad ? 'var(--danger-soft)' : '';
}

function markCheck(el: HTMLElement, bad: boolean) {
  el.style.outline = bad ? '2px solid var(--danger)' : '';
  el.style.outlineOffset = bad ? '3px' : '';
  el.style.borderRadius = '4px';
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { publicLogin, me: authMe, loading: authLoading } = useAuth();

  // 이미 로그인한 사용자가 /login에 오면(주소창 직접 입력 등) 자기 역할 홈으로 보냄.
  // replace: 뒤로가기로 로그인 폼에 다시 안 걸리게.
  useEffect(() => {
    if (!authLoading && authMe) {
      navigate(ROLE_HOME[authMe.role], { replace: true });
    }
  }, [authLoading, authMe, navigate]);

  const [view, setView] = useState<'login' | 'signup'>('login');
  const [captcha, setCaptcha] = useState(false);
  const [signupDone, setSignupDone] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [codeSecondsLeft, setCodeSecondsLeft] = useState(0); // 이메일 인증코드 유효시간(5분) 카운트다운
  const [verified, setVerified] = useState(false);
  const [email, setEmail] = useState('');
  // 연령 분기(2026-07-17): 학생 가입은 생년월일 필수 — 만 14세 미만이면 보호자 동의 섹션 노출
  const [birthDate, setBirthDate] = useState(''); // YYYY-MM-DD
  const [guardianEmail, setGuardianEmail] = useState('');
  const [guardianCodeSent, setGuardianCodeSent] = useState(false);
  const [guardianVerified, setGuardianVerified] = useState(false);
  const [guardianSecondsLeft, setGuardianSecondsLeft] = useState(0);
  const [formError, setFormError] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginBad, setLoginBad] = useState(false);
  // 로그인 유지 — 켜면 localStorage(브라우저 닫아도 유지), 끄면 sessionStorage(탭 닫으면 로그아웃).
  // 기본은 끔: 공용 PC에서 켜져 있으면 다음 사용자에게 세션이 넘어갈 수 있어서다.
  const [remember, setRemember] = useState(false);
  // 아이디+비밀번호가 여러 기관에서 일치할 때(409)만 후보 기관 버튼 노출
  const [orgCandidates, setOrgCandidates] = useState<
    { organization_id: string; organization_name: string }[] | null
  >(null);
  // 5회 이상 로그인 실패(서버 집계) 시 캡차 요구
  const [captchaNeeded, setCaptchaNeeded] = useState(false);

  const formRef = useRef<HTMLDivElement | null>(null);
  const loginIdRef = useRef<HTMLInputElement | null>(null);
  const loginPwRef = useRef<HTMLInputElement | null>(null);
  // 마지막 시도의 기관 선택 — 캡차 통과 후 재시도(onCaptchaToken)가 기관을 잃지 않게 기억.
  // (잃으면 다기관 학생은 후보 선택→캡차→후보 선택… 무한 루프가 된다)
  const lastOrgRef = useRef<string | undefined>(undefined);
  const capT = useRef<number | null>(null);
  // CatChap Guard 로 전환했을 때만 채워진다. 토큰만으로는 백엔드 검증이 실패한다
  // (session_id·purpose 를 발급 때 값과 대조하므로) — 재시도까지 살아 있어야 해서 ref 다.
  const capMeta = useRef<{ sessionId: string; purpose: string } | null>(null);
  const boundRoots = useRef(new WeakSet<HTMLElement>());

  useEffect(
    () => () => {
      if (capT.current) window.clearTimeout(capT.current);
    },
    [],
  );

  // 이메일 인증코드 5분 카운트다운 — 코드 발송 후 매초 감소, 인증 완료/미발송 시 정지.
  useEffect(() => {
    if (!codeSent || verified || codeSecondsLeft <= 0) return;
    const t = window.setInterval(() => {
      setCodeSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [codeSent, verified, codeSecondsLeft > 0]);

  // 보호자 동의 코드 카운트다운 — 본인 이메일 코드와 동일 5분 규칙
  useEffect(() => {
    if (!guardianCodeSent || guardianSecondsLeft <= 0) return;
    const t = window.setInterval(() => {
      setGuardianSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [guardianCodeSent, guardianSecondsLeft > 0]);

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // 만 나이 — 생일이 안 지났으면 1 뺀다. 서버(register_student)와 동일 규칙.
  const ageFrom = (iso: string): number | null => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const b = new Date(iso + 'T00:00:00');
    if (Number.isNaN(b.getTime())) return null;
    const now = new Date();
    let a = now.getFullYear() - b.getFullYear();
    if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) a -= 1;
    return a;
  };
  const signupAge = birthDate ? ageFrom(birthDate) : null;
  // 만 14세 미만 = 보호자(법정대리인) 동의 필요. 서버가 최종 강제 — 여기는 안내·입력 UI.
  const needsGuardian = signupAge !== null && signupAge >= 0 && signupAge < 14;

  // ===== 라벨/문구 — 학습자 단일 흐름 =====
  // 학생 이메일 가입 전환(2026-07-16): 새 계정은 이메일이 아이디 — 기존 아이디도 계속 유효
  const idLabel = '아이디';
  const idPlaceholder = '이메일 또는 아이디를 입력해 주세요';
  const notice =
    '강사·기관 담당자 계정도 여기서 로그인하면 각자 콘솔로 이동합니다. 만 14세 미만은 가입 시 보호자 동의가 필요합니다.';

  const nameLabel = '이름';
  const namePlaceholder = '이름을 입력해 주세요';
  const signupNotice = '만 14세 미만은 보호자 동의가 필요해요. 가입 후 바로 로그인해 이용할 수 있어요.';

  const signupTitle = '회원가입';
  const signupSubtitle = '정보를 입력하면 바로 시작할 수 있어요';

  const emailInvalid = email.length > 0 && !isEmail(email);

  // ===== 폼 검증 (원본 markField/markCheck/attachClear 로직) =====
  const attachClear = () => {
    const root = formRef.current;
    if (!root || boundRoots.current.has(root)) return;
    boundRoots.current.add(root);
    root.addEventListener('input', (e) => {
      const t = e.target as HTMLElement;
      if (t.matches('[data-req]')) markField(t, false);
    });
    root.addEventListener('change', (e) => {
      const t = e.target as HTMLInputElement;
      if (t.matches('[data-req-check]') && t.checked) markCheck(t, false);
    });
  };

  const fieldVal = (sel: string) => {
    const el = formRef.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>(sel);
    return el ? el.value.trim() : '';
  };

  const submitPersonalRegistration = () => {
    const name = fieldVal('[data-req="이름"]');
    const pw = fieldVal('[data-req="비밀번호"]');
    const emailCode = fieldVal('[data-req="인증코드"]');
    // 학생 이메일 가입 전환(2026-07-16): 이메일(소문자)이 로그인 아이디.
    // 연령 분기(2026-07-17): 생년월일 필수, 만 14세 미만은 보호자 이메일 코드 동봉.
    authApi
      .registerStudent({
        name,
        email,
        email_code: emailCode,
        password: pw,
        birth_date: birthDate,
        ...(needsGuardian
          ? {
              guardian_email: guardianEmail,
              guardian_email_code: fieldVal('[data-req="보호자 인증코드"]'),
            }
          : {}),
      })
      .then(() => {
        setSignupDone(true);
      })
      .catch((err) => {
        // 서버가 원인을 알려주면(중복 이메일 409 등) 그대로 노출 — 뭉개면 사용자가 원인을 모른다
        const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data
          ?.detail;
        setFormError(
          typeof detail === 'string' && detail
            ? detail
            : '가입에 실패했어요. 입력 정보를 확인한 뒤 다시 시도해 주세요.',
        );
      });
  };

  const validateAndSubmit = () => {
    const root = formRef.current;
    if (!root) return;
    attachClear();
    const visible = (el: HTMLElement) => el.offsetParent !== null;
    const fields = [...root.querySelectorAll<HTMLInputElement>('[data-req]')].filter(visible);
    const checks = [...root.querySelectorAll<HTMLInputElement>('[data-req-check]')].filter(visible);
    let firstBad: HTMLElement | null = null;
    let missing = 0;
    fields.forEach((el) => {
      let bad = !el.value || !el.value.trim();
      if (!bad && el.type === 'email' && !isEmail(el.value.trim())) bad = true;
      markField(el, bad);
      if (bad) {
        missing++;
        if (!firstBad) firstBad = el;
      }
    });
    checks.forEach((el) => {
      const bad = !el.checked;
      markCheck(el, bad);
      if (bad) {
        missing++;
        if (!firstBad) firstBad = el;
      }
    });
    if (missing > 0) {
      setFormError('입력하지 않은 필수 항목이 있어요. 표시된 곳을 다시 확인해 주세요.');
      (firstBad as HTMLElement | null)?.focus();
      return;
    }
    // 비밀번호 길이·일치 검증 — 서버 422 전에 어떤 칸이 왜 틀렸는지 명확히 안내
    // (학생 이메일 가입 전환(2026-07-16): 학생도 학부모와 동일 8자 기준으로 통일)
    const min = 8;
    const pwEl = root.querySelector<HTMLInputElement>('[data-req="비밀번호"]');
    const pw2El = root.querySelector<HTMLInputElement>('[data-req="비밀번호 확인"]');
    const pwv = pwEl?.value ?? '';
    if (pwEl && pwv.length < min) {
      markField(pwEl, true);
      setFormError(`비밀번호는 ${min}자 이상이어야 해요.`);
      pwEl.focus();
      return;
    }
    if (pw2El && pwv !== (pw2El.value ?? '')) {
      markField(pw2El, true);
      setFormError('비밀번호가 서로 달라요. 다시 확인해 주세요.');
      pw2El.focus();
      return;
    }
    setFormError('');
    submitPersonalRegistration();
  };

  // ===== 이메일 인증 / 코드 확인 (authApi 연결, UI 흐름은 원본 그대로) =====
  const sendCode = () => {
    // 학생 가입의 중복(이메일=아이디)은 가입 확정 시 409로 안내 — 발송 단계 검사는 생략
    authApi
      .sendEmailCode(email, 'signup', false)
      .then(() => {
        setCodeSent(true);
        setVerified(false);
        setCodeSecondsLeft(300); // 5분 카운트다운 시작(재전송 시 초기화)
      })
      .catch((err) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        setFormError(
          status === 409
            ? '이미 가입된 이메일이에요. 로그인하거나 다른 이메일을 사용해 주세요.'
            : '인증코드 발송에 실패했어요. 이메일을 확인해 주세요.',
        );
      });
  };

  // 보호자(법정대리인) 동의 코드 발송 — 기존 계정 이메일도 허용(purpose=guardian).
  const sendGuardianCode = () => {
    if (!isEmail(guardianEmail)) {
      setFormError('보호자 이메일을 올바른 형식으로 입력해 주세요.');
      return;
    }
    if (guardianEmail.trim().toLowerCase() === email.trim().toLowerCase()) {
      setFormError('보호자 이메일은 본인 이메일과 달라야 해요.');
      return;
    }
    authApi
      .sendEmailCode(guardianEmail, 'guardian')
      .then(() => {
        setGuardianCodeSent(true);
        setGuardianVerified(false); // 재전송하면 이전 '인증됨' 표시는 무효
        setGuardianSecondsLeft(300);
        setFormError('');
      })
      .catch(() => setFormError('보호자 인증코드 발송에 실패했어요. 이메일을 확인해 주세요.'));
  };

  // 보호자 코드 확인 — 본인 이메일과 동일한 '확인 → 인증됨' 흐름.
  // verify는 코드를 소비하지 않으므로(used_at 유지) 가입 확정 시 서버가 다시 1회 소비한다.
  const verifyGuardianCode = () => {
    if (guardianVerified) return;
    const code = fieldVal('[data-req="보호자 인증코드"]');
    authApi
      .verifyEmailCode(guardianEmail, code, 'guardian')
      .then((r) => {
        if (r.verified) {
          setGuardianVerified(true);
          setFormError('');
        } else setFormError('보호자 인증코드가 올바르지 않아요. 다시 확인해 주세요.');
      })
      .catch(() => setFormError('보호자 인증코드가 올바르지 않아요. 다시 확인해 주세요.'));
  };

  const verifyCode = () => {
    if (verified) return;
    const code = fieldVal('[data-req="인증코드"]');
    authApi
      .verifyEmailCode(email, code)
      .then((r) => {
        if (r.verified) setVerified(true);
        else setFormError('인증코드가 올바르지 않아요. 다시 확인해 주세요.');
      })
      .catch(() => setFormError('인증코드가 올바르지 않아요. 다시 확인해 주세요.'));
  };

  // ===== 캡차 팝업 — 5회+ 실패 시 메인 캡차(forest)를 먼저 통과해야 로그인 재시도 =====
  const openCaptcha = () => {
    setCaptcha(true);
  };

  // 평소엔 캡차 없이 바로 로그인 — 서버가 5회 이상 실패를 알리면(captcha_required)
  // 이후 시도마다 캡차 팝업을 먼저 통과해야 한다. 성공 시 해제.
  const submitLogin = () => {
    if (captchaNeeded) openCaptcha();
    else void doLogin();
  };

  // 아이디/비밀번호 칸에서 Enter → 바로 로그인 (form 없이도 동작)
  const onLoginKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitLogin();
    }
  };

  // ===== 학생 로그인 기관 기억 (한 번 선택하면 다음부터 자동) =====
  const ORG_MEMORY_KEY = 'catchap_student_org';
  const rememberedOrg = (id: string): string | undefined => {
    try {
      return JSON.parse(localStorage.getItem(ORG_MEMORY_KEY) ?? '{}')[id] ?? undefined;
    } catch {
      return undefined;
    }
  };
  const rememberOrg = (id: string, orgId: string) => {
    try {
      const m = JSON.parse(localStorage.getItem(ORG_MEMORY_KEY) ?? '{}');
      m[id] = orgId;
      localStorage.setItem(ORG_MEMORY_KEY, JSON.stringify(m));
    } catch {
      /* 저장 실패해도 로그인엔 지장 없음 */
    }
  };
  const forgetOrg = (id: string) => {
    try {
      const m = JSON.parse(localStorage.getItem(ORG_MEMORY_KEY) ?? '{}');
      delete m[id];
      localStorage.setItem(ORG_MEMORY_KEY, JSON.stringify(m));
    } catch {
      /* ignore */
    }
  };

  const doLogin = async (orgOverride?: string, captchaToken?: string) => {
    const id = loginIdRef.current?.value.trim() ?? '';
    const pw = loginPwRef.current?.value ?? '';
    setLoginError('');
    setLoginBad(false);
    if (!id || !pw) {
      setLoginBad(true);
      setLoginError('아이디와 비밀번호를 입력해 주세요.');
      return;
    }
    try {
      // 후보 버튼으로 고른 기관 > 기억해 둔 기관 > 미지정(백엔드가 비밀번호로 판별)
      const orgId = orgOverride ?? rememberedOrg(id);
      lastOrgRef.current = orgId; // 캡차 재시도가 같은 기관으로 가게 기억
      try {
        const me = await publicLogin(
          {
            organization_id: orgId,
            student_login_id: id,
            password: pw,
            captcha_token: captchaToken,
            ...(captchaToken && capMeta.current
              ? { captcha_session_id: capMeta.current.sessionId,
                  captcha_purpose: capMeta.current.purpose }
              : {}),
          },
          remember,
        );
        if (orgId) rememberOrg(id, orgId);
        setCaptchaNeeded(false);
        navigate(ROLE_HOME[me.role]);
        return;
      } catch (err) {
        const resp = (err as { response?: { status?: number } })?.response;
        // 기억해 둔 기관이 더 이상 맞지 않으면(전학 등) 잊고 전체에서 한 번 더
        if (resp?.status === 401 && orgId && !orgOverride) {
          forgetOrg(id);
          const me = await publicLogin(
            {
              student_login_id: id,
              password: pw,
              captcha_token: captchaToken,
              ...(captchaToken && capMeta.current
                ? { captcha_session_id: capMeta.current.sessionId,
                    captcha_purpose: capMeta.current.purpose }
                : {}),
            },
            remember,
          );
          setCaptchaNeeded(false);
          navigate(ROLE_HOME[me.role]);
          return;
        }
        throw err;
      }
    } catch (err) {
      const resp = (err as {
        response?: {
          status?: number;
          data?: {
            detail?:
              | string
              | {
                  message?: string;
                  captcha_required?: boolean;
                  candidates?: { organization_id: string; organization_name: string }[];
                };
          };
        };
      })?.response;
      const detail = resp?.data?.detail;
      const detailObj = typeof detail === 'object' && detail !== null ? detail : undefined;

      // 아이디+비밀번호가 여러 기관에서 일치(409) → 후보 기관 원클릭 선택
      if (resp?.status === 409 && Array.isArray(detailObj?.candidates)) {
        setOrgCandidates(detailObj.candidates);
        setLoginError(detailObj.message ?? '소속 기관을 눌러 주세요.');
        return;
      }

      // 통합 로그인(0720) — 학생·강사 판별은 서버(/auth/public-login)가 한다. 강사는 숨겨진
      // /ops/login을 몰라도 여기서 로그인된다. 운영자(ops)는 서버가 이 경로에서 제외하므로
      // 전용 /ops/login으로만 로그인한다(고권한 내부 계정을 공개 로그인에 노출 안 함).
      // 실패하면 아래 공통 오류 처리로 이어진다.

      // 서버가 5회 이상 실패를 알리면 캡차 요구. 단, 방금 캡차를 통과한 시도(captchaToken
      // 있음)가 '비밀번호 오류'로 실패한 경우엔 팝업을 즉시 다시 열지 않는다 — 재오픈하면
      // "캡차 정답을 맞혀도 계속 뜨는" 루프로 보인다(사용자 제보 0714). 오류 문구를 보여주고,
      // 다음 로그인 클릭 때 캡차가 열린다(submitLogin). 게이트 자체 거부(토큰 없음·만료 —
      // 서버 문구 '보안 확인')일 때만 즉시 연다(안내만 뜨고 캡차가 안 보이는 갇힘 방지).
      const gateRefused = (detailObj?.message ?? '').includes('보안 확인');
      if (detailObj?.captcha_required) {
        setCaptchaNeeded(true);
        if (!captchaToken || gateRefused) openCaptcha();
      }

      setLoginBad(true);
      // 403류(계정 종류 불일치·승인 대기·비활성화)는 서버 문구를 그대로 —
      // "비밀번호가 올바르지 않아요"로 뭉개면 사용자가 원인을 알 수 없다.
      const serverMsg =
        resp?.status === 403 && typeof detail === 'string' && detail ? detail : null;
      setLoginError(
        serverMsg ??
          (detailObj?.captcha_required && (!captchaToken || gateRefused)
            ? '로그인에 여러 번 실패해서 보안 확인이 필요해요. 다시 시도해 주세요.'
            : '아이디 또는 비밀번호가 올바르지 않아요. 다시 확인해 주세요.'),
      );
    }
  };

  const pickOrgCandidate = (orgId: string) => {
    setOrgCandidates(null);
    setLoginError('');
    void doLogin(orgId);
  };

  // 메인 캡차(forest) 통과 → 단일사용 토큰을 로그인에 실어 재시도.
  // 기관 선택(lastOrgRef)을 유지해야 다기관 학생이 후보선택↔캡차 사이에서 맴돌지 않는다.
  const onCaptchaToken = (token: string, meta?: { sessionId: string; purpose: string }) => {
    setCaptcha(false);
    capMeta.current = meta ? { sessionId: meta.sessionId, purpose: meta.purpose } : null;
    void doLogin(lastOrgRef.current, token);
  };

  const goSignup = () => {
    // 학생 이메일 가입 전환(2026-07-16): 학생도 이메일 가입 폼 사용(종전 코드 활성화 리다이렉트 제거)
    setView('signup');
    setCodeSent(false);
    setCodeSecondsLeft(0);
    setVerified(false);
  };
  const goLogin = () => setView('login');

  const loginInputCls = (base: string) => base + (loginBad ? ' lg-input--bad' : '');
  // 역할 탭 제거(기관·교사 0717 / 학부모 0718 은퇴) — 학습자 단일 흐름이라 탭 UI가 없다.
  // 은퇴 역할의 기존 계정이 로그인하면 종료 안내(SCHOOL_SUNSET)로 간다(ROLE_HOME).

  // 로그인 상태면 폼 렌더 없이 위 효과가 홈으로 이동 (폼 깜빡임 방지)
  if (authMe) return null;

  return (
    <div className="lg-root">
      {/* 테마 토글은 App의 GlobalThemeToggle(로그인 전 전역 고정)이 담당 — 중복 제거 */}
      {/* LEFT BRAND PANEL */}
      <div className="lg-left">
        <div className="lg-left-pin">
          <Link to={PATHS.HOME} className="lg-brand" title="메인으로">
            <img src={wordmarkWhite} alt="CATCHAP" className="lg-brand-wordmark" />
          </Link>
          <div className="lg-hero">
            <h1 className="lg-hero-title">
              끝까지 본 학습을
              <br />
              증명합니다
            </h1>
            <p className="lg-hero-sub">
              시청 검증형 온라인 강의 — 정말 보고 이해했는지 확인합니다. 검증된 기술로 학습자의
              배움과 정보를 안전하게 지킵니다.
            </p>
          </div>
          <div className="lg-badges">
            <span>데이터 보호</span>
            <span className="lg-badge-dot" />
            <span>시청 검증</span>
            <span className="lg-badge-dot" />
            <span>행동 데이터 분석</span>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="lg-right">
        {/* ===== LOGIN VIEW ===== */}
        {view === 'login' && (
          <div className="lg-login">
            <h2 className="lg-h2">로그인</h2>
            <p className="lg-login-sub">아이디와 비밀번호를 입력해 주세요</p>

            {/* 아이디+비밀번호가 여러 기관에서 일치할 때(409)만 후보 기관 원클릭 선택 */}
            {orgCandidates && (
              <>
                <label className="lg-label">소속 기관을 눌러 주세요</label>
                <div className="lg-orgpick lg-mb16">
                  {orgCandidates.map((c) => (
                    <button
                      key={c.organization_id}
                      type="button"
                      className="lg-orgpick-btn"
                      onClick={() => pickOrgCandidate(c.organization_id)}
                    >
                      <i className="ph-fill ph-buildings" />
                      {c.organization_name}
                    </button>
                  ))}
                </div>
              </>
            )}

            <label className="lg-label">{idLabel}</label>
            <div className="lg-field lg-mb16">
              <i className="ph ph-user-circle lg-field-icon" />
              <input
                type="text"
                ref={loginIdRef}
                placeholder={idPlaceholder}
                onInput={() => setLoginBad(false)}
                onKeyDown={onLoginKeyDown}
                className={loginInputCls('lg-input')}
              />
            </div>

            <label className="lg-label">비밀번호</label>
            <div className="lg-field lg-mb12">
              <i className="ph ph-lock-key lg-field-icon" />
              <PasswordInput
                ref={loginPwRef}
                placeholder="비밀번호를 입력해 주세요"
                onInput={() => setLoginBad(false)}
                onKeyDown={onLoginKeyDown}
                className={loginInputCls('lg-input')}
              />
            </div>

            <div className="lg-rememberrow">
              <label className="lg-remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                로그인 유지
              </label>
              <span className="lg-findrow">
                {/* 아이디 찾기 제거(2026-08-10) — 새 계정은 '이메일=아이디'라 이메일을 아는
                    사람에겐 무의미. 비밀번호 찾기만 남긴다. */}
                <Link to={PATHS.PASSWORD_RESET} className="lg-forgot">
                  비밀번호를 잊으셨나요?
                </Link>
              </span>
            </div>

            {loginError && (
              <div className="lg-formerr">
                <i className="ph-fill ph-warning-circle" />
                <span>{loginError}</span>
              </div>
            )}

            <button type="button" onClick={submitLogin} className="lg-primary">
              <i className="ph-bold ph-sign-in" />
              로그인
            </button>

            <div className="lg-divider">
              <div className="lg-divider-line" />
              <span>또는</span>
              <div className="lg-divider-line" />
            </div>

            {/* 간편 로그인 — 서버에 키가 설정된 provider만 그려진다(하나도 없으면 통째로 숨김) */}
            <SocialLoginButtons mode="login" />

            <button type="button" onClick={goSignup} className="lg-secondary">
              <i className="ph ph-user-plus" />
              회원가입
            </button>

            {/* 통합 로그인 안내 — 강사·기관 담당자도 이 폼에서 로그인(입력 계정으로 자동 판별·역할별 콘솔로 이동) */}
            <div className="lg-notice">
              <i className="ph ph-info" />
              <p>{notice}</p>
            </div>
          </div>
        )}

        {/* ===== SIGNUP VIEW (학생/학부모 — 학교 가입 흐름은 제품 전환으로 제거) ===== */}
        {view === 'signup' && (
          <div ref={formRef} className="lg-signup">
            <button type="button" onClick={goLogin} className="lg-back">
              <i className="ph-bold ph-arrow-left" />
              로그인으로 돌아가기
            </button>
            <h2 className="lg-h2 lg-h2--signup">{signupTitle}</h2>
            <p className="lg-signup-sub">{signupSubtitle}</p>

            {/* 간편 가입 — provider가 이메일 인증을 대신해 준다. 만 14세 미만은 여기서
                가입되지 않고(보호자 동의 절차가 소셜에 없다) 아래 이메일 가입으로 와야 한다. */}
            <SocialLoginButtons mode="signup" />
            <div className="lg-divider">
              <div className="lg-divider-line" />
              <span>이메일로 가입</span>
              <div className="lg-divider-line" />
            </div>

            {/* ============ 학습자 가입 (단일 흐름) ============ */}
            {(
              <>
                <label className="lg-label">{nameLabel}</label>
                <div className="lg-field lg-mb15">
                  <i className="ph-fill ph-identification-card lg-field-icon" />
                  <input type="text" data-req="이름" placeholder={namePlaceholder} className="lg-input" />
                </div>

                {/* 연령 분기(2026-07-17): 생년월일 필수 — 만 14세 미만이면
                    보호자(법정대리인) 이메일 동의 섹션이 아래에 열린다. 서버가 최종 강제. */}
                {(
                  <>
                    <label className="lg-label">생년월일</label>
                    <div className="lg-field lg-mb12">
                      <i className="ph-fill ph-cake lg-field-icon" />
                      <input
                        type="date"
                        data-req="생년월일"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        max={new Date().toISOString().slice(0, 10)}
                        className="lg-input"
                      />
                    </div>
                    {/* 본인 이메일 인증 블록과 같은 구조·문구 리듬으로 통일(사용자 요청).
                        종전엔 노란 강조 박스(.lg-guardian) 안에 따로 있어 폼에서 튀었다. */}
                    {needsGuardian && (
                      <>
                        <label className="lg-label">보호자 이메일</label>
                        <p className="lg-helper" style={{ margin: '-2px 0 8px' }}>
                          만 {signupAge}세는 보호자(법정대리인) 동의가 필요해요. 보호자 이메일로 인증코드를 보내 드려요.
                        </p>
                        <div className="lg-inline lg-mb12">
                          <div className="lg-field-grow">
                            <i className="ph-fill ph-envelope-simple lg-field-icon" />
                            <input
                              type="email"
                              data-req="보호자 이메일"
                              placeholder="보호자 이메일 주소"
                              value={guardianEmail}
                              onChange={(e) => setGuardianEmail(e.target.value)}
                              className="lg-input"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={sendGuardianCode}
                            className={'lg-sendbtn' + (guardianCodeSent ? ' lg-sendbtn--sent' : '')}
                          >
                            {guardianCodeSent ? '재전송' : '인증코드 받기'}
                          </button>
                        </div>
                        {guardianCodeSent && (
                          <>
                            <label className="lg-label">보호자 인증코드</label>
                            <div className="lg-inline lg-mb9">
                              <div className="lg-field-grow">
                                <i className="ph-fill ph-shield-check lg-field-icon" />
                                <input
                                  type="text"
                                  maxLength={6}
                                  data-req="보호자 인증코드"
                                  placeholder="6자리 코드"
                                  className="lg-input lg-input--otp"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={verifyGuardianCode}
                                className={'lg-codebtn' + (guardianVerified ? ' lg-codebtn--valid' : '')}
                              >
                                {guardianVerified ? '인증됨' : '확인'}
                              </button>
                            </div>
                            {guardianVerified && (
                              <div className="lg-verified">
                                <i className="ph-fill ph-check-circle" />
                                <span>보호자 동의가 확인되었어요</span>
                              </div>
                            )}
                            {!guardianVerified && (
                              <div className="lg-notverified">
                                <i className="ph-fill ph-timer" />
                                {guardianSecondsLeft > 0 ? (
                                  <span>
                                    인증코드를 보냈어요. 남은 시간 <b>{mmss(guardianSecondsLeft)}</b> · 시간이 지나면 재전송해 주세요.
                                  </span>
                                ) : (
                                  <span>인증코드가 만료됐어요. <b>재전송</b>을 눌러 새 코드를 받아 주세요.</span>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </>
                )}

                {/* 학생 이메일 가입 전환(2026-07-16): 학생도 이메일이 로그인 아이디 */}
                <label className="lg-label">이메일 (로그인 아이디)</label>
                <p className="lg-helper" style={{ margin: '-2px 0 8px' }}>
                  이 이메일이 로그인 아이디가 돼요.
                </p>
                <div className="lg-inline lg-mb12">
                  <div className="lg-field-grow">
                    <i className="ph-fill ph-envelope-simple lg-field-icon" />
                    <input
                      type="email"
                      data-req="이메일"
                      placeholder="example@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={'lg-input' + (emailInvalid ? ' lg-input--soft-invalid' : '')}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={sendCode}
                    className={'lg-sendbtn' + (codeSent ? ' lg-sendbtn--sent' : '')}
                  >
                    {codeSent ? '재전송' : '인증코드 받기'}
                  </button>
                </div>

                {emailInvalid && (
                  <div className="lg-emailerr">
                    <i className="ph-fill ph-warning-circle" />
                    <span>올바르지 않은 이메일 형식이에요. example@email.com 형식으로 입력해 주세요.</span>
                  </div>
                )}

                {codeSent && (
                  <>
                    <label className="lg-label">인증코드</label>
                    <div className="lg-inline lg-mb9">
                      <div className="lg-field-grow">
                        <i className="ph-fill ph-shield-check lg-field-icon" />
                        <input
                          type="text"
                          maxLength={6}
                          data-req="인증코드"
                          placeholder="6자리 코드"
                          className="lg-input lg-input--otp"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={verifyCode}
                        className={'lg-codebtn' + (verified ? ' lg-codebtn--valid' : '')}
                      >
                        {verified ? '인증됨' : '확인'}
                      </button>
                    </div>
                    {verified && (
                      <div className="lg-verified">
                        <i className="ph-fill ph-check-circle" />
                        <span>이메일 인증이 완료되었어요</span>
                      </div>
                    )}
                    {!verified && (
                      <div className="lg-notverified">
                        <i className="ph-fill ph-timer" />
                        {codeSecondsLeft > 0 ? (
                          <span>
                            인증코드를 보냈어요. 남은 시간 <b>{mmss(codeSecondsLeft)}</b> · 시간이 지나면 재전송해 주세요.
                          </span>
                        ) : (
                          <span>인증코드가 만료됐어요. <b>재전송</b>을 눌러 새 코드를 받아 주세요.</span>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* 학생 이메일 가입 전환(2026-07-16): 별도 아이디 칸 제거 — 이메일이 로그인 아이디.
                    (종전: 학생 전역 유일 아이디 + 중복 확인. 부활 시 git 이력 참고) */}

                <label className="lg-label">비밀번호</label>
                <div className="lg-field lg-mb12">
                  <i className="ph-fill ph-lock-key lg-field-icon" />
                  <PasswordInput
                    data-req="비밀번호"
                    placeholder="8자 이상 입력해 주세요"
                    className="lg-input"
                  />
                </div>

                <label className="lg-label">비밀번호 확인</label>
                <div className="lg-field lg-mb16">
                  <i className="ph-fill ph-lock-key-open lg-field-icon" />
                  <PasswordInput
                    data-req="비밀번호 확인"
                    placeholder="비밀번호를 다시 입력해 주세요"
                    className="lg-input"
                  />
                </div>

                <label className="lg-terms">
                  <input type="checkbox" data-req-check="약관 동의" />
                  <span>
                    서비스 이용약관 및 개인정보 처리방침에 동의합니다.{' '}
                    <span className="lg-req">(필수)</span>
                  </span>
                </label>

                {formError && (
                  <div className="lg-formerr">
                    <i className="ph-fill ph-warning-circle" />
                    <span>{formError}</span>
                  </div>
                )}
                <button type="button" onClick={() => validateAndSubmit()} className="lg-primary">
                  <i className="ph-fill ph-user-plus lg-primary-icon20" />
                  가입하기
                </button>

                <div className="lg-notice lg-notice--mt16">
                  <i className="ph-fill ph-info" />
                  <p>{signupNotice}</p>
                </div>
              </>
            )}

          </div>
        )}
      </div>

      {/* SECURITY CAPTCHA POPUP */}
      {captcha && (
        <div className="lg-cap-overlay">
          <div className="lg-cap">
            <div className="lg-cap-card">
              <div className="lg-cap-head">
                <div className="lg-cap-chip">
                  <i className="ph-fill ph-shield-check" />
                  <span>보안 확인</span>
                </div>
                <button type="button" onClick={() => setCaptcha(false)} className="lg-cap-close">
                  <i className="ph-bold ph-x" />
                </button>
                <div className="lg-cap-title">사람인지 확인해요</div>
                <div className="lg-cap-sub">잠깐만 확인하고 이어가요</div>
              </div>

              <div className="lg-cap-body">
                <div className="lg-cap-why">
                  <span className="lg-cap-why-icon">
                    <i className="ph-fill ph-hand-waving" />
                  </span>
                  <span className="lg-cap-why-text">
                    평소와 조금 다른 접속이 보여서 한 번만 확인할게요. 사람이라면 아주 쉬워요.
                  </span>
                </div>

                {/* 과제 안내는 여기서 하드코딩하지 않는다 — 메인 캡차가 플래그로 forest↔드래그
                    사이에서 바뀌므로(ForestCaptcha 디스패처), 안내를 호출부가 고정하면 실제 과제와
                    어긋난다. 각 위젯이 자기 안내를 그린다. 통과 시 토큰은 그대로 자동 전달된다. */}
                <div className="lg-cap-slot lg-cap-slot--forest">
                  <ForestCaptcha onToken={onCaptchaToken} />
                </div>
              </div>

              <div className="lg-cap-foot">
                <span className="lg-cap-guard">
                  <i className="ph-fill ph-shield-check" />
                  CatChap Guard가 지켜줘요
                </span>
                <span className="lg-cap-foot-note">이 확인은 보조 절차예요</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SIGNUP SUCCESS POPUP (student / parent / teacher) — 깔끔한 확인 모달(마스코트·색종이 없음) */}
      {signupDone && (
        <div className="lg-done-overlay">
          <div className="lg-done">
            <div className="lg-done-card">
              <div className="lg-done-icon">
                <i className="ph-bold ph-check" />
              </div>
              <h3 className="lg-done-title">가입이 완료됐어요</h3>
              <p className="lg-done-msg">
                회원가입이 완료됐어요. 이제 로그인하고 학습을 시작하세요.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSignupDone(false);
                  setView('login');
                }}
                className="lg-done-btn"
              >
                <i className="ph-fill ph-sign-in" />
                로그인 하러 가기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
