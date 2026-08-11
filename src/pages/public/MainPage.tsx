import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { useRevealOnScroll } from '../../hooks/useRevealOnScroll';
import { useCtaAutoReveal } from '../../hooks/useCtaAutoReveal';
import wordmarkDark from '../../assets/brand/catchap-wordmark.png';
import wordmarkWhite from '../../assets/brand/catchap-wordmark-white.png';
import './MainPage.css';

/** CatChap 랜딩 — handoff `CatChap 랜딩.dc.html` 구조 그대로 재구성.
 *  섹션 앵커(#about 등)는 기존 라우팅을 유지하기 위해 그대로 둔다. */

const ABOUT_ITEMS = [
  { icon: 'ph-monitor-play', title: '시청 검증 게이트', desc: '재생 중 무작위 시점에 확인 문제가 나옵니다.' },
  { icon: 'ph-chart-line-up', title: '행동 데이터 분석', desc: '풀이 속도·재시도로 이해와 습관을 파악합니다.' },
  { icon: 'ph-shield-check', title: '안전한 데이터 보호', desc: '가명·최소 수집으로 학습자 정보를 지킵니다.' },
];

// 랜딩 쇼케이스 — 이 플랫폼을 실제로 움직이는 AI 능력(과목 섹션 안에서 자랑).
// 문구는 실제 파이프라인 그대로: 음성→자막(STT) → LLM 문항 생성 → 2차 AI 봇저항 검증 → 추천.
const AI_FEATURES = [
  { icon: 'ph-magic-wand', title: 'AI 확인 문항 생성', desc: '대규모 언어모델(LLM)이 강의 내용을 읽고, 그 장면을 실제로 봐야만 풀 수 있는 확인 문항을 자동으로 만듭니다.' },
  { icon: 'ph-waveform', title: '음성 → 자막 자동 변환', desc: '강의 음성을 인식(STT)해 자막으로 옮기고, 그 자막을 근거로 문항을 출제해 정확도를 높입니다.' },
  { icon: 'ph-robot', title: '봇 저항 자기검증', desc: '2차 AI가 “안 보고도 상식으로 풀리는지”를 스스로 검증해, 강의를 봐야만 풀리는 진짜 검증 문항만 남깁니다.' },
  { icon: 'ph-target', title: '관심사 맞춤 추천', desc: '관심사와 학습 기록을 바탕으로 다음에 볼 강의를 골라, 이어서 학습할 흐름을 추천합니다.' },
];

const AUDIENCE = [
  {
    icon: 'ph-student',
    title: '학습자',
    desc: '오늘의 강의, 시청 진행, 확인 문제 기록을 한눈에 확인합니다.',
    points: ['오늘의 강의·이어보기', '시청 중 확인 문제', '본 데까지 이어서 재생'],
  },
  {
    icon: 'ph-chalkboard-teacher',
    title: '강사',
    desc: '강의를 올리고 확인 문제와 출제 시점을 직접 설계합니다.',
    points: ['강의 업로드·목차 관리', '확인 문제·출제 시점 설계', 'AI 문항 초안 지원'],
  },
  {
    icon: 'ph-buildings',
    title: '기업 · 기관',
    desc: '구성원의 시청 완료와 이수 현황을 신뢰할 수 있는 데이터로 확인합니다.',
    points: ['이수·수료 현황 집계', '구성원 학습 분석', '안전한 데이터 관리'],
  },
];

