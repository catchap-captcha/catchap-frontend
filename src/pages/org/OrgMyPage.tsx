import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { orgApi } from '../../api/org';
import { settingsApi } from '../../api/settings';
import { inquiryApi } from '../../api/misc';
import OrgLayout from '../../layouts/OrgLayout';
import './OrgMyPage.css';
import PasswordInput from '../../components/common/PasswordInput';

/** handoff `CatChap 기관 마이페이지.dc.html` 포팅 — 기관 정보/요금제/결제/관리자/보안 */

type OmTab = 'info' | 'plan' | 'payment' | 'invoice' | 'admins' | 'security';
type Cycle = 'month' | 'year';
type Tier = 'Basic' | 'Pro' | 'Enterprise';

const TABS: { key: OmTab; label: string; icon: string }[] = [
  { key: 'info', label: '기관 정보', icon: 'ph-fill ph-buildings' },
  { key: 'plan', label: '요금제', icon: 'ph-fill ph-crown-simple' },
  { key: 'payment', label: '결제 수단', icon: 'ph-fill ph-credit-card' },
  { key: 'invoice', label: '결제 내역', icon: 'ph-fill ph-receipt' },
  { key: 'admins', label: '관리자 계정', icon: 'ph-fill ph-user-gear' },
  { key: 'security', label: '로그인·보안', icon: 'ph-fill ph-lock-key' },
];

const SEATS: Record<Tier, number> = { Basic: 100, Pro: 300, Enterprise: 1000 };
const SEATLABEL: Record<Tier, string> = { Basic: '100석', Pro: '300석', Enterprise: '1,000석' };
const RANK: Record<Tier, number> = { Basic: 1, Pro: 2, Enterprise: 3 };
const PRICES: Record<Tier, Record<Cycle, string>> = {
  Basic: { month: '99,000원', year: '950,000원' },
  Pro: { month: '290,000원', year: '2,784,000원' },
  Enterprise: { month: '별도 협의', year: '별도 협의' },
};
const COMMON_FEATS = ['CAPTCHA API 전체 기능', '연령별 대시보드', '상담 AI', '학습 리포트'];
const TIERS: { key: Tier; name: string; feats: string[] }[] = [
  { key: 'Basic', name: 'Basic', feats: ['학생 최대 100석', ...COMMON_FEATS] },
  { key: 'Pro', name: 'Pro', feats: ['학생 최대 300석', ...COMMON_FEATS] },
  { key: 'Enterprise', name: 'Enterprise', feats: ['학생 최대 1,000석', ...COMMON_FEATS] },
];

interface OmCard {
  name: string;
  exp: string;
  primary: boolean;
}

interface OmInvoice {
  date: string;
  item: string;
  amount: string;
  status: string;
}

interface OmAdmin {
  name: string;
  email: string;
  initial: string;
  avatarBg: string;
  role: string;
  roleBg: string;
  roleColor: string;
}

// TODO(api): orgApi.billing 실패 시 원본 하드코딩 결제수단/결제내역 유지
const FALLBACK_CARDS: OmCard[] = [
  { name: '신한 법인카드 ···· 4821', exp: '2027 / 08', primary: true },
  { name: '국민 법인카드 ···· 7702', exp: '2026 / 11', primary: false },
];

const ADMIN_ROLE_STYLE: Record<string, { bg: string; color: string }> = {
  '최고 관리자': { bg: '#FFF0EE', color: '#B5453B' },
  '결제 관리자': { bg: '#EDE9FF', color: '#6A55C0' },
  '조회 전용': { bg: '#E6F0FF', color: '#2168D8' },
};

const ADMIN_PALETTE = [
  'linear-gradient(135deg,#FFC24B,#FF8A5B)',
  'linear-gradient(135deg,#8B6BFF,#B08AFF)',
  'linear-gradient(135deg,#4AA6FF,#2E7BFF)',
];

/* eslint-disable @typescript-eslint/no-explicit-any */
function won(n: number) {
  return `${n.toLocaleString('ko-KR')}원`;
}

interface OmPlanData {
  prices: Record<Tier, Record<Cycle, string>>;
  seats: Record<Tier, number>;
  seatLabels: Record<Tier, string>;
  tiers: { key: Tier; name: string; feats: string[] }[];
}

