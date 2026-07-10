import { useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PATHS } from '../routes/paths';
import { useAuth } from '../hooks/useAuth';
import { useUnreadNotifications } from '../hooks/useUnreadNotifications';
import ScreenTimeReminder from '../components/motion/ScreenTimeReminder';
import mascot from '../assets/characters/catchap-logo.png';
import './StudentLayout.css';

/**
 * 학생 화면 공통 풀 NAV 레이아웃 — handoff `CatChap 학습 홈.dc.html`의 NAV 원본 그대로.
 * 활성 메뉴는 현재 route 기준(필요 시 `active` prop으로 재정의 — 학습 홈의 스크롤 연동용).
 */
export type StudentNavKey = 'home' | 'all' | 'concepts' | 'ai' | 'records';

interface AvatarState {
  bgCss: string;
  hasHat: boolean;
  hatIcon: string;
  hatColor: string;
}

/** 원본 renderVals()의 localStorage('catchap_avatar') 읽기 로직 그대로 */
function readAvatar(): AvatarState {
  let a: Record<string, unknown> = {};
  try {
    a = JSON.parse(localStorage.getItem('catchap_avatar') || '{}');
  } catch {
    /* 원본과 동일: 파싱 실패 시 기본값 */
  }
  return {
    bgCss: typeof a.bgCss === 'string' && a.bgCss ? a.bgCss : 'linear-gradient(135deg,#FFC24B,#FF8A5B)',
    hasHat: !!a.hasHat,
    hatIcon: typeof a.hatIcon === 'string' ? a.hatIcon : '',
    hatColor: typeof a.hatColor === 'string' && a.hatColor ? a.hatColor : '#FF5A4D',
  };
}

const ROUTE_ACTIVE: Record<string, StudentNavKey> = {
  [PATHS.STUDENT_HOME]: 'home',
  [PATHS.STUDENT_ALL_LEARNING]: 'all',
  [PATHS.STUDENT_CONCEPTS]: 'concepts',
  [PATHS.STUDENT_AI_TEACHER]: 'ai',
  [PATHS.STUDENT_RECORDS]: 'records',
};

export function StudentNav({
  active,
  onHomeClick,
}: {
  /** undefined면 현재 route로 판별. null이면 활성 없음(학습 홈 스크롤 상태). */
  active?: StudentNavKey | null;
  /** 학습 홈 전용: 원본 NAV의 `홈`(href="#" + goHome) 동작 재현 */
  onHomeClick?: () => void;
}) {
  const { me } = useAuth();
  const location = useLocation();
  const [avatar] = useState<AvatarState>(readAvatar);
  const [menuOpen, setMenuOpen] = useState(false); // 모바일 햄버거 메뉴 열림 상태
  const unread = useUnreadNotifications(); // 서버 read_at 기준 — 재로그인해도 유지

  const current = active === undefined ? (ROUTE_ACTIVE[location.pathname] ?? null) : active;
  const name = (me?.name ?? '하은').trim() || '하은';

  const cls = (key: StudentNavKey) => `sl-navlink${current === key ? ' sl-active' : ''}`;
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="sl-navbar">
      <div className="sl-navinner">
        <Link to={PATHS.STUDENT_HOME} className="sl-logo" style={{ textDecoration: 'none', color: 'inherit' }}>
          <img src={mascot} alt="CatChap" className="sl-logoimg" />
          <div className="sl-logotext">
            <span className="sl-logotitle">CatChap</span>
            <span className="sl-logosub">놀면서 배우는 캡챠 학습</span>
          </div>
        </Link>
        <nav className={`sl-menu${menuOpen ? ' sl-menu-open' : ''}`}>
          {onHomeClick ? (
            <a href="#" onClick={() => { closeMenu(); onHomeClick(); }} className={cls('home')}>
              홈
            </a>
          ) : (
            <Link to={PATHS.STUDENT_HOME} className={cls('home')} onClick={closeMenu}>
              홈
            </Link>
          )}
          <Link to={PATHS.STUDENT_ALL_LEARNING} className={cls('all')} onClick={closeMenu}>
            전체 학습
          </Link>
          <Link to={PATHS.STUDENT_CONCEPTS} className={cls('concepts')} onClick={closeMenu}>
            개념 설명
          </Link>
          <Link to={PATHS.STUDENT_AI_TEACHER} className={cls('ai')} onClick={closeMenu}>
            AI 선생님
          </Link>
          <Link to={PATHS.STUDENT_RECORDS} className={cls('records')} onClick={closeMenu}>
            나의 기록
          </Link>
        </nav>
        <button
          type="button"
          className={`sl-burger${menuOpen ? ' sl-burger-open' : ''}`}
          aria-label="메뉴 열기"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
        <div className="sl-right">
          <Link to={PATHS.STUDENT_SEARCH} title="검색" className="sl-iconbtn">
            <i className="ph-bold ph-magnifying-glass" />
          </Link>
          <Link to={PATHS.STUDENT_NOTIFICATIONS} title="알림" className="sl-iconbtn sl-bell">
            <i className="ph-fill ph-bell" />
            {unread > 0 && <span className="sl-belldot" />}
          </Link>
          <Link to={PATHS.STUDENT_PROFILE} title="마이 페이지" className="sl-profile">
            <div className="sl-avatar" style={{ background: avatar.bgCss }}>
              <img src={mascot} alt="" className="sl-avatarimg" />
              {avatar.hasHat && (
                <i className={`${avatar.hatIcon} sl-hat`} style={{ color: avatar.hatColor }} />
              )}
            </div>
            <span className="sl-profilename">{name}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function StudentLayout({
  active,
  onHomeClick,
  className,
  style,
  children,
}: {
  active?: StudentNavKey | null;
  onHomeClick?: () => void;
  /** 페이지 루트 컨테이너 클래스(배경 그라데이션 등 — 페이지 CSS가 정의) */
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div className={className} style={style}>
      <StudentNav active={active} onHomeClick={onHomeClick} />
      {children}
      <ScreenTimeReminder />
    </div>
  );
}