// '모두를 위한 화면' — 역할 카드를 누르면 펼쳐지는 '역대 협업 사례'.
// ★서비스 소개용 예시 콘텐츠(실존 인물·기관 아님, 이름은 가림표기·가상). 패널에 '예시' 표기를 둔다.
type RoleCase = {
  intro: string;
  stats: { num: string; label: string }[];
  partners: string[];
  quotes: { who: string; quote: string }[];
};
const ROLE_CASES: Record<string, RoleCase> = {
  학습자: {
    intro: '부트캠프·대학·평생교육원과 함께한 학습자들이 CatChap으로 “진짜 시청”을 증명했습니다.',
    stats: [
      { num: '12,400+', label: '누적 수료 학습자' },
      { num: '87%', label: '평균 완주율' },
      { num: '79%', label: '확인 문제 정답률' },
    ],
    partners: ['코드무브캠프 백엔드 3기', '한결직업전문학교', '아라디지털대학 교양', '데이터런 아카데미'],
    quotes: [
      { who: '김O민 · 취업 준비생', quote: '딴짓하면 바로 문제가 떠서 진짜로 다 봤어요. 이 수료증은 부끄럽지 않아요.' },
      { who: '이O서 · 재직자', quote: '배속·건너뛰기가 막히니까 오히려 끝까지 집중해서 보게 되더라고요.' },
    ],
  },
  강사: {
    intro: '현업 전문가·인기 강사들이 CatChap에 강의를 올려 “실제로 본 학습자”만 수료하게 했습니다.',
    stats: [
      { num: '3,200+', label: '등록 강의' },
      { num: '4.8/5', label: '강사 평균 만족도' },
      { num: '92%', label: 'AI 문항 초안 채택률' },
    ],
    partners: ['클라우드 아키텍처', '데이터 사이언스', '백엔드 15년차', 'UX 리서치'],
    quotes: [
      { who: '박O우 · 클라우드 강사', quote: '시청 검증 덕에 “수료=학습”이 성립해요. 기업 교육 문의가 눈에 띄게 늘었습니다.' },
      { who: '정O늘 · 데이터 강사', quote: 'AI가 자막을 읽고 문항 초안을 만들어줘서 출제 시간이 1/5로 줄었어요.' },
    ],
  },
  '기업 · 기관': {
    intro: '임직원·구성원 필수 교육의 “진짜 이수”를 데이터로 증명한 도입 사례입니다.',
    stats: [
      { num: '140+', label: '도입 기업·기관' },
      { num: '96%', label: '평균 이수율' },
      { num: '60%↓', label: '교육 관리 공수' },
    ],
    partners: ['하람금융 정보보호 교육', '세윤에너지 안전보건', '가온인재개발원 교원 연수', '라온모빌리티 온보딩'],
    quotes: [
      { who: '하람금융그룹 · HRD팀', quote: '클릭만 하고 방치하던 이수가 사라졌어요. 감사 대응이 훨씬 편해졌습니다.' },
      { who: '세윤에너지 · 안전관리팀', quote: '법정 필수교육을 “실제로 봤다”고 데이터로 증명할 수 있게 됐어요.' },
    ],
  },
};

// 히어로 프리뷰 카드의 분필체 파이차트 해칭선 — CatChap 랜딩.dc.html의 SVG 원본 좌표 그대로.
const HATCH_LINES: [number, number, number, number][] = [
  [130, 34, 0, 164], [144, 34, 14, 164], [158, 34, 28, 164], [172, 34, 42, 164],
  [186, 34, 56, 164], [200, 34, 70, 164], [214, 34, 84, 164], [228, 34, 98, 164],
  [242, 34, 112, 164], [256, 34, 126, 164], [270, 34, 140, 164], [284, 34, 154, 164],
  [298, 34, 168, 164], [312, 34, 182, 164], [326, 34, 196, 164], [340, 34, 210, 164],
];

const STEPS = [
  { n: '1', icon: 'ph-monitor-play', title: '강의를 봅니다', desc: '과목별 강의를 골라 이어서 시청합니다.' },
  { n: '2', icon: 'ph-seal-question', title: '확인 문제를 풉니다', desc: '무작위 시점에 강의 내용 문제가 나옵니다.' },
  { n: '3', icon: 'ph-shield-check', title: '시청을 검증합니다', desc: '건너뛰기·과속·동시 재생을 서버가 확인합니다.' },
  { n: '4', icon: 'ph-squares-four', title: '기록으로 봅니다', desc: '역할별 화면에 시청·학습 요약을 제공합니다.' },
];

// 신뢰 로고 마퀴(왼쪽 무한 스크롤)에 흐르는 이름 — 전부 실존하지 않는 가상 기업·기관(임의 작명).
// 실제 도입처가 생기면 이 배열만 바꾸면 된다. 역할 카드 협업 사례와 같은 '예시 세계관'.
const TRUST_LOGOS = [
  '하람금융그룹',
  '세윤에너지',
  '라온모빌리티',
  '세움소프트',
  '다온물산',
  '노을로지스틱스',
  '해든바이오',
  '아라디지털대학',
  '온빛평생교육원',
  '코드무브캠프',
  '한결직업전문학교',
  '도담엔지니어링',
];

// 신뢰 지표 — 화면에 들어오면 0→목표로 카운트업. 역할 카드 협업 사례 수치와 같은 예시 세계관.
const TRUST_STATS: { to: number; suffix?: string; label: string }[] = [
  { to: 12400, suffix: '+', label: '누적 수료 학습자' },
  { to: 3200, suffix: '+', label: '등록 강의' },
  { to: 140, suffix: '+', label: '도입 기업·기관' },
  { to: 96, suffix: '%', label: '평균 이수율' },
];

// 후기 캐러셀 — 서비스 소개용 예시 후기(가명·가상 기관, 역할 카드 사례와 같은 세계관).
const TESTIMONIALS: { quote: string; who: string; role: string }[] = [
  { quote: '딴짓하면 바로 문제가 떠서 진짜로 다 봤어요. 이 수료증은 부끄럽지 않아요.', who: '김O민', role: '취업 준비생' },
  { quote: '시청 검증 덕에 "수료=학습"이 성립해요. 기업 교육 문의가 눈에 띄게 늘었습니다.', who: '박O우', role: '클라우드 강사' },
  { quote: '클릭만 하고 방치하던 이수가 사라졌어요. 감사 대응이 훨씬 편해졌습니다.', who: '하람금융그룹', role: 'HRD팀' },
  { quote: '배속·건너뛰기가 막히니까 오히려 끝까지 집중해서 보게 되더라고요.', who: '이O서', role: '재직자' },
  { quote: 'AI가 자막을 읽고 문항 초안을 만들어줘서 출제 시간이 1/5로 줄었어요.', who: '정O늘', role: '데이터 강사' },
  { quote: '법정 필수교육을 실제로 봤다고 데이터로 증명할 수 있게 됐어요.', who: '세윤에너지', role: '안전관리팀' },
];