/** billing.plans (monthly_price/yearly_price 숫자, student_seats, features) → 요금제 비교 카드 */
function mapBillingPlans(plans: any): OmPlanData | null {
  if (!Array.isArray(plans) || plans.length === 0) return null;
  const prices: OmPlanData['prices'] = { ...PRICES };
  const seats: OmPlanData['seats'] = { ...SEATS };
  const seatLabels: OmPlanData['seatLabels'] = { ...SEATLABEL };
  const tiers = TIERS.map((t) => ({ ...t, feats: [...t.feats] }));
  let hit = false;
  for (const p of plans) {
    const key = p?.key as Tier;
    if (!key || !RANK[key]) continue;
    hit = true;
    prices[key] = {
      month: typeof p.monthly_price === 'number' && p.monthly_price > 0 ? won(p.monthly_price) : '별도 협의',
      year: typeof p.yearly_price === 'number' && p.yearly_price > 0 ? won(p.yearly_price) : '별도 협의',
    };
    if (typeof p.student_seats === 'number') {
      seats[key] = p.student_seats;
      seatLabels[key] = `${p.student_seats.toLocaleString('ko-KR')}석`;
    }
    const idx = tiers.findIndex((t) => t.key === key);
    const feats: string[] =
      Array.isArray(p.features) && p.features.length > 0 ? p.features.map(String) : (tiers[idx]?.feats ?? []);
    const tier = { key, name: String(p.name ?? key), feats };
    if (idx >= 0) tiers[idx] = tier;
    else tiers.push(tier);
  }
  return hit ? { prices, seats, seatLabels, tiers } : null;
}

/** billing.payment_methods (card_brand/card_last4/is_default) → 결제 수단 목록 (만료일은 API 미제공 → 폴백 유지) */
function mapCards(list: any): OmCard[] | null {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list.map((c: any, i: number): OmCard => ({
    name: c.name ?? (c.card_brand ? `${c.card_brand} ···· ${c.card_last4 ?? ''}` : ''),
    exp: c.exp ?? FALLBACK_CARDS[i]?.exp ?? '',
    primary: !!(c.primary ?? c.is_default),
  }));
}

