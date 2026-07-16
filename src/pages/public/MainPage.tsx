import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { useRevealOnScroll } from '../../hooks/useRevealOnScroll';
import mascot from '../../assets/characters/catchap-logo.png';
import './MainPage.css';

const GAMES = [
  { key: 'kor', icon: 'ph-book-open', name: '국어', tag: '읽기 · 낱말', desc: '글자와 낱말을 배우는 오늘의 국어 강의 한 편' },
  { key: 'eng', icon: 'ph-translate', name: '영어', tag: '단어 · 문법', desc: '알파벳과 쉬운 단어를 배우는 영어 강의 한 편' },
  { key: 'math', icon: 'ph-plus-minus', name: '수학', tag: '연산 · 도형', desc: '수와 셈을 재미있게 배우는 수학 강의 한 편' },
  { key: 'sci', icon: 'ph-flask', name: '과학', tag: '관찰 · 탐구', desc: '그림으로 관찰하고 탐구하는 과학 강의 한 편' },
  { key: 'soc', icon: 'ph-scroll', name: '사회', tag: '이야기 · 지혜', desc: '학교와 마을, 민주주의를 배우는 사회 강의 한 편' },
  { key: 'life', icon: 'ph-house-line', name: '생활', tag: '생활 · 안전', desc: '생활 속 안전과 지혜를 배우는 생활 강의 한 편' },
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
            <a href="#games" className="mn-nav-link">강의 과목</a>
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
          <span className="mn-hero-badge"><i className="ph-fill ph-paw-print" />영상 시청을 검증하는 강의 플랫폼</span>
          <h1 className="mn-hero-title">틀어만 놓는 인강은<br />이제 그만,<br /><span className="mn-hero-title-accent">시청을 검증하는 강의</span></h1>
          <p className="mn-hero-desc">CatChap은 영상 시청을 검증하는 강의 플랫폼이에요. 강의 중간중간 그 강의 내용으로 만든 확인 문제가 나와 실제로 보고 있는지 확인해요. 학습자는 놓치는 부분 없이 배우고, 기관은 시청 완료를 믿을 수 있어요.</p>
          <div className="mn-hero-cta-row">
            <button className="mn-hero-cta"><i className="ph-fill ph-play-circle" />서비스 둘러보기</button>
          </div>
          <div className="mn-hero-stats">
            <div><div className="mn-stat-num">6과목</div><div className="mn-stat-label">과목별 강의</div></div>
            <div className="mn-stat-divider"></div>
            <div><div className="mn-stat-num mn-stat-num--orange">시청 중</div><div className="mn-stat-label">확인 문제 게이트</div></div>
            <div className="mn-stat-divider"></div>
            <div><div className="mn-stat-num mn-stat-num--green">안전</div><div className="mn-stat-label">데이터 보호 우선</div></div>
          </div>
        </div>
        <div className="mn-hero-visual cc-reveal">
          <div className="mn-hero-blob1"></div>
          <div className="mn-hero-blob2"></div>
          <div className="mn-hero-mascot"><img src={mascot} alt="CatChap 마스코트" /></div>
          <div className="mn-hero-chip mn-hero-chip--cat"><i className="ph-fill ph-seal-question" /><span>확인 문제 통과!</span></div>
          <div className="mn-hero-chip mn-hero-chip--star"><i className="ph-fill ph-monitor-play" /><span>끝까지 봤어요!</span></div>
        </div>
      </section>

      {/* VALUE PROPS */}
      <section id="about" className="mn-about">
        <div className="mn-about-head cc-reveal">
          <span className="mn-eyebrow">WHY CATCHAP</span>
          <h2 className="mn-about-title">시청이 검증이 되는 순간</h2>
        </div>
        <div className="mn-vp-grid cc-reveal-group">
          <div className="mn-vp-card">
            <span className="mn-vp-icon mn-vp-icon--red"><i className="ph-fill ph-monitor-play" /></span>
            <h3 className="mn-vp-title">시청 검증 게이트</h3>
            <p className="mn-vp-text">재생 중 무작위 시점에 그 강의의 확인 문제가 나와요. 건너뛰기·과속 재생은 서버가 막아요.</p>
          </div>
          <div className="mn-vp-card">
            <span className="mn-vp-icon mn-vp-icon--blue"><i className="ph-fill ph-chart-line-up" /></span>
            <h3 className="mn-vp-title">행동 데이터 분석</h3>
            <p className="mn-vp-text">문제를 푸는 과정의 속도·재시도를 분석해 학습자의 이해와 습관을 파악해요.</p>
          </div>
          <div className="mn-vp-card">
            <span className="mn-vp-icon mn-vp-icon--green"><i className="ph-fill ph-shield-check" /></span>
            <h3 className="mn-vp-title">안전한 데이터 보호</h3>
            <p className="mn-vp-text">인증과 시청 데이터를 분리하고, 학습자 정보는 가명·최소 수집으로 지켜요.</p>
          </div>
        </div>
      </section>

      {/* GAMES → 강의 과목 */}
      <section id="games" className="mn-games">
        <div className="mn-games-inner">
          <div className="mn-games-head cc-reveal">
            <span className="mn-eyebrow">LECTURES</span>
            <h2 className="mn-games-title">6과목 강의</h2>
            <p className="mn-sec-sub">국어·영어·수학·과학·사회·생활을 매일 한 편씩, 확인 문제와 함께 배워요</p>
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
          <p className="mn-sec-sub">같은 시청 데이터를 학습자·보호자·기관에게 목적에 맞게 다르게 보여줘요</p>
        </div>
        <div className="mn-roles-grid cc-reveal-group">
          <div className="mn-role-card mn-role-card--student">
            <div className="mn-role-bubble"></div>
            <span className="mn-role-icon"><i className="ph-fill ph-student" /></span>
            <h3 className="mn-role-title">학습자</h3>
            <p className="mn-role-desc">오늘의 강의, 시청 진행, 확인 문제 기록을 쉬운 말로 만나요.</p>
            <div className="mn-role-list">
              <span className="mn-role-item"><i className="ph-fill ph-check-circle" />오늘의 강의·이어보기</span>
              <span className="mn-role-item"><i className="ph-fill ph-check-circle" />시청 중 확인 문제</span>
              <span className="mn-role-item"><i className="ph-fill ph-check-circle" />본 데까지 이어서 재생</span>
            </div>
          </div>
          <div className="mn-role-card mn-role-card--parent">
            <div className="mn-role-bubble"></div>
            <span className="mn-role-icon"><i className="ph-fill ph-users-three" /></span>
            <h3 className="mn-role-title">보호자</h3>
            <p className="mn-role-desc">학습자의 주간 시청 요약과 강점·취약점을 쉬운 설명으로 확인해요.</p>
            <div className="mn-role-list">
              <span className="mn-role-item"><i className="ph-fill ph-check-circle" />주간 시청 요약</span>
              <span className="mn-role-item"><i className="ph-fill ph-check-circle" />쉬운 말 학습 리포트</span>
              <span className="mn-role-item"><i className="ph-fill ph-check-circle" />리포트 다운로드</span>
            </div>
          </div>
          <div className="mn-role-card mn-role-card--org">
            <div className="mn-role-bubble"></div>
            <span className="mn-role-icon"><i className="ph-fill ph-buildings" /></span>
            <h3 className="mn-role-title">기관</h3>
            <p className="mn-role-desc">강의·수강생, 시청 완료 검증, API·보안까지 기관 전체를 한눈에 관리해요.</p>
            <div className="mn-role-list">
              <span className="mn-role-item"><i className="ph-fill ph-check-circle" />시청 완료 검증 리포트</span>
              <span className="mn-role-item"><i className="ph-fill ph-check-circle" />강의·권한 관리</span>
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
              <span className="mn-step-icon mn-step-icon--1"><i className="ph-fill ph-monitor-play" /></span>
              <h3 className="mn-step-title">강의를 봐요</h3>
              <p className="mn-step-desc">과목별 강의를 골라 이어서 시청해요</p>
            </div>
            <div className="mn-step-arrow"><i className="ph-bold ph-arrow-right" /></div>
            <div className="mn-step-card">
              <div className="mn-step-label">STEP 2</div>
              <span className="mn-step-icon mn-step-icon--2"><i className="ph-fill ph-seal-question" /></span>
              <h3 className="mn-step-title">확인 문제를 풀어요</h3>
              <p className="mn-step-desc">무작위 시점에 강의 내용 문제가 나와요</p>
            </div>
            <div className="mn-step-arrow"><i className="ph-bold ph-arrow-right" /></div>
            <div className="mn-step-card">
              <div className="mn-step-label">STEP 3</div>
              <span className="mn-step-icon mn-step-icon--3"><i className="ph-fill ph-shield-check" /></span>
              <h3 className="mn-step-title">시청을 검증해요</h3>
              <p className="mn-step-desc">건너뛰기·과속·동시 재생을 서버가 확인해요</p>
            </div>
            <div className="mn-step-arrow"><i className="ph-bold ph-arrow-right" /></div>
            <div className="mn-step-card">
              <div className="mn-step-label">STEP 4</div>
              <span className="mn-step-icon mn-step-icon--4"><i className="ph-fill ph-squares-four" /></span>
              <h3 className="mn-step-title">기록으로 보여줘요</h3>
              <p className="mn-step-desc">역할별 화면에 시청·학습 요약을 제공해요</p>
            </div>
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
              <div className="mn-footer-tagline">영상 시청을 검증하는 강의 플랫폼</div>
            </div>
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