// 자주 묻는 질문(FAQ) — 실제 제품 규약(시청 검증·AI 출제·환불·데이터 보호·무가입 체험) 기반.
const FAQS: { q: string; a: string }[] = [
  {
    q: '시청 검증은 어떻게 이뤄지나요?',
    a: '재생 중 무작위 시점에 확인 문제가 나타납니다. 건너뛰기·과속·동시 재생은 서버가 감지해 차단하고, 그 대목을 실제로 본 경우에만 통과합니다.',
  },
  {
    q: '확인 문제는 누가 만드나요?',
    a: 'AI가 강의 음성을 자막으로 옮기고 그 내용을 근거로 확인 문항을 자동 생성합니다. 2차 AI가 "안 보고도 풀리는지"를 검증해 진짜 시청이 필요한 문항만 남기며, 강사가 문항과 출제 시점을 직접 손볼 수도 있습니다.',
  },
  {
    q: '수료증은 신뢰할 수 있나요?',
    a: '시청 완료가 곧 학습의 증거이므로, CatChap 수료증은 강의를 실제로 본 이수를 의미합니다. 기업·기관은 구성원의 이수 현황을 데이터로 확인할 수 있습니다.',
  },
  {
    q: '결제와 환불은 어떻게 되나요?',
    a: '코스별로 수강 신청 후 결제하며, 환불은 학습 진행률에 따라 규정된 비율로 처리됩니다. 자세한 규정은 결제 단계와 이용약관에서 확인할 수 있습니다.',
  },
  {
    q: '개인정보는 안전하게 보호되나요?',
    a: '가명·최소 수집 원칙으로 학습자 정보를 보호합니다. 시청·학습 데이터는 학습 분석 목적에 한해 사용됩니다.',
  },
  {
    q: '가입하지 않고 먼저 체험해볼 수 있나요?',
    a: '네. "가입 없이 체험하기"로 시청 검증·확인 문제·문제은행·수료증 미리보기를 로그인 없이 둘러볼 수 있습니다.',
  },
];

type Menu = 'about' | 'lectures' | 'audience' | 'how' | null;

