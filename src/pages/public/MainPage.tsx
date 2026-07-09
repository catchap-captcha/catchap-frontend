import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { useRevealOnScroll } from '../../hooks/useRevealOnScroll';
import mascot from '../../assets/characters/catchap-logo.png';
// 협력사 로고 (배경 제거 PNG)
import pChamjal from '../../assets/partners/p-chamjal.png';
import pTtokttok from '../../assets/partners/p-ttokttok.png';
import pHanbit from '../../assets/partners/p-hanbit.png';
import pYeollin from '../../assets/partners/p-yeollin.png';
import pIbook from '../../assets/partners/p-ibook.png';
import pMiraen from '../../assets/partners/p-miraen.png';
import pCube from '../../assets/partners/p-cube.png';
import pParang from '../../assets/partners/p-parang.png';
import pHaneul from '../../assets/partners/p-haneul.png';
import pDegul from '../../assets/partners/p-degul.png';
// 데이터 활용 기관 로고
import dBaldal from '../../assets/partners/d-baldal.png';
import dEduresearch from '../../assets/partners/d-eduresearch.png';
import dProtect from '../../assets/partners/d-protect.png';
import dBehavior from '../../assets/partners/d-behavior.png';
import dHospital from '../../assets/partners/d-hospital.png';
import dPolicy from '../../assets/partners/d-policy.png';
import './MainPage.css';

const GAMES = [
  { key: 'kor', icon: 'ph-book-open', name: '국어', tag: '읽기 · 낱말', desc: '낱말·문장·글의 속뜻을 익히는 오늘의 국어 한 판' },
  { key: 'eng', icon: 'ph-translate', name: '영어', tag: '단어 · 문법', desc: '단어·문장·문법으로 배우는 영어 한 판' },
  { key: 'math', icon: 'ph-plus-minus', name: '수학', tag: '연산 · 도형', desc: '수·연산·도형·측정을 배우는 수학 한 판' },
  { key: 'sci', icon: 'ph-flask', name: '과학', tag: '관찰 · 탐구', desc: '그림을 관찰하고 탐구하는 과학 한 판' },
  { key: 'soc', icon: 'ph-scroll', name: '사회', tag: '이야기 · 지혜', desc: '옆날 이야기와 지혜를 만나는 사회 한 판' },
  { key: 'life', icon: 'ph-house-line', name: '생활', tag: '생활 · 안전', desc: '생활 속 안전과 지혜를 배우는 생활 한 판' },
];

const DATA_RECIPIENTS = [
  { key: 'hospital', img: dHospital, name: '어린이병동' },
  { key: 'behavior', img: dBehavior, name: '아동행동개발원' },
  { key: 'edu', img: dEduresearch, name: '아동교육연구원' },
  { key: 'dev', img: dBaldal, name: '발달지원센터' },
  { key: 'protect', img: dProtect, name: '아동보호협회' },
  { key: 'gov', img: dPolicy, name: '지자체아동정책과' },
];

const PARTNERS = [
  { key: 'p1', img: pChamjal, name: '참잘북스' },
  { key: 'p2', img: pTtokttok, name: '똑똑수학' },
  { key: 'p3', img: pHanbit, name: '한빛에듀' },
  { key: 'p4', img: pYeollin, name: '열린책들쿨' },
  { key: 'p5', img: pIbook, name: '아이북클럽' },
  { key: 'p6', img: pMiraen, name: '미래엔키즈' },
  { key: 'p7', img: pCube, name: '큐브러닝' },
  { key: 'p8', img: pParang, name: '파랑연필' },
  { key: 'p9', img: pHaneul, name: '하늘국어' },
  { key: 'p10', img: pDegul, name: '데굴수학' },
];