/** billing.invoices (amount 숫자, status 'paid'→'결제완료') → 결제 내역 ("290,000원" 문자열) */
function mapInvoices(list: any): OmInvoice[] | null {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list.map((v: any): OmInvoice => ({
    date: String(v.date ?? ''),
    item: String(v.item ?? ''),
    amount: typeof v.amount === 'number' ? won(v.amount) : String(v.amount ?? ''),
    status: v.status == null || v.status === 'paid' ? '결제완료' : String(v.status),
  }));
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function OrgMyPage() {
  const { me, logout, reloadMe } = useAuth();
  const navigate = useNavigate();
  const orgId = me?.organization_id ?? null;
  const { toast, flash } = useToast();

  const [tab, setTab] = useState<OmTab>('info');
  const [org, setOrg] = useState(() => ({
    name: me?.organization_name ?? '',
    type: '',
    admin: me?.name ?? '',
    phone: '',
    email: me?.email ?? '',
    addr: '',
  }));
  const [orgCode, setOrgCode] = useState('');
  const [codeRemainDays, setCodeRemainDays] = useState<number | null>(null);
  const [bizNo, setBizNo] = useState('');
  const [taxEmail, setTaxEmail] = useState('');
  const [cycle, setCycle] = useState<Cycle>('month');
  const [plan, setPlan] = useState<{ tier: Tier; cycle: Cycle }>({ tier: 'Pro', cycle: 'month' });
  const [students, setStudents] = useState(0);
  const [prices, setPrices] = useState<OmPlanData['prices']>(PRICES);
  const [seats, setSeats] = useState<OmPlanData['seats']>(SEATS);
  const [seatLabels, setSeatLabels] = useState<OmPlanData['seatLabels']>(SEATLABEL);
  const [tiers, setTiers] = useState<OmPlanData['tiers']>(TIERS);
  const [nextBilling, setNextBilling] = useState('');
  const [apiUsage, setApiUsage] = useState({ label: 'CAPTCHA API 호출', used: 0, quota: 0 });
  const [teacherSeats, setTeacherSeats] = useState({ used: 0, quota: 0 });
  const [cards, setCards] = useState<OmCard[]>([]);
  const [invoices, setInvoices] = useState<OmInvoice[]>([]);
  const [admins, setAdmins] = useState<OmAdmin[]>([]);
  const [payState, setPayState] = useState<{ tier: Tier; cycle: Cycle } | null>(null);
  const [payBusy, setPayBusy] = useState(false);
  const [warnText, setWarnText] = useState<string | null>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [autopay, setAutopay] = useState(true);
  const [twofa, setTwofa] = useState(true);
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  useEffect(() => {
    if (!orgId) return;
    let on = true;
    orgApi
      .me()
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      .then((res: any) => {
        if (!on || !res || typeof res !== 'object') return;
        setOrg((o) => ({
          name: res.name ?? o.name,
          type: res.type ?? res.org_type ?? o.type,
          admin: res.admin ?? res.contact_name ?? o.admin,
          phone: res.phone ?? res.contact_phone ?? o.phone,
          email: res.email ?? res.contact_email ?? o.email,
          addr: res.addr ?? res.address ?? o.addr,
        }));
        if (res.org_code ?? res.code) setOrgCode(res.org_code ?? res.code);
        if (res.biz_no ?? res.business_number) setBizNo(res.biz_no ?? res.business_number);
        if (res.tax_email) setTaxEmail(res.tax_email);
        if (typeof res.code_remain_days === 'number') setCodeRemainDays(res.code_remain_days);
      })
      .catch(() => {
        // TODO(api): 실패 시 FALLBACK_ORG 유지
      });
    orgApi
      .billing(orgId)
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      .then((res: any) => {
        if (!on || !res || typeof res !== 'object') return;
        // API 응답 형태: { plans, subscription, usage, payment_methods, invoices }
        const sub = res.subscription ?? res.plan;
        const tier = (sub?.plan_key ?? sub?.tier) as Tier | undefined;
        if (tier && RANK[tier]) {
          const rawCycle = sub?.billing_cycle ?? sub?.cycle;
          const c: Cycle = rawCycle === 'yearly' || rawCycle === 'year' ? 'year' : 'month';
          setPlan({ tier, cycle: c });
          setCycle(c);
        }
        if (typeof sub?.auto_renew === 'boolean') setAutopay(sub.auto_renew);
        if (typeof sub?.next_billing_date === 'string' && sub.next_billing_date) setNextBilling(sub.next_billing_date);
        const planData = mapBillingPlans(res.plans);
        if (planData) {
          setPrices(planData.prices);
          setSeats(planData.seats);
          setSeatLabels(planData.seatLabels);
          setTiers(planData.tiers);
        }
        const seatUsed = res.usage?.student_seats?.used ?? res.students;
        if (typeof seatUsed === 'number') setStudents(seatUsed);
        const apiU = res.usage?.api;
        if (apiU && typeof apiU.used === 'number' && typeof apiU.quota === 'number') {
          setApiUsage({ label: apiU.label ?? 'CAPTCHA API 호출', used: apiU.used, quota: apiU.quota });
        }
        const tSeats = res.usage?.teacher_seats;
        if (tSeats && typeof tSeats.used === 'number' && typeof tSeats.quota === 'number') {
          setTeacherSeats({ used: tSeats.used, quota: tSeats.quota });
        }
        const cardList = mapCards(res.payment_methods ?? res.cards);
        if (cardList) setCards(cardList);
        const invoiceList = mapInvoices(res.invoices);
        if (invoiceList) setInvoices(invoiceList);
      })
      .catch(() => {
        // TODO(api): 실패 시 FALLBACK 유지
      });
    orgApi
      .admins(orgId)
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      .then((res: any) => {
        const list = Array.isArray(res) ? res : res?.admins;
        if (!on || !Array.isArray(list)) return;
        setAdmins(
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          list.map((a: any, i: number): OmAdmin => {
            const role = a.role ?? '조회 전용';
            const rs = ADMIN_ROLE_STYLE[role] ?? ADMIN_ROLE_STYLE['조회 전용'];
            return {
              name: a.name ?? '',
              email: a.email ?? '',
              initial: a.initial ?? [...String(a.name ?? '')][0] ?? '',
              avatarBg: a.avatarBg ?? ADMIN_PALETTE[i % ADMIN_PALETTE.length],
              role,
              roleBg: rs.bg,
              roleColor: rs.color,
            };
          }),
        );
      })
      .catch(() => {
        // TODO(api): 실패 시 FALLBACK_ADMINS 유지
      });
    return () => {
      on = false;
    };
  }, [orgId]);

  const openWarn = (tierName: string, seats: number) => {
    setWarnText(
      `현재 등록 학생 ${students}명이 ${tierName} 요금제 최대 ${seats}석을 초과해요. 학생을 정리한 뒤 다시 시도해 주세요.`,
    );
  };

  // 결제 백엔드가 아직 없어 요금제를 실제로 바꾸지 않는다(바뀐 척 위장 금지).
  // 대신 '요금제 변경 문의'로 접수해 담당 매니저가 처리하도록 연결한다.
  const confirmPay = () => {
    if (!payState || payBusy) return;
    const { tier, cycle: payCycle } = payState;
    const cycleLabel = payCycle === 'year' ? '연 결제' : '월 결제';
    setPayBusy(true);
    inquiryApi
      .submit({
        inquiry_type: '계약·요금제 변경',
        name: me?.name ?? '기관 관리자',
        affiliation: org.name,
        email: me?.email ?? 'unknown@catchap.io',
        content: `요금제 변경을 요청합니다. 요청 요금제: ${tier}(${cycleLabel}). 현재 요금제: ${plan.tier}. 등록 학생 ${students}명.`,
      })
      .then(() => {
        setPayState(null);
        flash(`${tier} 요금제 변경 문의를 접수했어요. 담당 매니저가 이메일로 안내드려요.`);
      })
      .catch(() => flash('문의 접수에 실패했어요. 잠시 후 다시 시도해 주세요.'))
      .finally(() => setPayBusy(false));
  };

  const saveOrg = () => {
    if (!orgId) {
      flash('기관 정보를 저장할 수 없어요. 다시 로그인한 뒤 시도해 주세요.');
      return;
    }
    // 백엔드 OrgUpdate 필드명(org_type/contact_*/address)으로 전송 — organizations 실테이블 UPDATE
    orgApi
      .update(orgId, {
        name: org.name,
        org_type: org.type,
        contact_phone: org.phone,
        contact_email: org.email,
        address: org.addr,
      })
      .then(() => {
        // 기관명 변경 시 상단(me.organization_name) 즉시 갱신
        reloadMe();
        flash('기관 정보가 저장됐어요');
      })
      .catch(() => flash('기관 정보 저장에 실패했어요. 잠시 후 다시 시도해 주세요.'));
  };

  const saveTax = () => {
    if (!orgId) {
      flash('세금계산서 정보를 저장할 수 없어요. 다시 로그인한 뒤 시도해 주세요.');
      return;
    }
    orgApi
      .update(orgId, { business_number: bizNo })
      .then(() => flash('세금계산서 정보가 저장됐어요'))
      .catch(() => flash('세금계산서 정보 저장에 실패했어요. 잠시 후 다시 시도해 주세요.'));
  };

  const canChange =
    !!curPw && newPw.length >= 8 && /[a-zA-Z]/.test(newPw) && /[0-9]/.test(newPw) && newPw !== curPw && newPw === confirmPw;

  const changePw = () => {
    if (!canChange) {
      flash('비밀번호 조건을 확인해 주세요');
      return;
    }
    settingsApi
      .changePassword(curPw, newPw)
      .then(() => {
        setCurPw('');
        setNewPw('');
        setConfirmPw('');
        flash('비밀번호가 변경됐어요');
      })
      .catch(() => {
        flash('비밀번호 조건을 확인해 주세요');
      });
  };

  const confirmLogout = async () => {
    await logout();
    navigate('/');
  };

  const yearly = cycle === 'year';
  const cycleUnit = yearly ? '년' : '월';
  const seatMax = seats[plan.tier];
  const seatPct = Math.min(100, Math.round((students / seatMax) * 1000) / 10);

  const apiPct = apiUsage.quota > 0 ? Math.min(100, Math.round((apiUsage.used / apiUsage.quota) * 100)) : 0;
  const teacherPct =
    teacherSeats.quota > 0 ? Math.min(100, Math.round((teacherSeats.used / teacherSeats.quota) * 100)) : 0;

  const usage = [
    {
      label: apiUsage.label,
      value: `${apiPct}% · ${apiUsage.used.toLocaleString('ko-KR')} / ${apiUsage.quota.toLocaleString('ko-KR')}`,
      w: `${apiPct}%`,
      color: '#FF5A4D',
    },
    { label: '학생 좌석', value: `${students} / ${seatMax}석`, w: `${seatPct}%`, color: '#2E7BFF' },
    { label: '선생님 좌석', value: `${teacherSeats.used} / ${teacherSeats.quota}석`, w: `${teacherPct}%`, color: '#8B6BFF' },
  ];

  const payAmount = payState ? prices[payState.tier][payState.cycle] : '';
  const payCycleLabel = payState?.cycle === 'year' ? '연 결제' : '월 결제';

  // /orgs/me 가 code_remain_days 를 주면 그 값, 없으면 0 (가짜 만료일 계산 금지)
  const codeRemain = codeRemainDays ?? 0;

  return (
    <OrgLayout active={null} widget="pro" profileHighlight orgNameOverride={org.name}>
      {/* HEADER */}
      <div className="om-header">
        <h1 className="om-title">기관 마이페이지</h1>
        <p className="om-subtitle">기관 정보·요금제·결제 수단을 한 곳에서 관리해요</p>
      </div>

      {/* TAB BAR */}
      <div className="om-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'om-tab om-tabOn' : 'om-tab'} onClick={() => setTab(t.key)}>
            <i className={t.icon} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="om-body">
        {/* ORG INFO */}
        {tab === 'info' && (
          <div className="om-card om-cardPad26 om-mb16">
            <div className="om-orgHead">
              <div className="om-orgAvatar">
                <i className="ph-fill ph-buildings" />
              </div>
              <div>
                <div className="om-orgName">{org.name}</div>
                <div className="om-orgBadge">
                  <i className="ph-fill ph-seal-check" />인증 기관 · {org.type}
                </div>
              </div>
            </div>
            <div className="om-formGrid">
              <div className="om-colSpan">
                <label className="om-label">기관 코드</label>
                <div className="om-codeBox">
                  <i className="ph-fill ph-buildings" />
                  <span className="om-codeValue">{orgCode}</span>
                  <span className="om-codeRemain">
                    <i className="ph-fill ph-clock-countdown" />유효기간 6개월 · 남은 {codeRemain}일
                  </span>
                  <span className="om-codeHint">학생이 회원가입 시 입력하는 코드예요</span>
                  <span className="om-codeVerified">
                    <i className="ph-fill ph-seal-check" />기관 인증됨
                  </span>
                </div>
              </div>
              <div>
                <label className="om-label">기관명</label>
                <input className="om-input" value={org.name} onChange={(e) => setOrg((o) => ({ ...o, name: e.target.value }))} />
              </div>
              <div>
                <label className="om-label">기관 유형</label>
                <input className="om-input" value={org.type} onChange={(e) => setOrg((o) => ({ ...o, type: e.target.value }))} />
              </div>
              <div>
                <label className="om-label">대표 관리자</label>
                <input className="om-input" value={org.admin} onChange={(e) => setOrg((o) => ({ ...o, admin: e.target.value }))} />
              </div>
              <div>
                <label className="om-label">담당자 연락처</label>
                <input className="om-input" value={org.phone} onChange={(e) => setOrg((o) => ({ ...o, phone: e.target.value }))} />
              </div>
              <div className="om-colSpan">
                <label className="om-label">기관 이메일</label>
                <input className="om-input" value={org.email} onChange={(e) => setOrg((o) => ({ ...o, email: e.target.value }))} />
              </div>
              <div className="om-colSpan">
                <label className="om-label">주소</label>
                <input className="om-input" value={org.addr} onChange={(e) => setOrg((o) => ({ ...o, addr: e.target.value }))} />
              </div>
            </div>
            <div className="om-formFoot">
              <button className="om-saveOrgBtn" onClick={saveOrg}>
                <i className="ph-fill ph-check-circle" />기관 정보 저장
              </button>
            </div>
          </div>
        )}

        {/* PLAN */}
        {tab === 'plan' && (
          <>
            <div className="om-planHero">
              <div className="om-planHeroCircle" />
              <div className="om-planHeroBody">
                <div className="om-planBadge">
                  <i className="ph-fill ph-crown-simple" />
                  {plan.tier} 요금제 이용 중
                </div>
                <div className="om-planPrice">
                  {prices[plan.tier][plan.cycle]} <span className="om-planUnit">/ {plan.cycle === 'year' ? '년' : '월'}</span>
                </div>
                <div className="om-planSub">
                  다음 결제일 {nextBilling} · 학생 {seatLabels[plan.tier]} · 등록 {students}명
                </div>
                <div className="om-planHeroBtns">
                  <button className="om-planChangeBtn" onClick={() => flash('청구 관리 페이지로 이동해요')}>플랜 변경</button>
                  <button className="om-planBillBtn" onClick={() => flash('청구 관리 페이지로 이동해요')}>청구서 관리</button>
                </div>
              </div>
            </div>

            {/* usage */}
            <div className="om-card om-mb16">
              <div className="om-usageTitle">이번 달 사용량</div>
              <div className="om-usageList">
                {usage.map((u) => (
                  <div key={u.label}>
                    <div className="om-usageHead">
                      <span>{u.label}</span>
                      <span style={{ color: u.color }}>{u.value}</span>
                    </div>
                    <div className="om-usageTrack">
                      <div className="om-usageFill" style={{ width: u.w, background: u.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* tiers */}
            <div className="om-tiersHead">
              <div className="om-cardTitle">요금제 비교</div>
              <div className="om-cycleBox">
                <button className={!yearly ? 'om-cycleBtn om-cycleBtnOn' : 'om-cycleBtn'} onClick={() => setCycle('month')}>
                  월 결제
                </button>
                <button className={yearly ? 'om-cycleBtn om-cycleBtnOn' : 'om-cycleBtn'} onClick={() => setCycle('year')}>
                  연 결제 -20%
                </button>
              </div>
            </div>
            <div className="om-tierGrid">
              {tiers.map((t) => {
                const isCurrent = t.key === plan.tier && cycle === plan.cycle;
                const overCapacity = seats[t.key] < students;
                let btnLabel: string;
                let onPick: () => void;
                if (isCurrent) {
                  btnLabel = '현재 요금제';
                  onPick = () => {};
                } else if (t.key === 'Enterprise') {
                  btnLabel = '문의하기';
                  onPick = () => flash('도입 문의를 접수했어요');
                } else if (overCapacity) {
                  btnLabel = '다운그레이드';
                  onPick = () => openWarn(t.name, seats[t.key]);
                } else if (RANK[t.key] > RANK[plan.tier]) {
                  btnLabel = '업그레이드';
                  onPick = () => setPayState({ tier: t.key, cycle });
                } else if (t.key === plan.tier) {
                  btnLabel = '연 결제로 전환';
                  onPick = () => setPayState({ tier: t.key, cycle });
                } else {
                  btnLabel = '요금제 변경';
                  onPick = () => setPayState({ tier: t.key, cycle });
                }
                const disabled = isCurrent;
                const blocked = overCapacity && !isCurrent && t.key !== 'Enterprise';
                return (
                  <div className={isCurrent ? 'om-tierCard om-tierCardCurrent' : 'om-tierCard'} key={t.key}>
                    {isCurrent && <span className="om-tierCurrentBadge">이용 중</span>}
                    <div className="om-tierName">{t.name}</div>
                    <div className="om-tierPrice">
                      {prices[t.key][cycle]}
                      <span className="om-tierPriceUnit"> / {cycleUnit}</span>
                    </div>
                    <div className="om-tierFeats">
                      {t.feats.map((f) => (
                        <div className="om-tierFeat" key={f}>
                          <i className="ph-fill ph-check-circle" />
                          {f}
                        </div>
                      ))}
                    </div>
                    <button
                      className={
                        disabled ? 'om-tierBtn om-tierBtnDisabled' : blocked ? 'om-tierBtn om-tierBtnBlocked' : 'om-tierBtn'
                      }
                      onClick={onPick}
                    >
                      {btnLabel}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* PAYMENT METHODS */}
        {tab === 'payment' && (
          <>
            <div className="om-card om-mb16">
              <div className="om-payHead">
                <div className="om-cardTitle">결제 수단</div>
                <button className="om-addCardBtn" onClick={() => flash('카드 등록 창을 열었어요')}>
                  <i className="ph-bold ph-plus" />카드 추가
                </button>
              </div>
              <div className="om-cardList">
                {cards.length === 0 && (
                  <div style={{ padding: '20px 4px', color: '#9AA0B0', fontSize: 14 }}>
                    등록된 결제 수단이 없어요. ‘카드 추가’로 등록해 주세요.
                  </div>
                )}
                {cards.map((c) => (
                  <div className="om-payRow" key={c.name}>
                    <span className="om-cardChip">
                      <i className="ph-fill ph-credit-card" />
                    </span>
                    <div className="om-payBody">
                      <div className="om-payNameRow">
                        <span className="om-payName">{c.name}</span>
                        {c.primary && <span className="om-primaryBadge">기본</span>}
                      </div>
                      <div className="om-payExp">{c.exp} 만료</div>
                    </div>
                    <button className="om-manageBtn" onClick={() => flash('카드 관리 창을 열었어요')}>관리</button>
                  </div>
                ))}
              </div>
              <div className="om-payRow om-payRowMt">
                <span className="om-autopayIcon">
                  <i className="ph-fill ph-arrows-clockwise" />
                </span>
                <div className="om-payBody">
                  <div className="om-payName">자동 결제</div>
                  <div className="om-payExp">매월 결제일에 기본 카드로 자동 청구해요</div>
                </div>
                <button
                  className={autopay ? 'om-switch om-switchOn' : 'om-switch'}
                  onClick={() => setAutopay((a) => !a)}
                >
                  <span className="om-switchDot" />
                </button>
              </div>
            </div>

            {/* tax invoice */}
            <div className="om-card">
              <div className="om-taxTitle">세금계산서 정보</div>
              <p className="om-taxSub">결제 후 등록된 정보로 세금계산서를 자동 발행해요.</p>
              <div className="om-formGrid">
                <div>
                  <label className="om-label">사업자 등록번호</label>
                  <input className="om-input" value={bizNo} onChange={(e) => setBizNo(e.target.value)} />
                </div>
                <div>
                  <label className="om-label">계산서 담당자 이메일</label>
                  <input className="om-input" value={taxEmail} onChange={(e) => setTaxEmail(e.target.value)} />
                </div>
              </div>
              <div className="om-taxFoot">
                <button className="om-taxSaveBtn" onClick={saveTax}>저장</button>
              </div>
            </div>
          </>
        )}

        {/* INVOICES */}
        {tab === 'invoice' && (
          <div className="om-card">
            <div className="om-invoiceTitle">결제 내역</div>
            <div className="om-invoiceHead">
              <span>결제일</span>
              <span>항목</span>
              <span>금액</span>
              <span>상태</span>
              <span className="om-invoiceHeadRight">증빙</span>
            </div>
            {invoices.length === 0 && (
              <div style={{ padding: '20px 4px', color: '#9AA0B0', fontSize: 14 }}>아직 결제 내역이 없어요.</div>
            )}
            {invoices.map((v) => (
              <div className="om-invoiceRow" key={`${v.date}-${v.item}`}>
                <span className="om-invoiceDate">{v.date}</span>
                <span className="om-invoiceItem">{v.item}</span>
                <span className="om-invoiceAmount">{v.amount}</span>
                <span>
                  <span className="om-invoiceStatus">
                    <i className="ph-fill ph-check-circle" />{v.status}
                  </span>
                </span>
                <span className="om-invoiceBtns">
                  <button className="om-invoiceBtn" onClick={() => flash('영수증을 내려받았어요')}>영수증</button>
                  <button className="om-invoiceBtn" onClick={() => flash('세금계산서를 발송했어요')}>계산서</button>
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ADMINS */}
        {tab === 'admins' && (
          <div className="om-card">
            <div className="om-adminsHead">
              <div>
                <div className="om-cardTitle">관리자 계정</div>
                <p className="om-adminsSub">역할에 따라 접근 권한이 달라요.</p>
              </div>
              <button className="om-inviteBtn" onClick={() => flash('관리자 초대 메일을 보냈어요')}>
                <i className="ph-bold ph-plus" />관리자 초대
              </button>
            </div>
            <div className="om-adminList">
              {admins.length === 0 && (
                <div style={{ padding: '20px 4px', color: '#9AA0B0', fontSize: 14 }}>등록된 관리자가 없어요.</div>
              )}
              {admins.map((a) => (
                <div className="om-payRow" key={a.email}>
                  <span className="om-adminAvatar" style={{ background: a.avatarBg }}>{a.initial}</span>
                  <div className="om-payBody">
                    <div className="om-adminName">{a.name}</div>
                    <div className="om-adminEmail">{a.email}</div>
                  </div>
                  <span className="om-roleBadge" style={{ background: a.roleBg, color: a.roleColor }}>{a.role}</span>
                  <button className="om-permBtn" onClick={() => flash(`${a.name}님의 권한 설정을 열었어요`)}>권한</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECURITY */}
        {tab === 'security' && (
          <>
            <div className="om-card om-cardPad26 om-mb16">
              <div className="om-secTitle">비밀번호 변경</div>
              <p className="om-secSub">관리자 계정을 안전하게 지키려면 주기적으로 변경하세요.</p>
              <div className="om-pwFields">
                <div>
                  <label className="om-label">현재 비밀번호</label>
                  <PasswordInput className="om-input" value={curPw} onChange={(e) => setCurPw(e.target.value)} />
                </div>
                <div>
                  <label className="om-label">새 비밀번호</label>
                  <PasswordInput
                    className="om-input"
                    placeholder="8자 이상, 숫자와 문자 포함"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                  />
                </div>
                <div>
                  <label className="om-label">새 비밀번호 확인</label>
                  <PasswordInput className="om-input" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
                </div>
              </div>
              <div className="om-pwFoot">
                <button className={canChange ? 'om-pwBtn' : 'om-pwBtn om-pwBtnOff'} onClick={changePw}>
                  <i className="ph-fill ph-lock-key" />비밀번호 변경
                </button>
              </div>
            </div>
            <div className="om-card">
              <div className="om-secListTitle">로그인 보안</div>
              <div className="om-secRow om-secRowMb">
                <span className="om-secIcon om-secIcon2fa">
                  <i className="ph-fill ph-shield-check" />
                </span>
                <div className="om-payBody">
                  <div className="om-secRowTitle">2단계 인증 (관리자 필수)</div>
                  <div className="om-secRowSub">로그인 시 인증 코드를 한 번 더 확인해요.</div>
                </div>
                <button className={twofa ? 'om-switch om-switchOn' : 'om-switch'} onClick={() => setTwofa((t) => !t)}>
                  <span className="om-switchDot" />
                </button>
              </div>
              <div className="om-secRow">
                <span className="om-secIcon om-secIconDevices">
                  <i className="ph-fill ph-devices" />
                </span>
                <div className="om-payBody">
                  <div className="om-secRowTitle">로그인된 기기</div>
                  <div className="om-secRowSub">이 기기 · 서울 · 방금 활동</div>
                </div>
                <button className="om-logoutAllBtn" onClick={() => setLogoutOpen(true)}>모두 로그아웃</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* DOWNGRADE WARNING */}
      {warnText && (
        <div className="om-overlay" onClick={() => setWarnText(null)}>
          <div className="om-warnModal" onClick={(e) => e.stopPropagation()}>
            <div className="om-warnIcon">
              <i className="ph-fill ph-warning" />
            </div>
            <h2 className="om-warnTitle">학생 수를 초과했어요</h2>
            <p className="om-warnText">{warnText}</p>
            <button className="om-warnOkBtn" onClick={() => setWarnText(null)}>확인</button>
          </div>
        </div>
      )}

      {/* 요금제 변경 문의 모달 (결제 연동 준비 중 — 실제 결제/변경은 문의로 접수) */}
      {payState && (
        <div className="om-overlay" onClick={() => setPayState(null)}>
          <div className="om-payModal" onClick={(e) => e.stopPropagation()}>
            <div className="om-payModalHead">
              <div className="om-payModalHeadIcon">
                <i className="ph-fill ph-chat-circle-text" />
              </div>
              <div className="om-payModalHeadText">
                <div className="om-payModalTitle">요금제 변경 문의</div>
                <div className="om-payModalSub">결제 연동은 준비 중이에요 · 문의로 접수돼요</div>
              </div>
            </div>
            <div className="om-payModalBody">
              <div className="om-payInfo">
                <div className="om-payInfoRow">
                  <span className="om-payInfoKey">요금제</span>
                  <span className="om-payInfoVal">{payState.tier} · {payCycleLabel}</span>
                </div>
                <div className="om-payInfoRow">
                  <span className="om-payInfoKey">학생 좌석</span>
                  <span className="om-payInfoVal">최대 {seatLabels[payState.tier]}</span>
                </div>
                <div className="om-payInfoTotal">
                  <span className="om-payInfoKey">예상 금액</span>
                  <span className="om-payAmount">{payAmount}</span>
                </div>
              </div>
              <div className="om-paySecure">
                <i className="ph-fill ph-info" />
                <span>온라인 결제는 준비 중이에요. 변경 요청을 접수하면 담당 매니저가 이메일로 안내드려요.</span>
              </div>
              <div className="om-payBtns">
                <button className="om-payCancelBtn" onClick={() => setPayState(null)} disabled={payBusy}>취소</button>
                <button className="om-payConfirmBtn" onClick={confirmPay} disabled={payBusy}>
                  <i className="ph-fill ph-paper-plane-tilt" />
                  {payBusy ? '접수 중…' : '변경 문의 보내기'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LOGOUT CONFIRM */}
      {logoutOpen && (
        <div className="om-overlay" onClick={() => setLogoutOpen(false)}>
          <div className="om-warnModal" onClick={(e) => e.stopPropagation()}>
            <div className="om-warnIcon">
              <i className="ph-fill ph-sign-out" />
            </div>
            <h2 className="om-warnTitle">모든 기기에서 로그아웃할까요?</h2>
            <p className="om-warnText">로그인된 모든 기기에서 로그아웃되며, 다시 로그인해야 기관 콘솔을 이용할 수 있어요.</p>
            <div className="om-logoutBtns">
              <button className="om-logoutCancelBtn" onClick={() => setLogoutOpen(false)}>취소</button>
              <button className="om-logoutConfirmBtn" onClick={confirmLogout}>확인</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className="om-toast">
          <i className="ph-fill ph-check-circle" />
          <span>{toast}</span>
        </div>
      )}
    </OrgLayout>
  );
}