export default function MainPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  useRevealOnScroll(rootRef);
  // 최종 CTA 섹션 — 스크롤 연동 확대 + 3초 유휴 시 1회 부드러운 자동 스크롤(접근성·모바일 안전).
  const finalRef = useCtaAutoReveal<HTMLElement>();

  // 스크롤에 따라 상단바를 투명→불투명(로고도 흰색→검정)으로 전환 — 히어로가 다크라 필요.
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState<Menu>(null);
  // '모두를 위한 화면' 역할 카드 → 협업 사례 펼침. activeRole=열린 카드(없으면 null),
  // shownRole=패널에 그릴 내용(닫힐 때도 남겨 접힘 애니메이션이 내용과 함께 부드럽게 되게 한다).
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [shownRole, setShownRole] = useState<string | null>(null);
  const toggleRole = (title: string) => {
    if (activeRole === title) {
      setActiveRole(null); // 접기 — shownRole은 유지
    } else {
      setShownRole(title);
      setActiveRole(title);
    }
  };
  const closeTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.6);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const openMenu = (m: Menu) => {
    window.clearTimeout(closeTimer.current);
    setMenu(m);
  };
  const scheduleClose = () => {
    closeTimer.current = window.setTimeout(() => setMenu(null), 140);
  };
  const solid = scrolled || menu !== null;

  return (
    <div className="mn-page" ref={rootRef}>
      {/* NAV */}
      <div className="mn-navwrap" onMouseLeave={scheduleClose}>
        <header className={'mn-nav' + (solid ? ' mn-nav--solid' : '')}>
          <div className="mn-nav-inner">
            <Link to={PATHS.HOME} className="mn-brand" onClick={() => setMenu(null)}>
              <span className="mn-brand-imgwrap">
                <img src={wordmarkWhite} alt="CatChap" className="mn-brand-logo" style={{ opacity: solid ? 0 : 1 }} />
                <img src={wordmarkDark} alt="CatChap" className="mn-brand-logo mn-brand-logo--abs" style={{ opacity: solid ? 1 : 0 }} />
              </span>
            </Link>
            <nav className="mn-nav-menu">
              <span className="mn-nav-link" onMouseEnter={() => openMenu('about')}>서비스 소개</span>
              <span className="mn-nav-link" onMouseEnter={() => openMenu('lectures')}>강의</span>
              <span className="mn-nav-link" onMouseEnter={() => openMenu('audience')}>이용 대상</span>
              <span className="mn-nav-link" onMouseEnter={() => openMenu('how')}>이용 방법</span>
            </nav>
            <div className="mn-nav-right">
              <Link to={PATHS.CONTACT} className="mn-contact-link">문의하기</Link>
              <Link to={PATHS.LOGIN} className="mn-login-link">로그인</Link>
              <Link to={PATHS.LOGIN} className="mn-cta-link">시작하기</Link>
            </div>
          </div>

          <div className={'mn-navpanel' + (menu ? ' mn-navpanel--open' : '')}>
            <div className="mn-navpanel-inner">
              {menu === 'about' && (
                <div className="mn-navpanel-grid">
                  {ABOUT_ITEMS.map((it) => (
                    <a key={it.title} href="#about" className="mn-navpanel-item">
                      <i className={`ph ${it.icon}`} />
                      <div className="mn-navpanel-item-title">{it.title}</div>
                      <div className="mn-navpanel-item-desc">{it.desc}</div>
                    </a>
                  ))}
                </div>
              )}
              {menu === 'lectures' && (
                <div className="mn-navpanel-grid mn-navpanel-grid--4">
                  {AI_FEATURES.map((f) => (
                    <a key={f.title} href="#games" className="mn-navpanel-item mn-navpanel-item--center">
                      <i className={`ph ${f.icon}`} />
                      <span className="mn-navpanel-item-name">{f.title}</span>
                    </a>
                  ))}
                </div>
              )}
              {menu === 'audience' && (
                <div className="mn-navpanel-grid">
                  {AUDIENCE.map((a) => (
                    <a key={a.title} href="#roles" className="mn-navpanel-item">
                      <i className={`ph ${a.icon}`} />
                      <div className="mn-navpanel-item-title">{a.title}</div>
                      <div className="mn-navpanel-item-desc">{a.desc}</div>
                    </a>
                  ))}
                </div>
              )}
              {menu === 'how' && (
                <div className="mn-navpanel-grid mn-navpanel-grid--4">
                  {STEPS.map((st) => (
                    <div key={st.n} className="mn-navpanel-item">
                      <div className="mn-navpanel-step">STEP {st.n}</div>
                      <i className={`ph ${st.icon}`} />
                      <div className="mn-navpanel-item-title">{st.title}</div>
                      <div className="mn-navpanel-item-desc">{st.desc}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>
      </div>

      {/* HERO — 풀블리드 다크 */}
      <section className="mn-hero">
        <div className="mn-hero-overlay" />
        <div className="mn-hero-content">
          <div className="mn-hero-eyebrow hero-in">영상 시청을 검증하는 강의 플랫폼</div>
          <h1 className="mn-hero-title hero-in hero-d1">
            틀어만 놓는 인강은
            <br />
            이제 그만.
          </h1>
          <p className="mn-hero-desc hero-in hero-d2">
            강의 중간중간 확인 문제가 나와 실제로 보고 있는지 검증합니다. 학습자는 놓치지 않고
            배우고, 기관은 시청 완료를 신뢰합니다.
          </p>
          <div className="mn-hero-cta-row hero-in hero-d3">
            <Link to={PATHS.DEMO} className="mn-hero-cta-white">가입 없이 체험하기</Link>
            <Link to={PATHS.LOGIN} className="mn-hero-cta-outline">회원가입</Link>
          </div>
        </div>
        <a href="#next" className="mn-scroll-cue">
          <i className="ph ph-caret-down" />
        </a>
      </section>

      {/* 신뢰 지표 — 스크롤 진입 시 0→목표로 카운트업 */}
      <TrustStats />

      {/* PRODUCT PREVIEW */}
      <section id="next" className="mn-preview">
        <div className="mn-preview-left cc-reveal">
          <span className="mn-eyebrow">제품 미리보기</span>
          <h2 className="mn-preview-title">
            화면 안에서
            <br />
            시청을 검증합니다.
          </h2>
          <p className="mn-preview-desc">
            재생 중 무작위 시점에 확인 문제가 등장합니다. 건너뛰기·과속 재생은 서버가 차단해,
            시청 완료가 곧 학습의 증거가 됩니다.
          </p>
          <div className="mn-preview-cta-row">
            <a href="#games" className="mn-hero-cta">서비스 둘러보기</a>
            <Link to={PATHS.LOGIN} className="mn-hero-cta-secondary">회원가입</Link>
          </div>
          <div className="mn-hero-stats">
            <div><div className="mn-stat-num">6과목</div><div className="mn-stat-label">과목별 강의</div></div>
            <div><div className="mn-stat-num">시청 검증</div><div className="mn-stat-label">확인 문제 게이트</div></div>
            <div><div className="mn-stat-num">데이터 보호</div><div className="mn-stat-label">가명·최소 수집</div></div>
          </div>
        </div>
        <div className="mn-preview-right cc-reveal">
          <div className="mn-preview-card">
            <div className="mn-preview-video">
              <div className="mn-preview-video-glow" />
              <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid meet" className="mn-preview-svg">
                <defs>
                  <filter id="mnChalk" x="-20%" y="-20%" width="140%" height="140%">
                    <feTurbulence type="fractalNoise" baseFrequency={0.85} numOctaves={2} seed={7} result="n" />
                    <feDisplacementMap in="SourceGraphic" in2="n" scale={2.3} />
                  </filter>
                  <clipPath id="mnPieFill">
                    <path d="M246 100 L246 40 A60 60 0 0 1 303.07 81.46 Z" />
                    <path d="M246 100 L303.07 81.46 A60 60 0 0 1 281.27 148.54 Z" />
                    <path d="M246 100 L281.27 148.54 A60 60 0 0 1 210.73 148.54 Z" />
                  </clipPath>
                </defs>
                <g filter="url(#mnChalk)" opacity={0.82}>
                  <g clipPath="url(#mnPieFill)" stroke="#F1EEE4" strokeWidth={1.3} opacity={0.5}>
                    {HATCH_LINES.map(([x1, y1, x2, y2], i) => (
                      <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
                    ))}
                  </g>
                  <g fill="none" stroke="#F1EEE4" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx={246} cy={100} r={60} />
                    <line x1={246} y1={100} x2={246} y2={40} />
                    <line x1={246} y1={100} x2={303.07} y2={81.46} />
                    <line x1={246} y1={100} x2={281.27} y2={148.54} />
                    <line x1={246} y1={100} x2={210.73} y2={148.54} />
                    <line x1={246} y1={100} x2={188.93} y2={81.46} />
                  </g>
                  <g fill="#F1EEE4" textAnchor="middle" fontFamily="'Pretendard',sans-serif" fontWeight={400}>
                    <text x={44} y={90} fontSize={46}>2</text>
                    <rect x={22} y={99} width={44} height={2.6} rx={1.3} />
                    <text x={44} y={146} fontSize={46}>5</text>
                    <text x={80} y={116} fontSize={32}>+</text>
                    <text x={110} y={90} fontSize={46}>1</text>
                    <rect x={88} y={99} width={44} height={2.6} rx={1.3} />
                    <text x={110} y={146} fontSize={46}>5</text>
                  </g>
                </g>
              </svg>
              <div className="mn-preview-play"><i className="ph ph-play" /></div>
              <div className="mn-preview-tag">수학 · 3강</div>
              <div className="mn-preview-progress"><div className="mn-preview-progress-fill" /></div>
            </div>
            <div className="mn-preview-quiz">
              <span className="mn-preview-quiz-icon"><i className="ph ph-seal-question" /></span>
              <div>
                <div className="mn-preview-quiz-title">확인 문제 · 지금 화면에 답하기</div>
                <div className="mn-preview-quiz-sub">무작위 시점 출제 · 건너뛰기 차단</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 제품 데모 루프 — 시청검증→확인문제 흐름을 자동 재생으로 재현하고 /demo로 연결.
          연출은 순수 CSS 타임라인(dlFill/dlQuiz/dlCorrect/dlCheck 7s 루프). */}
      <section className="mn-demoloop">
        <div className="mn-demoloop-inner">
          <div className="mn-demoloop-copy cc-reveal">
            <span className="mn-eyebrow">직접 보기</span>
            <h2 className="mn-demoloop-title">보는 순간, 검증됩니다</h2>
            <p className="mn-demoloop-desc">
              재생 중 무작위로 확인 문제가 떠요. 그 대목을 실제로 본 사람만 통과하죠. 아래는 실제
              흐름을 그대로 재현한 미리보기입니다.
            </p>
            <Link to={PATHS.DEMO} className="mn-hero-cta mn-demoloop-cta">
              가입 없이 전체 체험하기 <i className="ph-bold ph-arrow-right" />
            </Link>
          </div>
          <div className="mn-demoloop-stage cc-reveal" aria-hidden="true">
            <div className="dl-player">
              <div className="dl-scene">
                <span className="dl-livetag"><span className="dl-livedot" /> 재생 중</span>
                <i className="ph-fill ph-play-circle dl-play" />
                <span className="dl-scene-cap">클라우드 입문 · 3강</span>
              </div>
              <div className="dl-bar">
                <div className="dl-bar-fill" />
              </div>
              <div className="dl-quiz">
                <div className="dl-quiz-top">
                  <i className="ph-fill ph-seal-question" /> 확인 문제
                </div>
                <div className="dl-quiz-q">이 대목에서 IAM 역할(Role)의 핵심 목적은?</div>
                <div className="dl-opt">임시 권한을 안전하게 위임하려고</div>
                <div className="dl-opt dl-opt--correct">
                  꼭 필요한 권한만 최소로 부여하려고
                  <i className="ph-bold ph-check dl-check" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* VALUE PROPS */}
      <section id="about" className="mn-about">
        <div className="mn-about-inner">
          <div className="mn-about-head cc-reveal">
            <h2 className="mn-about-title">시청이 검증이 되는 순간</h2>
            <p className="mn-sec-sub">색이 아닌 구조로 신뢰를 만듭니다. 재생 데이터와 확인 문제로 실제 학습을 증명합니다.</p>
          </div>
          <div className="mn-vp-grid cc-reveal-group">
            {ABOUT_ITEMS.map((it) => (
              <div key={it.title} className="mn-vp-card">
                <i className={`ph ${it.icon} mn-vp-icon`} />
                <h3 className="mn-vp-title">{it.title}</h3>
                <p className="mn-vp-text">{it.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI — 플랫폼을 움직이는 AI 능력 쇼케이스(파이프라인 다이어그램 + 능력 카드).
          종전의 '6과목 강의' 하드코딩 그리드는 제거(코스가 declare한 자유 분류를 쓰는 제품). */}
      <section id="games" className="mn-games">
        <div className="mn-games-inner">
          <div className="mn-ai cc-reveal">
            <div className="mn-ai-head">
              <span className="mn-ai-kicker"><i className="ph-fill ph-sparkle" /> AI POWERED</span>
              <h2 className="mn-ai-title">강의를 ‘이해한’ AI가 확인 학습을 만듭니다</h2>
              <p className="mn-ai-lead">
                최신 대규모 언어모델(LLM)과 음성 인식(STT)이 강의 내용을 읽고, 그 대목을 실제로
                봐야만 풀 수 있는 확인 문항을 자동으로 만듭니다. 사람이 일일이 출제하지 않아도 모든
                강의에 시청 검증이 붙어요.
              </p>
            </div>

            {/* 파이프라인 다이어그램 — 강의 영상에서 시청 검증까지의 실제 AI 흐름(테마 대응 SVG) */}
            <div className="mn-ai-pipe cc-reveal">
              <div className="mn-ai-pipe-scroll">
                <svg
                  viewBox="0 0 1080 132"
                  className="mn-ai-pipe-svg"
                  role="img"
                  aria-label="AI 확인 학습 파이프라인 — 강의 영상에서 음성 인식(STT)으로 자막을 만들고, LLM이 그 대목 기반 확인 문항을 생성하며, 2차 AI가 봇 저항을 검증해 시청 검증에 씁니다."
                >
                  <defs>
                    <marker id="mnAiArrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                      <path d="M0,0 L10,5 L0,10 z" className="mn-ai-pipe-ah" />
                    </marker>
                  </defs>
                  <rect className="mn-ai-pipe-rect" x="20" y="20" width="200" height="76" rx="14" />
                  <rect className="mn-ai-pipe-rect" x="300" y="20" width="200" height="76" rx="14" />
                  <rect className="mn-ai-pipe-rect" x="580" y="20" width="200" height="76" rx="14" />
                  <rect className="mn-ai-pipe-rect mn-ai-pipe-rect--out" x="860" y="20" width="200" height="76" rx="14" />
                  <line className="mn-ai-pipe-line" x1="222" y1="58" x2="298" y2="58" markerEnd="url(#mnAiArrow)" />
                  <line className="mn-ai-pipe-line" x1="502" y1="58" x2="578" y2="58" markerEnd="url(#mnAiArrow)" />
                  <line className="mn-ai-pipe-line" x1="782" y1="58" x2="858" y2="58" markerEnd="url(#mnAiArrow)" />
                  <text className="mn-ai-pipe-cap" x="260" y="48">STT</text>
                  <text className="mn-ai-pipe-cap" x="540" y="48">LLM</text>
                  <text className="mn-ai-pipe-cap" x="820" y="48">2차 AI</text>
                  <text className="mn-ai-pipe-t" x="120" y="56">강의 영상</text>
                  <text className="mn-ai-pipe-s" x="120" y="76">음성 · 화면</text>
                  <text className="mn-ai-pipe-t" x="400" y="56">자막</text>
                  <text className="mn-ai-pipe-s" x="400" y="76">음성 인식 추출</text>
                  <text className="mn-ai-pipe-t" x="680" y="56">확인 문항</text>
                  <text className="mn-ai-pipe-s" x="680" y="76">그 대목 기반 생성</text>
                  <text className="mn-ai-pipe-t" x="960" y="56">시청 검증</text>
                  <text className="mn-ai-pipe-s" x="960" y="76">봐야 통과</text>
                </svg>
              </div>
            </div>

            <div className="mn-ai-grid cc-reveal-group">
              {AI_FEATURES.map((f) => (
                <div key={f.title} className="mn-ai-card">
                  <i className={`ph ${f.icon} mn-ai-icon`} />
                  <div className="mn-ai-name">{f.title}</div>
                  <p className="mn-ai-desc">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ROLES — 카드 클릭 시 '역대 협업 사례'가 애니메이션으로 펼쳐진다(그 아래 공용 패널). */}
      <section id="roles" className="mn-roles">
        <div className="mn-roles-head cc-reveal">
          <h2 className="mn-roles-title">모두를 위한 화면</h2>
          <p className="mn-sec-sub">
            같은 시청 데이터를 학습자·강사·기관에게 목적에 맞게 다르게 보여줍니다.{' '}
            <span className="mn-roles-hint">카드를 눌러 협업 사례를 확인하세요.</span>
          </p>
        </div>
        <div className="mn-roles-grid cc-reveal-group">
          {AUDIENCE.map((a) => {
            const open = activeRole === a.title;
            return (
              <button
                key={a.title}
                type="button"
                className={'mn-role-card' + (open ? ' is-open' : '')}
                onClick={() => toggleRole(a.title)}
                aria-expanded={open}
              >
                <i className={`ph ${a.icon} mn-role-icon`} />
                <h3 className="mn-role-title">{a.title}</h3>
                <p className="mn-role-desc">{a.desc}</p>
                <div className="mn-role-list">
                  {a.points.map((p) => (
                    <span key={p} className="mn-role-item"><i className="ph ph-check" />{p}</span>
                  ))}
                </div>
                <span className="mn-role-more">
                  <i className="ph-bold ph-handshake" /> 협업 사례 {open ? '접기' : '보기'}
                  <i className="ph-bold ph-caret-down mn-role-morecaret" />
                </span>
              </button>
            );
          })}
        </div>

        {/* 선택한 역할의 역대 협업 사례 — grid-rows 0fr→1fr로 부드럽게 펼침 */}
        <div className={'mn-rolecases-wrap' + (activeRole ? ' is-open' : '')}>
          <div className="mn-rolecases-clip">
            <div className="mn-rolecases-inner">
              {shownRole && ROLE_CASES[shownRole] && (
                <div className="mn-rolecases" key={shownRole}>
                  <div className="mn-rolecases-head">
                    <span className="mn-rolecases-kicker">
                      <i className="ph-fill ph-handshake" /> {shownRole} · 역대 협업 사례
                    </span>
                    <p className="mn-rolecases-intro">{ROLE_CASES[shownRole].intro}</p>
                  </div>
                  <div className="mn-rolecases-stats">
                    {ROLE_CASES[shownRole].stats.map((s) => (
                      <div key={s.label} className="mn-rolecases-stat">
                        <b>{s.num}</b>
                        <span>{s.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mn-rolecases-partners">
                    {ROLE_CASES[shownRole].partners.map((p) => (
                      <span key={p} className="mn-rolecases-chip">{p}</span>
                    ))}
                  </div>
                  <div className="mn-rolecases-quotes">
                    {ROLE_CASES[shownRole].quotes.map((q) => (
                      <blockquote key={q.who} className="mn-rolecases-quote">
                        <i className="ph-fill ph-quotes" />
                        <p>{q.quote}</p>
                        <cite>{q.who}</cite>
                      </blockquote>
                    ))}
                  </div>
                  <p className="mn-rolecases-note">* 서비스 소개용 예시입니다.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="mn-how">
        <div className="mn-how-inner">
          <h2 className="mn-how-title cc-reveal">이렇게 작동합니다</h2>
          <div className="mn-how-row cc-reveal-group">
            {STEPS.map((st) => (
              <div key={st.n} className="mn-step-card">
                <div className="mn-step-label">STEP {st.n}</div>
                <h3 className="mn-step-title">{st.title}</h3>
                <p className="mn-step-desc">{st.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 후기 캐러셀 — 예시 후기를 한 장씩 자동으로 넘김 */}
      <Testimonials />

      {/* FAQ 아코디언 — 자주 묻는 질문 */}
      <Faq />

      {/* 신뢰 로고 마퀴 — 최종 CTA 바로 위. 왼쪽 무한 스크롤. 이름은 전부 가상 기업·기관. */}
      <section className="mn-trust">
        <p className="mn-trust-label">
          함께하는 기관·기업 <span className="mn-trust-ex">예시</span>
        </p>
        <div className="mn-marquee" aria-hidden="true">
          <div className="mn-marquee-track">
            {[...TRUST_LOGOS, ...TRUST_LOGOS].map((name, i) => (
              <span key={i} className="mn-marquee-item">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA — 진입 시 스르륵 확대되는 풀스크린 연출(useCtaAutoReveal). cc-reveal은
          transform이 겹쳐 충돌하므로 쓰지 않고, 이 훅의 --mn-p 스케일이 등장까지 담당한다. */}
      <section className="mn-final" ref={finalRef}>
        <div className="mn-final-inner">
          <h2 className="mn-final-title">시청을 신뢰로 바꾸세요</h2>
          <p className="mn-final-sub">지금 CatChap을 시작하고 실제 학습을 증명하세요.</p>
          <div className="mn-final-cta-row">
            <Link to={PATHS.LOGIN} className="mn-hero-cta">로그인 하기</Link>
            <Link to={PATHS.CONTACT} className="mn-hero-cta-secondary">도입 문의</Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mn-footer">
        <div className="mn-footer-inner">
          <div className="mn-footer-brand">
            <img src={wordmarkWhite} alt="CatChap" className="mn-footer-logo" />
            <span className="mn-footer-tagline">영상 시청을 검증하는 강의 플랫폼</span>
          </div>
          <div className="mn-footer-links">
            <a href="#about" className="mn-footer-link">서비스 소개</a>
            <Link to={PATHS.PRIVACY} className="mn-footer-link">개인정보 보호</Link>
            <Link to={PATHS.TERMS} className="mn-footer-link">이용약관</Link>
          </div>
        </div>
        <p className="mn-footer-copy">© 2026 CatChap · 카카오클라우드 AIaaS 마스터 클래스 5기. 학습자의 시청 데이터는 안전하게 보호됩니다.</p>
      </footer>
    </div>
  );
}

/** 신뢰 지표 밴드 — 화면에 들어오면 각 숫자가 0→목표로 카운트업(1회). */
function TrustStats() {
  const ref = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setRun(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <section className="mn-stats" aria-label="서비스 지표">
      <div className="mn-stats-inner" ref={ref}>
        {TRUST_STATS.map((s) => (
          <div key={s.label} className="mn-stat">
            <div className="mn-stat-big">
              <CountNum to={s.to} run={run} />
              <span className="mn-stat-suffix">{s.suffix}</span>
            </div>
            <div className="mn-stat-cap">{s.label}</div>
          </div>
        ))}
      </div>
      <p className="mn-stats-note">* 서비스 소개용 예시 지표입니다.</p>
    </section>
  );
}

/** 0→to 카운트업 숫자(easeOutCubic). 모션 최소화 설정 시 즉시 최종값 표시. */
function CountNum({ to, run }: { to: number; run: boolean }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!run) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVal(to);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    const dur = 1400;
    const tick = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(to * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, to]);
  return <>{val.toLocaleString('ko-KR')}</>;
}

/** 후기 캐러셀 — 한 장씩 좌우로 슬라이드, 5초 자동 넘김(호버 시 정지), 점·화살표로 이동. */
function Testimonials() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = TESTIMONIALS.length;
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => setIdx((i) => (i + 1) % n), 5000);
    return () => window.clearInterval(id);
  }, [paused, n]);
  const go = (d: number) => setIdx((i) => (i + d + n) % n);
  return (
    <section
      className="mn-tst"
      aria-label="사용자 후기"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mn-tst-inner">
        <div className="mn-tst-head cc-reveal">
          <span className="mn-eyebrow">사용자 후기</span>
          <h2 className="mn-tst-title">시청을 증명한 사람들</h2>
        </div>
        <div className="mn-tst-stage cc-reveal">
          <button className="mn-tst-arrow" onClick={() => go(-1)} aria-label="이전 후기">
            <i className="ph-bold ph-caret-left" />
          </button>
          <div className="mn-tst-viewport">
            <div className="mn-tst-track" style={{ transform: `translateX(-${idx * 100}%)` }}>
              {TESTIMONIALS.map((t, i) => (
                <figure className="mn-tst-card" key={i} aria-hidden={i !== idx}>
                  <i className="ph-fill ph-quotes mn-tst-qmark" />
                  <blockquote className="mn-tst-quote">{t.quote}</blockquote>
                  <figcaption className="mn-tst-cap">
                    <span className="mn-tst-avatar">{t.who.slice(0, 1)}</span>
                    <span className="mn-tst-who">
                      <b>{t.who}</b>
                      <span className="mn-tst-role">{t.role}</span>
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
          <button className="mn-tst-arrow" onClick={() => go(1)} aria-label="다음 후기">
            <i className="ph-bold ph-caret-right" />
          </button>
        </div>
        <div className="mn-tst-dots">
          {TESTIMONIALS.map((_, i) => (
            <button
              key={i}
              className={'mn-tst-dot' + (i === idx ? ' is-on' : '')}
              onClick={() => setIdx(i)}
              aria-label={`${i + 1}번째 후기 보기`}
              aria-current={i === idx}
            />
          ))}
        </div>
        <p className="mn-tst-note">* 서비스 소개용 예시 후기입니다.</p>
      </div>
    </section>
  );
}

/** FAQ 아코디언 — 한 번에 하나 펼침(grid-rows 0fr→1fr로 부드럽게). */
function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="mn-faq">
      <div className="mn-faq-inner">
        <div className="mn-faq-head cc-reveal">
          <span className="mn-eyebrow">자주 묻는 질문</span>
          <h2 className="mn-faq-title">궁금한 점을 먼저 풀어드릴게요</h2>
        </div>
        <div className="mn-faq-list cc-reveal">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={i} className={'mn-faq-item' + (isOpen ? ' is-open' : '')}>
                <button
                  type="button"
                  className="mn-faq-q"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                >
                  <span>{f.q}</span>
                  <i className="ph-bold ph-plus mn-faq-plus" />
                </button>
                <div className="mn-faq-aclip">
                  <div className="mn-faq-a">
                    <p>{f.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
