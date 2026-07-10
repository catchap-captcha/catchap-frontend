import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { parentApi } from '../../api/parents';
import mascot from '../../assets/characters/catchap-logo.png';
import InstitutionPicker, { type PickedInstitution } from '../../components/auth/InstitutionPicker';
import ForestCaptcha from '../../components/captcha/ForestCaptcha';
import { INVITE_PREFILL_KEY } from './InvitePage';
import { useAuth } from '../../hooks/useAuth';
import { PATHS } from '../../routes/paths';
import { ROLE_HOME } from '../../routes/roleRoutes';
import './LoginPage.css';
import PasswordInput from '../../components/common/PasswordInput';

type RoleTab = 'student' | 'parent' | 'org';
type OrgStep = 'form' | 'submitted' | 'plans' | 'contract' | 'done';

// 데모: 이미 등록된 기관 고유번호 (원본 하드코딩)
const EXISTING_CODES = ['123-45-67890', '220-88-12345'];

const PLAN_DEFS = [
  { id: 'starter', name: 'Starter', students: '1~50명', admins: '최대 2개', quota: '월 7,500회 포함', desc: '소규모 기관용', price: '월 49,000원', min: 1, max: 50 },
  { id: 'basic', name: 'Basic', students: '51~150명', admins: '최대 5개', quota: '월 22,500회 포함', desc: '중소형 기관용', price: '월 129,000원', min: 51, max: 150 },
  { id: 'standard', name: 'Standard', students: '151~300명', admins: '최대 10개', quota: '월 45,000회 포함', desc: '학교 및 대형 학원용', price: '월 249,000원', min: 151, max: 300 },
  { id: 'pro', name: 'Pro', students: '301~700명', admins: '최대 20개', quota: '월 100,000회 포함', desc: '대규모 기관용', price: '월 499,000원', min: 301, max: 700 },
  { id: 'enterprise', name: 'Enterprise', students: '701명 이상', admins: '협의', quota: '맞춤 제공', desc: 'API 연동 및 맞춤 계약', price: '별도 문의', min: 701, max: Infinity },
];

const CONTRACT_TYPES = [
  { id: 'monthly', label: '월간 계약' },
  { id: 'annual', label: '연간 계약' },
  { id: 'consult', label: '상담 후 결정' },
];

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function fmtPhone(v: string) {
  const d = (v || '').replace(/\D/g, '').slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return d.slice(0, 3) + '-' + d.slice(3);
  return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7);
}

function fmtTel(v: string) {
  let d = (v || '').replace(/\D/g, '');
  if (d.startsWith('02')) {
    d = d.slice(0, 10);
    if (d.length < 3) return d;
    if (d.length < 6) return d.slice(0, 2) + '-' + d.slice(2);
    if (d.length < 10) return d.slice(0, 2) + '-' + d.slice(2, d.length - 4) + '-' + d.slice(d.length - 4);
    return d.slice(0, 2) + '-' + d.slice(2, 6) + '-' + d.slice(6);
  }
  return fmtPhone(d);
}

function markField(el: HTMLElement, bad: boolean) {
  el.style.borderColor = bad ? '#E23D3D' : '#FFE0D6';
  el.style.background = bad ? '#FFF5F5' : '#FFFBF6';
}

function markCheck(el: HTMLElement, bad: boolean) {
  el.style.outline = bad ? '2px solid #E23D3D' : '';
  el.style.outlineOffset = bad ? '3px' : '';
  el.style.borderRadius = '4px';
}

