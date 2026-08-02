import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { useRevealOnScroll } from '../../hooks/useRevealOnScroll';
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

type Menu = 'about' | 'lectures' | 'audience' | 'how' | null;

export default function MainPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  useRevealOnScroll(rootRef);

  // 스크롤에 따라 상단바를 투명→불투명(로고도 흰색→검정)으로 전환 — 히어로가 다크라 필요.
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState<Menu>(null);
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
            <a href="#games" className="mn-hero-cta-white">서비스 둘러보기</a>
            <Link to={PATHS.LOGIN} className="mn-hero-cta-outline">회원가입</Link>
          </div>
        </div>
        <a href="#next" className="mn-scroll-cue">
          <i className="ph ph-caret-down" />
        </a>
      </section>

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
                  viewBox="0 0 1040 132"
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

      {/* ROLES */}
      <section id="roles" className="mn-roles">
        <div className="mn-roles-head cc-reveal">
          <h2 className="mn-roles-title">모두를 위한 화면</h2>
          <p className="mn-sec-sub">같은 시청 데이터를 학습자·강사·기관에게 목적에 맞게 다르게 보여줍니다.</p>
        </div>
        <div className="mn-roles-grid cc-reveal-group">
          {AUDIENCE.map((a) => (
            <div key={a.title} className="mn-role-card">
              <i className={`ph ${a.icon} mn-role-icon`} />
              <h3 className="mn-role-title">{a.title}</h3>
              <p className="mn-role-desc">{a.desc}</p>
              <div className="mn-role-list">
                {a.points.map((p) => (
                  <span key={p} className="mn-role-item"><i className="ph ph-check" />{p}</span>
                ))}
              </div>
            </div>
          ))}
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

      {/* FINAL CTA */}
      <section className="mn-final">
        <div className="mn-final-inner cc-reveal">
          <h2 className="mn-final-title">시청을 신뢰로 바꾸세요</h2>
          <p className="mn-final-sub">지금 CatChap을 시작하고 실제 학습을 증명하세요.</p>
          <div className="mn-final-cta-row">
            <Link to={PATHS.LOGIN} className="mn-hero-cta">무료로 시작하기</Link>
            <Link to={PATHS.CONTACT} className="mn-hero-cta-secondary">도입 문의</Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mn-footer">
        <div className="mn-footer-inner">
          <div className="mn-footer-brand">
            <img src={wordmarkDark} alt="CatChap" className="mn-footer-logo" />
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