export default function MainPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  useRevealOnScroll(rootRef);
  return (
    <div className="mn-page" ref={rootRef}>
      {/* NAV */}
      <div className="mn-nav">
        <div className="mn-nav-inner">
          <div className="mn-brand">
            <img src={mascot} alt="CatChap" className="mn-brand-logo" />
            <span className="mn-brand-name">CatChap</span>
          </div>
          <nav className="mn-nav-menu">
            <a href="#about" className="mn-nav-link">서비스 소개</a>
            <a href="#games" className="mn-nav-link">학습 놀이</a>
            <a href="#roles" className="mn-nav-link">이용 대상</a>
            <a href="#how" className="mn-nav-link">이용 방법</a>
          </nav>
          <div className="mn-nav-right">
            <Link to={PATHS.CONTACT} className="mn-contact-link"><i className="ph-fill ph-chat-circle-text" />문의하기</Link>
            <Link to={PATHS.LOGIN} className="mn-login-link">로그인</Link>
          </div>
        </div>
      </div>

      {/* HERO */}
      <section className="mn-hero">
        <div className="mn-hero-left cc-reveal-group">
          <span className="mn-hero-badge"><i className="ph-fill ph-paw-print" />캡차 기반 어린이 교육 게임</span>
          <h1 className="mn-hero-title">고양이와 함께<br />놀면서 배우는<br /><span className="mn-hero-title-accent">캡챠 교육 게임</span></h1>
          <p className="mn-hero-desc">CatChap은 ‘사람인지 확인하는 캡챠’를 국어·수학·영어 같은 과목 미니게임으로 바꿔준 어린이 교육 서비스예요. 아이는 그림 고르기·문제 풀이로 놀며 배우고, 부모님과 선생님은 학습 성장을 한눈에 확인해요.</p>
          <div className="mn-hero-cta-row">
            <button className="mn-hero-cta"><i className="ph-fill ph-play-circle" />서비스 둘러보기</button>
          </div>
          <div className="mn-hero-stats">
            <div><div className="mn-stat-num">6가지</div><div className="mn-stat-label">학습 놀이 유형</div></div>
            <div className="mn-stat-divider"></div>
            <div><div className="mn-stat-num mn-stat-num--orange">3가지</div><div className="mn-stat-label">역할별 화면</div></div>
            <div className="mn-stat-divider"></div>
            <div><div className="mn-stat-num mn-stat-num--green">안전</div><div className="mn-stat-label">데이터 보호 우선</div></div>
          </div>
        </div>
        <div className="mn-hero-visual cc-reveal">
          <div className="mn-hero-blob1"></div>
          <div className="mn-hero-blob2"></div>
          <div className="mn-hero-mascot"><img src={mascot} alt="CatChap 마스코트" /></div>
          <div className="mn-hero-chip mn-hero-chip--cat"><i className="ph-fill ph-cat" /><span>고양이만 골라요!</span></div>
          <div className="mn-hero-chip mn-hero-chip--star"><i className="ph-fill ph-star" /><span>참 잘했어요!</span></div>
        </div>
      </section>

      {/* VALUE PROPS */}
      <section id="about" className="mn-about">
        <div className="mn-about-head cc-reveal">
          <span className="mn-eyebrow">WHY CATCHAP</span>
          <h2 className="mn-about-title">캡챠가 학습이 되는 순간</h2>
        </div>
        <div className="mn-vp-grid cc-reveal-group">
          <div className="mn-vp-card">
            <span className="mn-vp-icon mn-vp-icon--red"><i className="ph-fill ph-puzzle-piece" /></span>
            <h3 className="mn-vp-title">놀이형 학습</h3>
            <p className="mn-vp-text">한글·숫자·그림 문제를 놀이처럼 풀며, 지루하지 않게 개념을 익혀요.</p>
          </div>
          <div className="mn-vp-card">
            <span className="mn-vp-icon mn-vp-icon--blue"><i className="ph-fill ph-chart-line-up" /></span>
            <h3 className="mn-vp-title">행동 데이터 분석</h3>
            <p className="mn-vp-text">푸는 과정의 드래그·속도·재시도를 분석해 개념·조작·습관을 이해해요.</p>
          </div>
          <div className="mn-vp-card">
            <span className="mn-vp-icon mn-vp-icon--green"><i className="ph-fill ph-shield-check" /></span>
            <h3 className="mn-vp-title">안전한 데이터 보호</h3>
            <p className="mn-vp-text">인증과 학습 데이터를 분리하고, 아이 정보는 가명·최소 수집으로 지켜요.</p>
          </div>
        </div>
      </section>

      {/* GAMES */}
      <section id="games" className="mn-games">
        <div className="mn-games-inner">
          <div className="mn-games-head cc-reveal">
            <span className="mn-eyebrow">LEARNING PLAY</span>
            <h2 className="mn-games-title">6가지 학습 과목</h2>
            <p className="mn-sec-sub">국어·영어·수학·과학·사회·생활을 매일 하나씩 놀이처럼 배워요</p>
          </div>
          <div className="mn-games-grid cc-reveal-group">
            {GAMES.map((g) => (
              <div key={g.key} className="mn-game-card">
                <div className="mn-game-head">
                  <span className={`mn-game-icon mn-game-icon--${g.key}`}><i className={`ph-fill ${g.icon}`} /></span>
                  <div>
                    <div className="mn-game-name">{g.name}</div>
                    <div className={`mn-game-tag mn-game-tag--${g.key}`}>{g.tag}</div>
                  </div>
                </div>
                <p className="mn-game-desc">{g.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROLES */}
      <section id="roles" className="mn-roles">
        <div className="mn-roles-head cc-reveal">
          <span className="mn-eyebrow">FOR EVERYONE</span>
          <h2 className="mn-roles-title">모두를 위한 화면</h2>
          <p className="mn-sec-sub">같은 데이터를 학생·학부모·기관에게 목적에 맞게 다르게 보여줘요</p>
        </div>
        <div className="mn-roles-grid cc-reveal-group">
          <div className="mn-role-card mn-role-card--student">
            <div className="mn-role-bubble"></div>
            <span className="mn-role-icon"><i className="ph-fill ph-student" /></span>
            <h3 className="mn-role-title">학생</h3>
            <p className="mn-role-desc">오늘의 학습, 나의 성장, 배지를 성장 중심의 쉬운 말로 만나요.</p>
            <div className="mn-role-list">
              <span className="mn-role-item"><i className="ph-fill ph-check-circle" />오늘의 학습·연속 기록</span>
              <span className="mn-role-item"><i className="ph-fill ph-check-circle" />강점·연습 추천</span>
              <span className="mn-role-item"><i className="ph-fill ph-check-circle" />배지·성장 단계</span>
            </div>
          </div>
          <div className="mn-role-card mn-role-card--parent">
            <div className="mn-role-bubble"></div>
            <span className="mn-role-icon"><i className="ph-fill ph-users-three" /></span>
            <h3 className="mn-role-title">학부모</h3>
            <p className="mn-role-desc">자녀의 주간 요약과 강점·취약점을 쉬운 설명으로 확인해요.</p>
            <div className="mn-role-list">
              <span className="mn-role-item"><i className="ph-fill ph-check-circle" />다자녀 전환·주간 요약</span>
              <span className="mn-role-item"><i className="ph-fill ph-check-circle" />쉬운 말 오답 원인</span>
              <span className="mn-role-item"><i className="ph-fill ph-check-circle" />리포트 다운로드</span>
            </div>
          </div>
          <div className="mn-role-card mn-role-card--org">
            <div className="mn-role-bubble"></div>
            <span className="mn-role-icon"><i className="ph-fill ph-buildings" /></span>
            <h3 className="mn-role-title">기관</h3>
            <p className="mn-role-desc">학급·학생, 연령별 분석, API·보안까지 기관 전체를 한눈에 관리해요.</p>
            <div className="mn-role-list">
              <span className="mn-role-item"><i className="ph-fill ph-check-circle" />연령별·통합 시각화</span>
              <span className="mn-role-item"><i className="ph-fill ph-check-circle" />학급·권한 관리</span>
              <span className="mn-role-item"><i className="ph-fill ph-check-circle" />API·보안 요약</span>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="mn-how">
        <div className="mn-how-inner">
          <div className="mn-how-head cc-reveal">
            <span className="mn-eyebrow">HOW IT WORKS</span>
            <h2 className="mn-how-title">이렇게 작동해요</h2>
          </div>
          <div className="mn-how-row cc-reveal-group">
            <div className="mn-step-card">
              <div className="mn-step-label">STEP 1</div>
              <span className="mn-step-icon mn-step-icon--1"><i className="ph-fill ph-cursor-click" /></span>
              <h3 className="mn-step-title">문제를 풀어요</h3>
              <p className="mn-step-desc">위젯에서 그림을 고르고 카드를 끌어놓아요</p>
            </div>
            <div className="mn-step-arrow"><i className="ph-bold ph-arrow-right" /></div>
            <div className="mn-step-card">
              <div className="mn-step-label">STEP 2</div>
              <span className="mn-step-icon mn-step-icon--2"><i className="ph-fill ph-waveform" /></span>
              <h3 className="mn-step-title">행동을 모아요</h3>
              <p className="mn-step-desc">경로·속도·재시도를 표준화해 수집해요</p>
            </div>
            <div className="mn-step-arrow"><i className="ph-bold ph-arrow-right" /></div>
            <div className="mn-step-card">
              <div className="mn-step-label">STEP 3</div>
              <span className="mn-step-icon mn-step-icon--3"><i className="ph-fill ph-git-fork" /></span>
              <h3 className="mn-step-title">나눠 분석해요</h3>
              <p className="mn-step-desc">학습·조작·보안 신호를 따로 구분해요</p>
            </div>
            <div className="mn-step-arrow"><i className="ph-bold ph-arrow-right" /></div>
            <div className="mn-step-card">
              <div className="mn-step-label">STEP 4</div>
              <span className="mn-step-icon mn-step-icon--4"><i className="ph-fill ph-squares-four" /></span>
              <h3 className="mn-step-title">화면으로 보여줘요</h3>
              <p className="mn-step-desc">역할별 대시보드에 맞춤 요약을 제공해요</p>
            </div>
          </div>
        </div>
      </section>

      {/* DATA RECIPIENTS */}
      <section className="mn-data">
        <div className="mn-data-panel">
          <div className="mn-data-bubble"></div>
          <div className="mn-data-head cc-reveal">
            <span className="mn-data-badge"><i className="ph-fill ph-heartbeat" />안전한 데이터 활용</span>
            <h2 className="mn-data-title">아이들의 행동 데이터가 이렇게 쓰여요</h2>
            <p className="mn-data-desc">학습 중 수집된 아동 행동 데이터는 가명 처리를 거쳐, 아이들의 발달과 건강을 돕는 전문 기관들에 안전하게 전달돼요. 연구와 돌봄에만 쓰이고 상업적 목적으로는 활용되지 않아요.</p>
          </div>
          <div className="mn-marquee-mask mn-data-marquee">
            <div className="mn-marquee">
              {DATA_RECIPIENTS.map((d) => (
                <div key={d.key} className="mn-partner mn-partner--img">
                  <img src={d.img} alt={d.name} className="mn-partner-logo" loading="lazy" />
                </div>
              ))}
              {DATA_RECIPIENTS.map((d) => (
                <div key={`dup-${d.key}`} aria-hidden="true" className="mn-partner mn-partner--img">
                  <img src={d.img} alt="" className="mn-partner-logo" loading="lazy" />
                </div>
              ))}
            </div>
          </div>
          <div className="mn-data-note">
            <i className="ph-fill ph-lock-key" />
            <span>모든 데이터는 이름·연락처를 제거한 가명 정보로 전달되며, 보호자는 언제든 데이터 제공에 동의를 철회할 수 있어요.</span>
          </div>
        </div>
      </section>

      {/* PARTNERS */}
      <section className="mn-partners">
        <div className="mn-partners-head cc-reveal">
          <span className="mn-partners-badge"><i className="ph-fill ph-handshake" />함께하는 협력사</span>
          <h2 className="mn-partners-title">믿을 수 있는 문제집 파트너들과 함께해요</h2>
          <p className="mn-partners-sub">전국 어린이 학습 콘텐츠 파트너사가 CatChap과 연동돼요.</p>
        </div>
        <div className="mn-marquee-mask">
          <div className="mn-marquee">
            {PARTNERS.map((p) => (
              <div key={p.key} className="mn-partner mn-partner--img">
                <img src={p.img} alt={p.name} className="mn-partner-logo" loading="lazy" />
              </div>
            ))}
            {PARTNERS.map((p) => (
              <div key={`dup-${p.key}`} aria-hidden="true" className="mn-partner mn-partner--img">
                <img src={p.img} alt="" className="mn-partner-logo" loading="lazy" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mn-footer">
        <div className="mn-footer-inner">
          <div className="mn-footer-brand">
            <img src={mascot} alt="CatChap" className="mn-footer-logo" />
            <div>
              <div className="mn-footer-name">CatChap</div>
              <div className="mn-footer-tagline">놀면서 배우는 어린이 캡챠 학습</div>
            </div>
          </div>
          <div className="mn-footer-links">
            <a href="#about" className="mn-footer-link">서비스 소개</a>
            <Link to={PATHS.PRIVACY} className="mn-footer-link">개인정보 보호</Link>
            <Link to={PATHS.TERMS} className="mn-footer-link">이용약관</Link>
          </div>
        </div>
        <p className="mn-footer-copy">© 2026 CatChap · 카카오클라우드 AIaaS 마스터 클래스 5기. 어린이의 학습 데이터는 안전하게 보호됩니다.</p>
      </footer>
    </div>
  );
}