/** 기관 신청/계약 세로 스텝퍼 (원본 buildSteps) */
function Stepper({ labels, currentIdx }: { labels: string[]; currentIdx: number }) {
  return (
    <>
      {labels.map((text, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        const isLast = i === labels.length - 1;
        const dotCls =
          'lg-step-dot ' + (done ? 'lg-step-dot--done' : active ? 'lg-step-dot--active' : 'lg-step-dot--pending');
        const icon = done ? 'ph-bold ph-check' : active ? 'ph-fill ph-dot-outline' : 'ph-fill ph-circle';
        const labelCls =
          'lg-step-label' + (active ? ' lg-step-label--active' : done ? ' lg-step-label--done' : '');
        const lineCls =
          'lg-step-line' + (done ? ' lg-step-line--done' : '') + (isLast ? ' lg-step-line--last' : '');
        return (
          <div key={text} className="lg-step">
            <div className="lg-step-rail">
              <span className={dotCls}>
                <i className={icon} />
              </span>
              <span className={lineCls} />
            </div>
            <div className="lg-step-body">
              <div className={labelCls}>{text}</div>
            </div>
          </div>
        );
      })}
    </>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, studentLogin, me: authMe, loading: authLoading } = useAuth();

  // 이미 로그인한 사용자가 /login에 오면(주소창 직접 입력 등) 자기 역할 홈으로 보냄.
  // replace: 뒤로가기로 로그인 폼에 다시 안 걸리게.
  useEffect(() => {
    if (!authLoading && authMe) {
      navigate(ROLE_HOME[authMe.role], { replace: true });
    }
  }, [authLoading, authMe, navigate]);

  const [view, setView] = useState<'login' | 'signup'>('login');
  const [role, setRole] = useState<RoleTab>('student');
  const [orgKind, setOrgKind] = useState<'teacher' | 'org' | null | undefined>(undefined);
  const [captcha, setCaptcha] = useState(false);
  const [signupDone, setSignupDone] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [codeSecondsLeft, setCodeSecondsLeft] = useState(0); // 이메일 인증코드 유효시간(5분) 카운트다운
  const [verified, setVerified] = useState(false);
  // 교사 초대링크로 진입한 경우: 초대 토큰(가입 시 서버로 전달해 이메일 인증코드 생략)과
  // 초대 시 관리자가 입력한 이름(이름칸 자동 입력). inviteToken이 있으면 '초대 가입' 모드.
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [prefillName, setPrefillName] = useState('');
  const [orgStep, setOrgStep] = useState<OrgStep>('form');
  const [orgPlan, setOrgPlan] = useState('basic');
  const [contractType, setContractType] = useState('monthly');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [orgEmail, setOrgEmail] = useState('');
  const [orgTel, setOrgTel] = useState('');
  const [orgPhone, setOrgPhone] = useState('');
  const [formError, setFormError] = useState('');
  const [orgDup, setOrgDup] = useState(false);
  const [orgCode, setOrgCode] = useState('');
  const [orgCodeStatus, setOrgCodeStatus] = useState<'idle' | 'empty' | 'valid' | 'invalid'>('idle');
  const [inviteCode, setInviteCode] = useState(''); // 학부모 가입 시 자녀 초대코드(선택)
  const [loginError, setLoginError] = useState('');
  const [loginBad, setLoginBad] = useState(false);
  // 아이디+비밀번호가 여러 기관에서 일치할 때(409)만 후보 기관 버튼 노출
  const [orgCandidates, setOrgCandidates] = useState<
    { organization_id: string; organization_name: string }[] | null
  >(null);
  // 5회 이상 로그인 실패(서버 집계) 시 캡차 요구
  const [captchaNeeded, setCaptchaNeeded] = useState(false);
  const [signupInst, setSignupInst] = useState<PickedInstitution | null>(null);
  // 학생 아이디 중복 확인 상태 — 'available'이어야 가입 진행 가능
  const [idCheck, setIdCheck] = useState<'idle' | 'checking' | 'available' | 'taken' | 'empty'>('idle');
  // 기관 등록 폼에서 입력한 값 — 승인 후 요금제 선택 화면 요약에 사용 (미입력/직접 진입 시 원본 문구 fallback)
  const [orgSummary, setOrgSummary] = useState({ orgName: '', contactName: '', expectedStudents: '' });

  const formRef = useRef<HTMLDivElement | null>(null);
  const loginIdRef = useRef<HTMLInputElement | null>(null);
  const loginPwRef = useRef<HTMLInputElement | null>(null);
  const orgTypeRef = useRef<HTMLSelectElement | null>(null);
  const purposeRef = useRef<HTMLSelectElement | null>(null);
  const capT = useRef<number | null>(null);
  const boundRoots = useRef(new WeakSet<HTMLElement>());

  useEffect(
    () => () => {
      if (capT.current) window.clearTimeout(capT.current);
    },
    [],
  );

  // 초대링크(/invite)로 들어온 경우: InvitePage가 담아둔 프리필을 읽어 교사 가입을 자동 구성.
  // 기관·교사코드는 서버 검증을 이미 통과한 값이라 코드 상태를 'valid'로 세팅(재검증 불필요).
  useEffect(() => {
    const raw = sessionStorage.getItem(INVITE_PREFILL_KEY);
    if (!raw) return;
    sessionStorage.removeItem(INVITE_PREFILL_KEY);
    try {
      const p = JSON.parse(raw) as {
        token?: string;
        organizationId: string;
        organizationName: string;
        teacherCode: string;
        name?: string;
        email: string;
        role: string;
        instType?: string;
        sido?: string;
        sigungu?: string;
        dong?: string;
        road?: string;
      };
      if (!p.organizationId || !p.teacherCode) return;
      setView('signup');
      setRole('org');
      setOrgKind('teacher');
      setSignupInst({
        id: p.organizationId,
        organizationId: p.organizationId,
        name: p.organizationName,
        type: p.instType ?? '',
        sido: p.sido ?? '',
        sigungu: p.sigungu ?? '',
        dong: p.dong ?? '',
        road: p.road ?? '',
      });
      setOrgCode(p.teacherCode);
      setOrgCodeStatus('valid');
      setEmail(p.email);
      if (p.token) setInviteToken(p.token);
      if (p.name) setPrefillName(p.name);
      // 초대 메일 수신으로 이메일 소유가 이미 증명됨 → 인증 완료 상태로 두고 코드 절차 생략
      setVerified(true);
    } catch {
      /* 프리필 파싱 실패 시 일반 로그인 화면 유지 */
    }
  }, []);

  // 이메일 인증코드 5분 카운트다운 — 코드 발송 후 매초 감소, 인증 완료/미발송 시 정지.
  useEffect(() => {
    if (!codeSent || verified || codeSecondsLeft <= 0) return;
    const t = window.setInterval(() => {
      setCodeSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [codeSent, verified, codeSecondsLeft > 0]);

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // 초대 이름 자동 입력: 이름칸은 비제어(uncontrolled) 입력이라 가입 뷰가 렌더된 뒤 DOM 값을 채운다.
  useEffect(() => {
    if (!prefillName) return;
    const el = formRef.current?.querySelector<HTMLInputElement>('[data-req="이름"]');
    if (el && !el.value) el.value = prefillName;
  }, [prefillName, view, orgKind]);

  const isTeacher = role === 'org' && orgKind === 'teacher';
  // 초대 링크로 온 교사 가입: 기관·코드·이메일이 확정돼 있어 기관 선택/코드/이메일 인증 UI를 숨긴다.
  const invited = isTeacher && !!inviteToken;
  const orgChoose = role === 'org' && orgKind === null;
  const personalSignup = role === 'student' || role === 'parent' || isTeacher;
  const showInstitution = role === 'student' || isTeacher;
  const orgForm = role === 'org' && orgKind === 'org' && orgStep === 'form';
  const orgSubmitted = role === 'org' && orgKind === 'org' && orgStep === 'submitted';
  const orgPlansView = role === 'org' && orgKind === 'org' && orgStep === 'plans';
  const orgContract = role === 'org' && orgKind === 'org' && orgStep === 'contract';
  const orgDone = role === 'org' && orgKind === 'org' && orgStep === 'done';
  const showSignupHeader = personalSignup || orgChoose || orgForm;

  const codeHelper = isTeacher
    ? '소속 기관에서 발급받은 교사용 코드예요. 모르면 기관 관리자에게 문의하세요.'
    : '소속 기관에서 발급받은 코드예요. 모르면 선생님께 물어봐요.';

  // ===== 라벨/문구 (원본 loginMap/signupMap/titleMap) =====
  const loginMap: Record<RoleTab, { idLabel: string; idPlaceholder: string; notice: string }> = {
    student: { idLabel: '학생 아이디', idPlaceholder: '아이디를 입력해 주세요', notice: '학생·학부모는 회원가입 후, 기관은 관리자 승인 후 이용할 수 있어요.' },
    parent: { idLabel: '학부모 아이디', idPlaceholder: '이메일 또는 아이디', notice: '자녀 연결은 기관 승인 후 이용할 수 있어요.' },
    // 선생님·기관 관리자 공용 — 로그인 구분 없이 계정(이메일)으로 역할 자동 판별
    org: { idLabel: '기관 아이디', idPlaceholder: '이메일 또는 아이디', notice: '기관 계정은 등록 신청·승인·계약 완료 후 발급돼요.' },
  };
  const idLabel = loginMap[role].idLabel;
  const idPlaceholder = loginMap[role].idPlaceholder;
  const notice = loginMap[role].notice;

  let nameLabel = '';
  let namePlaceholder = '';
  let phoneLabel = '';
  let signupNotice = '';
  if (role === 'student') {
    nameLabel = '학생 이름';
    namePlaceholder = '학생 이름을 입력해 주세요';
    phoneLabel = '보호자 휴대폰 번호';
    signupNotice = '만 14세 미만은 보호자 동의가 필요해요. 가입 후 기관 승인을 거쳐 이용할 수 있어요.';
  } else if (role === 'parent') {
    nameLabel = '보호자 이름';
    namePlaceholder = '보호자 이름을 입력해 주세요';
    phoneLabel = '휴대폰 번호';
    signupNotice = '가입 후 자녀 계정과 연결하면 학습 현황을 확인할 수 있어요.';
  }
  if (isTeacher) {
    nameLabel = '선생님 이름';
    namePlaceholder = '선생님 이름을 입력해 주세요';
    signupNotice = '선생님 가입은 소속 기관의 승인 후 담당 학급을 배정받아 이용할 수 있어요.';
  }

  let signupTitle = '회원가입';
  let signupSubtitle = '역할을 선택하고 정보를 입력해 주세요';
  if (role === 'org') {
    signupTitle = '기관 등록 신청';
    signupSubtitle =
      'CatChap 기관 서비스는 관리자 승인 후 이용할 수 있습니다. 기관 정보를 입력해주시면 관리자가 검토한 뒤 담당자 이메일로 승인 결과를 안내드립니다.';
    if (orgChoose) {
      signupTitle = '기관 회원가입';
      signupSubtitle = '선생님이신가요, 기관 관리자이신가요? 가입 유형을 선택해 주세요.';
    } else if (isTeacher) {
      signupTitle = '선생님 회원가입';
      signupSubtitle = '소속 기관을 선택하고 선생님 정보를 입력해 주세요.';
    }
  }

  const emailInvalid = email.length > 0 && !isEmail(email);
  const orgEmailInvalid = orgEmail.length > 0 && !isEmail(orgEmail);

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
      if (t.hasAttribute('data-org-code')) setOrgDup(false);
    });
  };

  const fieldVal = (sel: string) => {
    const el = formRef.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>(sel);
    return el ? el.value.trim() : '';
  };

  const submitPersonalRegistration = () => {
    const name = fieldVal('[data-req="이름"]');
    const loginId = fieldVal('[data-req="아이디"]');
    const pw = fieldVal('[data-req="비밀번호"]');
    const emailCode = fieldVal('[data-req="인증코드"]');
    let req: Promise<unknown>;
    if (role === 'student') {
      req = authApi.registerStudent({
        name,
        organization_id: signupInst?.organizationId ?? '',
        org_code: orgCode.trim(),
        email,
        email_code: emailCode,
        student_login_id: loginId,
        password: pw,
      });
    } else if (role === 'parent') {
      req = authApi.registerParent({ name, email, phone, password: pw, email_code: emailCode });
    } else {
      req = authApi.registerTeacher({
        name,
        email,
        password: pw,
        email_code: emailCode,
        organization_id: signupInst?.organizationId ?? '',
        teacher_code: orgCode.trim(),
        invite_token: inviteToken ?? undefined,
      });
    }
    req
      .then(async () => {
        // 학부모 가입 + 초대코드 입력 시: 로그인 후 초대코드로 자녀 즉시 연결 (선택)
        const invite = inviteCode.trim();
        if (role === 'parent' && invite) {
          try {
            await login({ email, password: pw });
            await parentApi.linkInvite(invite);
          } catch {
            // 계정은 만들어졌으니 가입 완료로 처리 — 연결만 실패(로그인 후 앱에서 재시도 가능)
            setFormError('가입은 됐지만 초대코드 연결에 실패했어요. 로그인 후 자녀 연결에서 다시 시도해 주세요.');
          }
        }
        setSignupDone(true);
      })
      .catch(() => setFormError('가입에 실패했어요. 입력 정보를 확인한 뒤 다시 시도해 주세요.'));
  };

  const submitOrgRegistration = () => {
    const orgName = fieldVal('[data-req="기관명"]');
    const contactName = fieldVal('[data-req="담당자 이름"]');
    const expected = fieldVal('[data-req="예상 학생 수"]');
    // 요금제 선택 단계 요약에서 사용할 입력값 보관
    setOrgSummary({ orgName, contactName, expectedStudents: expected });
    authApi
      .registerOrg({
        org_name: orgName,
        org_type: orgTypeRef.current?.value ?? '초등학교',
        business_number: fieldVal('[data-org-code]'),
        address: fieldVal('[data-req="기관 주소"]'),
        contact_name: contactName,
        contact_email: orgEmail,
        contact_phone: orgPhone,
        // TODO(api): 원본 폼에 비밀번호/이메일 인증 없음 — 계정은 승인 후 발급 (1차 자동승인)
        password: '',
        email_code: '',
        expected_students: expected,
        plan_interest: purposeRef.current?.value ?? '',
      })
      .then(() => setOrgStep('submitted'))
      .catch(() => setFormError('기관 등록 신청에 실패했어요. 잠시 후 다시 시도해 주세요.'));
  };

  const validateAndSubmit = (kind: 'personal' | 'org') => {
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
    if (kind === 'org') {
      const codeEl = root.querySelector<HTMLInputElement>('[data-org-code]');
      const codeVal = codeEl ? codeEl.value.replace(/\s/g, '') : '';
      if (codeEl && codeVal && EXISTING_CODES.includes(codeVal)) {
        markField(codeEl, true);
        setOrgDup(true);
        setFormError('');
        codeEl.focus();
        return;
      }
      setOrgDup(false);
    }
    if (missing > 0) {
      setFormError('입력하지 않은 필수 항목이 있어요. 표시된 곳을 다시 확인해 주세요.');
      (firstBad as HTMLElement | null)?.focus();
      return;
    }
    const codeEl = root.querySelector<HTMLInputElement>('[data-code-field]');
    if (codeEl && visible(codeEl) && orgCodeStatus !== 'valid') {
      markField(codeEl, true);
      if (orgCodeStatus === 'idle') setOrgCodeStatus('empty');
      setFormError('기관 코드 인증을 먼저 확인해 주세요.');
      codeEl.focus();
      return;
    }
    // 학생 가입은 아이디 중복 확인(전역 유일) 통과 필수
    if (kind === 'personal' && role === 'student' && idCheck !== 'available') {
      const idEl = root.querySelector<HTMLInputElement>('[data-req="아이디"]');
      if (idEl) markField(idEl, true);
      if (idCheck === 'idle' || idCheck === 'checking') setIdCheck('empty');
      setFormError('아이디 중복 확인을 먼저 해주세요.');
      idEl?.focus();
      return;
    }
    // 비밀번호 길이·일치 검증 (개인 가입) — 서버 422 전에 어떤 칸이 왜 틀렸는지 명확히 안내
    if (kind === 'personal') {
      const min = role === 'student' ? 4 : 8;
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
    }
    setFormError('');
    if (kind === 'org') submitOrgRegistration();
    else submitPersonalRegistration();
  };

  // ===== 이메일 인증 / 코드 확인 (authApi 연결, UI 흐름은 원본 그대로) =====
  const sendCode = () => {
    // 학부모/교사는 이 이메일이 계정 ID — 이미 가입된 이메일이면 발송 전에 알려줌(409)
    const forAccount = role === 'parent' || isTeacher;
    authApi
      .sendEmailCode(email, 'signup', forAccount)
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

  // ===== 학생 아이디 중복 확인 (전역 유일) =====
  const checkId = () => {
    const loginId = fieldVal('[data-req="아이디"]');
    if (loginId.length < 3) {
      setIdCheck('empty');
      return;
    }
    setIdCheck('checking');
    authApi
      .checkStudentId(loginId)
      .then((r) => setIdCheck(r.available ? 'available' : 'taken'))
      .catch(() => setIdCheck('taken'));
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

  const verifyOrgCodeFn = () => {
    if (orgCodeStatus === 'valid') return;
    const v = orgCode.trim();
    if (!v) {
      setOrgCodeStatus('empty');
      return;
    }
    // 검색으로 고른 학교가 CatChap 미등록(organizationId=null)이면 가입 대상이 아니다 — 코드 검증 불가.
    const orgId = signupInst?.organizationId ?? '';
    if (!orgId) {
      setOrgCodeStatus('invalid');
      return;
    }
    const req = isTeacher
      ? authApi.verifyTeacherCode(orgId, v)
      : authApi.verifyOrgCode(orgId, v);
    req
      .then((r) => setOrgCodeStatus(r.valid ? 'valid' : 'invalid'))
      .catch(() => setOrgCodeStatus('invalid'));
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
      if (role === 'student') {
        // 후보 버튼으로 고른 기관 > 기억해 둔 기관 > 미지정(백엔드가 비밀번호로 판별)
        const orgId = orgOverride ?? rememberedOrg(id);
        try {
          const me = await studentLogin({
            organization_id: orgId,
            student_login_id: id,
            password: pw,
            captcha_token: captchaToken,
          });
          if (orgId) rememberOrg(id, orgId);
          setCaptchaNeeded(false);
          navigate(ROLE_HOME[me.role]);
          return;
        } catch (err) {
          const resp = (err as { response?: { status?: number } })?.response;
          // 기억해 둔 기관이 더 이상 맞지 않으면(전학 등) 잊고 전체에서 한 번 더
          if (resp?.status === 401 && orgId && !orgOverride) {
            forgetOrg(id);
            const me = await studentLogin({
              student_login_id: id,
              password: pw,
              captcha_token: captchaToken,
            });
            setCaptchaNeeded(false);
            navigate(ROLE_HOME[me.role]);
            return;
          }
          throw err;
        }
      }
      // 역할(선생님/기관 관리자/학부모)은 백엔드가 이메일로 조회한 계정에서 판별한다.
      const me = await login({ email: id, password: pw, captcha_token: captchaToken });
      setCaptchaNeeded(false);
      navigate(ROLE_HOME[me.role]);
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
      if (role === 'student' && resp?.status === 409 && Array.isArray(detailObj?.candidates)) {
        setOrgCandidates(detailObj.candidates);
        setLoginError(detailObj.message ?? '소속 기관을 눌러 주세요.');
        return;
      }

      // 서버가 5회 이상 실패를 알리면 다음 시도부터 캡차 요구
      if (detailObj?.captcha_required) setCaptchaNeeded(true);

      setLoginBad(true);
      setLoginError(
        detailObj?.captcha_required
          ? '로그인에 여러 번 실패해서 보안 확인이 필요해요. 다시 시도해 주세요.'
          : '아이디 또는 비밀번호가 올바르지 않아요. 다시 확인해 주세요.',
      );
    }
  };

  const pickOrgCandidate = (orgId: string) => {
    setOrgCandidates(null);
    setLoginError('');
    void doLogin(orgId);
  };

  // 메인 캡차(forest) 통과 → 단일사용 토큰을 로그인에 실어 재시도
  const onCaptchaToken = (token: string) => {
    setCaptcha(false);
    void doLogin(undefined, token);
  };

  // ===== 탭/뷰 전환 (원본 그대로) =====
  // 원본은 탭 전환 시 폼이 다시 그려져 입력값이 초기화됨 — 동일하게 입력칸/에러를 리셋
  const resetLoginFields = () => {
    if (loginIdRef.current) loginIdRef.current.value = '';
    if (loginPwRef.current) loginPwRef.current.value = '';
    setLoginBad(false);
    setLoginError('');
    setOrgCandidates(null);
    setCaptchaNeeded(false); // 계정별 실패 횟수는 서버가 기억 — 다음 실패 시 다시 신호가 온다
  };
  const setStudent = () => {
    setRole('student');
    resetLoginFields();
    // 회원가입 뷰에서 학생으로 전환하면 옛 이메일 가입폼 대신 코드 활성화 화면으로
    if (view === 'signup') navigate(PATHS.ACTIVATE);
  };
  const setParent = () => {
    setRole('parent');
    resetLoginFields();
  };
  const setOrg = () => {
    setRole('org');
    setOrgKind(null);
    setOrgStep('form');
    resetLoginFields();
  };
  const goSignup = () => {
    // 학생은 이메일 가입이 아니라 학교 발급 코드로 활성화 (온보딩 재설계)
    if (role === 'student') {
      navigate(PATHS.ACTIVATE);
      return;
    }
    setView('signup');
    setCodeSent(false);
    setCodeSecondsLeft(0);
    setVerified(false);
    setOrgStep('form');
  };
  const goLogin = () => setView('login');

  const tabCls = (active: boolean) => 'lg-tab' + (active ? ' lg-tab--active' : '');
  const loginInputCls = (base: string) => base + (loginBad ? ' lg-input--bad' : '');

  // ===== 요금제/계약 — 예상 학생 수는 기관 등록 폼 입력값, 없으면 원본 데모값 120 =====
  const parsedExpected = parseInt(orgSummary.expectedStudents, 10);
  const expectedStudents = Number.isFinite(parsedExpected) && parsedExpected > 0 ? parsedExpected : 120;
  const selDef = PLAN_DEFS.find((p) => p.id === orgPlan) ?? PLAN_DEFS[1];

  const roleTabs = (signup: boolean) => (
    <div className={'lg-tabs' + (signup ? ' lg-tabs--signup' : '')}>
      <button type="button" onClick={setStudent} className={tabCls(role === 'student')}>
        <i className="ph-fill ph-student" />
        학생
      </button>
      <button type="button" onClick={setParent} className={tabCls(role === 'parent')}>
        <i className="ph-fill ph-users-three" />
        학부모
      </button>
      <button type="button" onClick={setOrg} className={tabCls(role === 'org')}>
        <i className="ph-fill ph-buildings" />
        기관
      </button>
    </div>
  );

  // 로그인 상태면 폼 렌더 없이 위 효과가 홈으로 이동 (폼 깜빡임 방지)
  if (authMe) return null;

  return (
    <div className="lg-root">
      {/* LEFT BRAND PANEL */}
      <div className="lg-left">
        <div className="lg-left-deco">
          <div className="lg-left-c1" />
          <div className="lg-left-c2" />
          <div className="lg-left-c3" />
          <div className="lg-left-c4" />
        </div>
        <div className="lg-left-pin">
          <Link to={PATHS.HOME} className="lg-brand" title="메인으로">
            <div className="lg-brand-logo">
              <img src={mascot} alt="CatChap" />
            </div>
            <span className="lg-brand-name">CatChap</span>
          </Link>
          <div className="lg-hero">
            <div className="lg-hero-mascot-row">
              <div className="lg-hero-mascot">
                <img src={mascot} alt="마스코트" />
              </div>
            </div>
            <h1 className="lg-hero-title">
              아이의 배움을
              <br />
              안전하게 지켜요
            </h1>
            <p className="lg-hero-sub">
              교육기관이 믿고 도입하는 어린이 학습 인증 서비스.
              <br />
              검증된 보안 기술로 아이들의 정보를 안전하게 지킵니다.
            </p>
          </div>
          <div className="lg-badges">
            <span className="lg-badge">
              <i className="ph-fill ph-shield-check" />
              안전한 데이터 보호
            </span>
            <span className="lg-badge">
              <i className="ph-fill ph-puzzle-piece" />
              놀이형 학습
            </span>
            <span className="lg-badge">
              <i className="ph-fill ph-chart-line-up" />
              행동 데이터 분석
            </span>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="lg-right">
        {/* ===== LOGIN VIEW ===== */}
        {view === 'login' && (
          <div className="lg-login">
            <h2 className="lg-h2">로그인</h2>
            <p className="lg-login-sub">역할을 선택하고 로그인해 주세요</p>

            {roleTabs(false)}

            {/* 아이디+비밀번호가 여러 기관에서 일치할 때(409)만 후보 기관 원클릭 선택 */}
            {role === 'student' && orgCandidates && (
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
              <i className="ph-fill ph-user-circle lg-field-icon" />
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
              <i className="ph-fill ph-lock-key lg-field-icon" />
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
                <input type="checkbox" />
                로그인 유지
              </label>
              <Link to={PATHS.PASSWORD_RESET} className="lg-forgot">
                비밀번호를 잊으셨나요?
              </Link>
            </div>

            {loginError && (
              <div className="lg-formerr">
                <i className="ph-fill ph-warning-circle" />
                <span>{loginError}</span>
              </div>
            )}

            <button type="button" onClick={submitLogin} className="lg-primary">
              <i className="ph-fill ph-sign-in lg-primary-icon20" />
              로그인
            </button>

            <div className="lg-divider">
              <div className="lg-divider-line" />
              <span>또는</span>
              <div className="lg-divider-line" />
            </div>
            <button type="button" onClick={goSignup} className="lg-secondary">
              <i className="ph-fill ph-user-plus" />
              회원가입
            </button>

            <div className="lg-notice">
              <i className="ph-fill ph-info" />
              <p>{notice}</p>
            </div>
          </div>
        )}

        {/* ===== SIGNUP VIEW ===== */}
        {view === 'signup' && (
          <div ref={formRef} className="lg-signup">
            {showSignupHeader && (
              <>
                <button type="button" onClick={goLogin} className="lg-back">
                  <i className="ph-bold ph-arrow-left" />
                  로그인으로 돌아가기
                </button>
                <h2 className="lg-h2 lg-h2--signup">{signupTitle}</h2>
                <p className="lg-signup-sub">{signupSubtitle}</p>
                {roleTabs(true)}
              </>
            )}

            {/* ============ ORG SIGNUP : KIND CHOOSER ============ */}
            {orgChoose && (
              <>
                <div className="lg-kinds">
                  <button
                    type="button"
                    onClick={() => {
                      setOrgKind('teacher');
                      setCodeSent(false);
                      setCodeSecondsLeft(0);
                      setVerified(false);
                    }}
                    className="lg-kind"
                  >
                    <span className="lg-kind-icon lg-kind-icon--red">
                      <i className="ph-fill ph-chalkboard-teacher" />
                    </span>
                    <span className="lg-kind-body">
                      <span className="lg-kind-title">선생님으로 가입</span>
                      <span className="lg-kind-desc">
                        소속 기관과 코드로 신청해요. 학생 가입과 비슷한 방식이에요.
                      </span>
                    </span>
                    <i className="ph-bold ph-arrow-right lg-kind-arrow" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOrgKind('org');
                      setOrgStep('form');
                    }}
                    className="lg-kind"
                  >
                    <span className="lg-kind-icon lg-kind-icon--blue">
                      <i className="ph-fill ph-buildings" />
                    </span>
                    <span className="lg-kind-body">
                      <span className="lg-kind-title">기관으로 가입</span>
                      <span className="lg-kind-desc">
                        우리 기관을 새로 등록하고 관리자 계정을 신청해요.
                      </span>
                    </span>
                    <i className="ph-bold ph-arrow-right lg-kind-arrow" />
                  </button>
                </div>
                <div className="lg-notice lg-notice--mt16">
                  <i className="ph-fill ph-info" />
                  <p>선생님은 소속 기관 승인 후, 기관은 관리자 검토·계약 후 이용할 수 있어요.</p>
                </div>
              </>
            )}

            {/* ============ PERSONAL SIGNUP (student / parent / teacher) ============ */}
            {personalSignup && (
              <>
                {isTeacher && (
                  <button type="button" onClick={() => setOrgKind(null)} className="lg-back">
                    <i className="ph-bold ph-arrow-left" />
                    가입 유형 다시 선택
                  </button>
                )}

                <label className="lg-label">{nameLabel}</label>
                <div className="lg-field lg-mb15">
                  <i className="ph-fill ph-identification-card lg-field-icon" />
                  <input type="text" data-req="이름" placeholder={namePlaceholder} className="lg-input" />
                </div>

                {showInstitution && invited && (
                  <>
                    <label className="lg-label">소속 기관</label>
                    <div className="lg-invitedInst lg-mb15">
                      <div className="lg-invitedInst-name">
                        <i className="ph-fill ph-buildings" />
                        <span>{signupInst?.name || '소속 기관'}</span>
                      </div>
                      {(() => {
                        const addr = [
                          signupInst?.sido,
                          signupInst?.sigungu,
                          signupInst?.dong,
                          signupInst?.road,
                        ]
                          .filter((s) => s && s.trim())
                          .join(' ');
                        return addr ? <p className="lg-invitedInst-addr">{addr}</p> : null;
                      })()}
                      <p className="lg-invitedInst-note">
                        <i className="ph-fill ph-check-circle" /> 초대받은 기관·교사 코드가 자동으로 확인됐어요.
                      </p>
                    </div>
                  </>
                )}

                {showInstitution && !invited && (
                  <>
                    <label className="lg-label">소속 기관</label>
                    <div className="lg-mb15">
                      <InstitutionPicker
                        onSelect={(inst) => {
                          setSignupInst(inst);
                          // 기관이 바뀌면 이전 기관에서 통과한 코드 검증은 무효 —
                          // 유지하면 미등록 학교 + 옛 valid 상태로 빈 organization_id가 서버에 간다
                          setOrgCodeStatus('idle');
                        }}
                        initialSelected={signupInst}
                      />
                    </div>

                    <label className="lg-label">기관 코드</label>
                    <div className="lg-inline lg-mb7">
                      <div className="lg-field-grow">
                        <i className="ph-fill ph-key lg-field-icon" />
                        <input
                          type="text"
                          data-req="기관 코드"
                          data-code-field=""
                          value={orgCode}
                          onChange={(e) => {
                            setOrgCode(e.target.value);
                            setOrgCodeStatus('idle');
                          }}
                          placeholder="기관에서 받은 코드를 입력해 주세요"
                          className="lg-input lg-input--code"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={verifyOrgCodeFn}
                        className={'lg-codebtn' + (orgCodeStatus === 'valid' ? ' lg-codebtn--valid' : '')}
                      >
                        {orgCodeStatus === 'valid' ? '인증됨' : '확인'}
                      </button>
                    </div>
                    {orgCodeStatus === 'valid' && (
                      <div className="lg-code-ok">
                        <i className="ph-fill ph-check-circle" />
                        <span>기관 코드가 확인되었어요.</span>
                      </div>
                    )}
                    {(orgCodeStatus === 'invalid' || orgCodeStatus === 'empty') && (
                      <div className="lg-code-bad">
                        <i className="ph-fill ph-warning-circle" />
                        <span>
                          {orgCodeStatus === 'empty'
                            ? '기관 코드를 입력해 주세요.'
                            : '코드를 확인할 수 없어요. 기관에 문의해 주세요.'}
                        </span>
                      </div>
                    )}
                    <p className="lg-helper">{codeHelper}</p>
                  </>
                )}

                <label className="lg-label">
                  이메일 {role === 'parent' || isTeacher ? '(로그인 아이디)' : '(본인 확인)'}
                </label>
                {(role === 'parent' || isTeacher) && (
                  <p className="lg-helper" style={{ margin: '-2px 0 8px' }}>
                    이 이메일이 로그인 아이디가 돼요. 교사·학부모는 이메일로 로그인합니다.
                  </p>
                )}
                <div className="lg-inline lg-mb12">
                  <div className="lg-field-grow">
                    <i className="ph-fill ph-envelope-simple lg-field-icon" />
                    <input
                      type="email"
                      data-req="이메일"
                      placeholder="example@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      readOnly={invited}
                      className={
                        'lg-input' +
                        (emailInvalid ? ' lg-input--soft-invalid' : '') +
                        (invited ? ' lg-input--readonly' : '')
                      }
                    />
                  </div>
                  {!invited && (
                    <button
                      type="button"
                      onClick={sendCode}
                      className={'lg-sendbtn' + (codeSent ? ' lg-sendbtn--sent' : '')}
                    >
                      {codeSent ? '재전송' : '인증코드 받기'}
                    </button>
                  )}
                </div>

                {invited && (
                  <div className="lg-verified lg-mb9">
                    <i className="ph-fill ph-check-circle" />
                    <span>초대 메일로 이메일 인증이 완료됐어요. 비밀번호만 정하면 가입이 끝나요.</span>
                  </div>
                )}

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

                {role === 'parent' && (
                  <>
                    <label className="lg-label">{phoneLabel}</label>
                    <div className="lg-field lg-mb15">
                      <i className="ph-fill ph-device-mobile lg-field-icon" />
                      <input
                        type="tel"
                        data-req="보호자 휴대폰"
                        placeholder="010-0000-0000"
                        value={phone}
                        onChange={(e) => setPhone(fmtPhone(e.target.value))}
                        className="lg-input lg-input--code"
                      />
                    </div>

                    <label className="lg-label">
                      자녀 초대코드 <span style={{ color: '#A0A4B2', fontWeight: 600 }}>(선택)</span>
                    </label>
                    <div className="lg-field lg-mb7">
                      <i className="ph-fill ph-identification-badge lg-field-icon" />
                      <input
                        type="text"
                        placeholder="예) LINK-7QX3-9K2M"
                        value={inviteCode}
                        onChange={(e) =>
                          setInviteCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 14))
                        }
                        className="lg-input"
                      />
                    </div>
                    <p style={{ margin: '0 0 15px', fontSize: '12.5px', color: '#8A8F9E', lineHeight: 1.5 }}>
                      학교에서 받은 초대코드가 있으면 입력하세요. 가입과 동시에 자녀와 연결돼요. 없으면 비워두고 가입 후 연결해도 됩니다.
                    </p>
                  </>
                )}

                {/* 아이디는 학생만 사용(전역 유일 로그인 아이디). 교사·학부모는 이메일로 로그인하므로 아이디 칸 없음. */}
                {role === 'student' && (
                  <>
                    <label className="lg-label">아이디</label>
                    {/* 학생 아이디는 전역 유일 — 중복 확인 통과해야 가입 가능 */}
                    <div className="lg-inline lg-mb9">
                      <div className="lg-field-grow">
                        <i className="ph-fill ph-user-circle lg-field-icon" />
                        <input
                          type="text"
                          data-req="아이디"
                          placeholder="사용할 아이디를 입력해 주세요"
                          onInput={() => setIdCheck('idle')}
                          className="lg-input"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={checkId}
                        className={'lg-codebtn' + (idCheck === 'available' ? ' lg-codebtn--valid' : '')}
                      >
                        {idCheck === 'available' ? '사용 가능' : idCheck === 'checking' ? '확인 중…' : '중복 확인'}
                      </button>
                    </div>
                    {idCheck === 'available' && (
                      <div className="lg-code-ok">
                        <i className="ph-fill ph-check-circle" />
                        <span>사용할 수 있는 아이디예요.</span>
                      </div>
                    )}
                    {(idCheck === 'taken' || idCheck === 'empty') && (
                      <div className="lg-code-bad">
                        <i className="ph-fill ph-warning-circle" />
                        <span>
                          {idCheck === 'empty'
                            ? '아이디를 3자 이상 입력한 뒤 중복 확인을 해주세요.'
                            : '이미 사용 중인 아이디예요. 다른 아이디를 골라 주세요.'}
                        </span>
                      </div>
                    )}
                    <div className="lg-mb15" />
                  </>
                )}

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
                <button type="button" onClick={() => validateAndSubmit('personal')} className="lg-primary">
                  <i className="ph-fill ph-user-plus lg-primary-icon20" />
                  가입하기
                </button>

                <div className="lg-notice lg-notice--mt16">
                  <i className="ph-fill ph-info" />
                  <p>{signupNotice}</p>
                </div>
              </>
            )}

            {/* ============ ORG STEP 1 : REGISTRATION FORM ============ */}
            {orgForm && (
              <>
                <button type="button" onClick={() => setOrgKind(null)} className="lg-back">
                  <i className="ph-bold ph-arrow-left" />
                  가입 유형 다시 선택
                </button>
                <div className="lg-orgform-banner">
                  <i className="ph-fill ph-shield-check" />
                  <span>기관은 관리자 승인 후 이용할 수 있어요. 아이디·비밀번호는 승인 후 발급됩니다.</span>
                </div>

                <div className="lg-section">
                  <i className="ph-fill ph-buildings" />
                  기관 정보
                </div>

                <label className="lg-label">기관명</label>
                <input
                  type="text"
                  data-req="기관명"
                  placeholder="예) 햇살초등학교"
                  className="lg-input lg-input--plain lg-mb13"
                />

                <label className="lg-label">기관 유형</label>
                <div className="lg-selectwrap lg-mb13">
                  <select ref={orgTypeRef} className="lg-select">
                    <option>초등학교</option>
                    <option>학원</option>
                    <option>교육기관</option>
                    <option>지자체</option>
                    <option>기타</option>
                  </select>
                  <i className="ph-bold ph-caret-down lg-select-caret" />
                </div>

                <label className="lg-label">기관 주소</label>
                <input
                  type="text"
                  data-req="기관 주소"
                  placeholder="기관 주소를 입력해 주세요"
                  className="lg-input lg-input--plain lg-mb13"
                />

                <div className="lg-two lg-mb24">
                  <div>
                    <label className="lg-label">대표 전화번호</label>
                    <input
                      type="tel"
                      data-req="대표 전화번호"
                      placeholder="02-000-0000"
                      value={orgTel}
                      onChange={(e) => setOrgTel(fmtTel(e.target.value))}
                      className="lg-input lg-input--plain lg-input--ls1"
                    />
                  </div>
                  <div>
                    <label className="lg-label">고유번호</label>
                    <input
                      type="text"
                      data-req="고유번호"
                      data-org-code=""
                      placeholder="000-00-00000"
                      className="lg-input lg-input--plain"
                    />
                    {orgDup && (
                      <div className="lg-orgdup">
                        <i className="ph-fill ph-warning-circle" />
                        <span>이미 등록된 기관이에요. 같은 고유번호로는 다시 등록할 수 없어요.</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg-section">
                  <i className="ph-fill ph-user-circle" />
                  담당자 정보
                </div>

                <div className="lg-two lg-mb13">
                  <div>
                    <label className="lg-label">담당자 이름</label>
                    <input type="text" data-req="담당자 이름" placeholder="이름" className="lg-input lg-input--plain" />
                  </div>
                  <div>
                    <label className="lg-label">직책</label>
                    <input type="text" data-req="직책" placeholder="예) 교사 / 원장" className="lg-input lg-input--plain" />
                  </div>
                </div>

                <label className="lg-label">담당자 이메일</label>
                <input
                  type="email"
                  data-req="담당자 이메일"
                  placeholder="manager@example.com"
                  value={orgEmail}
                  onChange={(e) => setOrgEmail(e.target.value)}
                  className={'lg-input lg-orgemail' + (orgEmailInvalid ? ' lg-input--soft-invalid' : '')}
                />
                {orgEmailInvalid && (
                  <div className="lg-emailerr lg-emailerr--org">
                    <i className="ph-fill ph-warning-circle" />
                    <span>올바르지 않은 이메일 형식이에요. manager@example.com 형식으로 입력해 주세요.</span>
                  </div>
                )}

                <label className="lg-label">담당자 연락처</label>
                <input
                  type="tel"
                  data-req="담당자 연락처"
                  placeholder="010-0000-0000"
                  value={orgPhone}
                  onChange={(e) => setOrgPhone(fmtPhone(e.target.value))}
                  className="lg-input lg-input--plain lg-input--ls1 lg-mb24"
                />

                <div className="lg-section">
                  <i className="ph-fill ph-rocket-launch" />
                  도입 정보
                </div>

                <div className="lg-two lg-mb13">
                  <div>
                    <label className="lg-label">예상 학생 수</label>
                    <input type="number" data-req="예상 학생 수" placeholder="예) 120" className="lg-input lg-input--plain" />
                  </div>
                  <div>
                    <label className="lg-label">예상 관리자 수</label>
                    <input type="number" data-req="예상 관리자 수" placeholder="예) 3" className="lg-input lg-input--plain" />
                  </div>
                </div>

                <label className="lg-label">도입 목적</label>
                <div className="lg-selectwrap lg-mb13">
                  <select ref={purposeRef} className="lg-select">
                    <option>학생 로그인 보안 강화</option>
                    <option>교육형 캡챠 활용</option>
                    <option>행동 데이터 분석</option>
                    <option>학습 리포트 확인</option>
                    <option>학부모 연동</option>
                    <option>기타</option>
                  </select>
                  <i className="ph-bold ph-caret-down lg-select-caret" />
                </div>

                <label className="lg-label">문의 내용 / 요청사항</label>
                <textarea
                  rows={3}
                  placeholder="도입 관련 문의나 요청사항을 자유롭게 적어 주세요"
                  className="lg-textarea lg-mb24"
                />

                <div className="lg-section">
                  <i className="ph-fill ph-check-square" />
                  동의 항목
                </div>
                <div className="lg-agrees">
                  <label className="lg-terms lg-terms--agree">
                    <input type="checkbox" data-req-check="도입 상담 동의" />
                    <span>
                      서비스 도입 상담을 위한 개인정보 수집 및 이용에 동의합니다.{' '}
                      <span className="lg-req">(필수)</span>
                    </span>
                  </label>
                  <label className="lg-terms lg-terms--agree">
                    <input type="checkbox" data-req-check="승인 절차 동의" />
                    <span>
                      기관 정보 확인 및 관리자 승인 절차에 동의합니다. <span className="lg-req">(필수)</span>
                    </span>
                  </label>
                  <label className="lg-terms lg-terms--agree">
                    <input type="checkbox" data-req-check="데이터 정책 확인" />
                    <span>
                      학생 데이터 처리 정책 및 개인정보 보호 기준을 확인했습니다.{' '}
                      <span className="lg-req">(필수)</span>
                    </span>
                  </label>
                </div>

                {formError && (
                  <div className="lg-formerr">
                    <i className="ph-fill ph-warning-circle" />
                    <span>{formError}</span>
                  </div>
                )}
                <button type="button" onClick={() => validateAndSubmit('org')} className="lg-primary">
                  <i className="ph-fill ph-paper-plane-tilt lg-primary-icon19" />
                  기관 등록 신청하기
                </button>
              </>
            )}

            {/* ============ ORG STEP 2 : SUBMITTED ============ */}
            {orgSubmitted && (
              <>
                <div className="lg-orgresult-head">
                  <div className="lg-orgresult-icon lg-orgresult-icon--red">
                    <i className="ph-fill ph-paper-plane-tilt" />
                  </div>
                  <h2>
                    기관 등록 신청이
                    <br />
                    완료되었습니다
                  </h2>
                  <p>
                    입력하신 기관 정보를 바탕으로 관리자가 검토를 진행합니다.
                    <br />
                    승인 결과는 담당자 이메일로 안내됩니다.
                  </p>
                </div>

                <div className="lg-pill-pending">
                  <span className="lg-pill-pending-dot" />
                  <span>PENDING · 접수 완료</span>
                </div>

                <div className="lg-steps">
                  <Stepper labels={['접수 완료', '관리자 검토 중', '승인 완료', '요금제 선택']} currentIdx={0} />
                </div>

                <div className="lg-banner-green">
                  <i className="ph-fill ph-clock" />
                  <span>운영진 검토 후 승인되면 담당자 이메일로 안내드려요. (평균 1~3영업일)</span>
                </div>

                <div className="lg-actions">
                  <button type="button" onClick={goLogin} className="lg-ghostbtn">
                    로그인으로 돌아가기
                  </button>
                  <Link to={PATHS.HOME} className="lg-mainlink">
                    메인으로 이동하기
                  </Link>
                </div>
              </>
            )}

            {/* ============ ORG STEP 3 : PLAN SELECTION ============ */}
            {orgPlansView && (
              <>
                <div className="lg-pill-approved">
                  <i className="ph-fill ph-check-circle" />
                  <span>APPROVED · 승인 완료</span>
                </div>
                <h2 className="lg-h2--org">기관 등록이 승인되었습니다</h2>
                <p className="lg-org-sub">
                  이제 CatChap 기관 요금제를 선택할 수 있습니다.
                  <br />
                  기관 규모에 맞는 요금제를 선택해 주세요.
                </p>

                <div className="lg-orginfo">
                  <div className="lg-orginfo-row">
                    <span className="lg-orginfo-key">기관명</span>
                    <span className="lg-orginfo-val">{orgSummary.orgName || '햇살초등학교'}</span>
                  </div>
                  <div className="lg-orginfo-row">
                    <span className="lg-orginfo-key">담당자</span>
                    <span className="lg-orginfo-val">{orgSummary.contactName || '김민서'}</span>
                  </div>
                  <div className="lg-orginfo-row">
                    <span className="lg-orginfo-key">예상 학생 수</span>
                    <span className="lg-orginfo-val lg-orginfo-val--accent">{expectedStudents}명</span>
                  </div>
                </div>

                <div className="lg-plans">
                  {PLAN_DEFS.map((p) => {
                    const active = orgPlan === p.id;
                    const recommended = expectedStudents >= p.min && expectedStudents <= p.max;
                    const cls =
                      'lg-plan ' +
                      (active ? 'lg-plan--active' : recommended ? 'lg-plan--recommended' : 'lg-plan--default');
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setOrgPlan(p.id);
                          setOrgStep('contract');
                        }}
                        className={cls}
                      >
                        <div className="lg-plan-top">
                          <div className="lg-plan-name-row">
                            <span className="lg-plan-name">{p.name}</span>
                            {recommended && (
                              <span className="lg-plan-badge">
                                <i className="ph-fill ph-star" />
                                추천 요금제
                              </span>
                            )}
                          </div>
                          <span className="lg-plan-price">{p.price}</span>
                        </div>
                        <div className="lg-plan-meta">
                          <div>
                            학생 수 {p.students} · 관리자 계정 {p.admins}
                          </div>
                          <div>CAPTCHA API {p.quota}</div>
                          <div className="lg-plan-desc">{p.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <button type="button" onClick={() => setOrgStep('submitted')} className="lg-linkbtn">
                  ← 이전으로
                </button>
              </>
            )}

            {/* ============ ORG STEP 4 : CONTRACT CONFIRM ============ */}
            {orgContract && (
              <>
                <button type="button" onClick={() => setOrgStep('plans')} className="lg-back">
                  <i className="ph-bold ph-arrow-left" />
                  요금제 다시 선택
                </button>
                <h2 className="lg-h2--org">계약 신청 확인</h2>
                <p className="lg-org-sub">선택하신 요금제 내용을 확인하고 계약을 신청해 주세요.</p>

                <div className="lg-contract-card">
                  <div className="lg-contract-top">
                    <span className="lg-contract-name">{selDef.name}</span>
                    <span className="lg-contract-price">{selDef.price}</span>
                  </div>
                  <div className="lg-contract-rows">
                    <div className="lg-contract-row">
                      <span className="lg-contract-key">학생 수 범위</span>
                      <span className="lg-contract-val">{selDef.students}</span>
                    </div>
                    <div className="lg-contract-row">
                      <span className="lg-contract-key">포함 CAPTCHA API</span>
                      <span className="lg-contract-val">{selDef.quota}</span>
                    </div>
                    <div className="lg-contract-row">
                      <span className="lg-contract-key">관리자 계정</span>
                      <span className="lg-contract-val">{selDef.admins}</span>
                    </div>
                    <div className="lg-contract-row lg-contract-row--top">
                      <span className="lg-contract-key">초과 사용 시</span>
                      <span className="lg-contract-val">1,000회당 2,000원</span>
                    </div>
                  </div>
                </div>

                <label className="lg-label lg-label--mb9">계약 방식 선택</label>
                <div className="lg-cts">
                  {CONTRACT_TYPES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setContractType(c.id)}
                      className={'lg-ct' + (contractType === c.id ? ' lg-ct--active' : '')}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                <label className="lg-label">추가 요청사항</label>
                <textarea
                  rows={3}
                  placeholder="계약 관련 요청사항이 있다면 적어 주세요"
                  className="lg-textarea lg-mb18"
                />

                <button type="button" onClick={() => setOrgStep('done')} className="lg-primary">
                  <i className="ph-fill ph-file-text lg-primary-icon19" />
                  계약 신청하기
                </button>
              </>
            )}

            {/* ============ ORG STEP 5 : CONTRACT DONE ============ */}
            {orgDone && (
              <>
                <div className="lg-orgresult-head">
                  <div className="lg-orgresult-icon lg-orgresult-icon--green">
                    <i className="ph-fill ph-check-circle" />
                  </div>
                  <h2>
                    요금제 계약 신청이
                    <br />
                    완료되었습니다
                  </h2>
                  <p>
                    관리자가 계약 정보를 확인한 뒤 기관 관리자 계정을 발급합니다.
                    <br />
                    계정 발급 안내는 담당자 이메일로 발송됩니다.
                  </p>
                </div>

                <div className="lg-steps lg-steps--mb20">
                  <Stepper
                    labels={['기관 승인 완료', '요금제 선택 완료', '계약 검토 중', '기관 계정 발급']}
                    currentIdx={2}
                  />
                </div>

                <div className="lg-actions">
                  <button type="button" onClick={goLogin} className="lg-ghostbtn">
                    로그인으로 돌아가기
                  </button>
                  <Link to={PATHS.HOME} className="lg-mainlink">
                    메인으로 이동하기
                  </Link>
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
            <div className="lg-cap-mascot-wrap">
              <div className="lg-cap-mascot-float">
                <img src={mascot} alt="냥냥이" />
              </div>
            </div>

            <div className="lg-cap-card">
              <div className="lg-cap-head">
                <div className="lg-cap-chip">
                  <i className="ph-fill ph-cat" />
                  <span>냥이 지킴이</span>
                </div>
                <button type="button" onClick={() => setCaptcha(false)} className="lg-cap-close">
                  <i className="ph-bold ph-x" />
                </button>
                <div className="lg-cap-title">사람인지 확인해요 🐱</div>
                <div className="lg-cap-sub">냥이랑 잠깐 확인하고 이어가요</div>
              </div>

              <div className="lg-cap-body">
                <div className="lg-cap-why">
                  <span className="lg-cap-why-icon">
                    <i className="ph-fill ph-hand-waving" />
                  </span>
                  <span className="lg-cap-why-text">
                    평소와 조금 다른 접속이 보여서 한 번만 확인할게요. 사람이라면 아주 쉬워요! 🐾
                  </span>
                </div>

                <div className="lg-cap-prompt-row">
                  <span>숨은 동물을 찾아 같은 방향으로 돌려주세요 🧭</span>
                </div>

                {/* 메인 캡차(숲속 마을 동물 방향) — 통과 시 토큰이 자동 전달돼 로그인이 이어져요 */}
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

      {/* SIGNUP SUCCESS POPUP (student / parent / teacher) */}
      {signupDone && (
        <div className="lg-done-overlay">
          <div className="lg-done">
            <div className="lg-done-mascot-wrap">
              <div className="lg-done-mascot-pop">
                <div className="lg-done-mascot">
                  <img src={mascot} alt="냥냥이" />
                  <span className="lg-done-check">
                    <i className="ph-bold ph-check" />
                  </span>
                </div>
              </div>
            </div>

            <div className="lg-done-card">
              <span className="lg-conf1" />
              <span className="lg-conf2" />
              <span className="lg-conf3" />
              <span className="lg-conf4" />

              <h3>가입이 완료됐어요! 🎉</h3>
              <p className="lg-done-name">
                {role === 'parent'
                  ? '학부모님, 환영해요!'
                  : isTeacher
                    ? '선생님, 환영해요!'
                    : '반가워요, 새 친구!'}
              </p>
              <p className="lg-done-msg">
                {role === 'parent'
                  ? '회원가입이 완료됐어요. 로그인 후 자녀 계정과 연결하면 학습 현황을 확인할 수 있어요.'
                  : isTeacher
                    ? '선생님 가입이 완료됐어요. 로그인하면 담당 학급과 학생들의 학습 현황을 관리할 수 있어요.'
                    : '회원가입이 완료됐어요. 이제 로그인해서 냥이와 함께 학습을 시작해요!'}
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
