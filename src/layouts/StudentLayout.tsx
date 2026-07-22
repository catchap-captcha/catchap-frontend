import { useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PATHS } from '../routes/paths';
import { useAuth } from '../hooks/useAuth';
import { useUnreadNotifications } from '../hooks/useUnreadNotifications';
import ScreenTimeReminder from '../components/motion/ScreenTimeReminder';
import ThemeToggle from '../components/common/ThemeToggle';
import { profileColor } from '../utils/profileColor';
import './StudentLayout.css';

/**
 * 학생 화면 공통 상단 NAV 레이아웃.
 * 성인 인강(이수·수료 검증형)으로 재편(2026-07-20): 옛 아동 마스코트·'개념 설명'(초등 커리큘럼)을
 * 걷어내고, 시청→연습→복습→수료 흐름에 맞춰 홈·강의·문제은행·나의 기록으로 구성한다.
 */
export type StudentNavKey = 'home' | 'lectures' | 'all' | 'records';

// 성인화(2026-07-20): '개념 설명'(초등 커리큘럼) 은퇴, '강의' 추가
const ROUTE_ACTIVE: Record<string, StudentNavKey> = {
  [PATHS.STUDENT_HOME]: 'home',
  [PATHS.STUDENT_LECTURES]: 'lectures',
  [PATHS.STUDENT_ALL_LEARNING]: 'all',
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
  const { me, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false); // 모바일 햄버거 메뉴 열림 상태
  const unread = useUnreadNotifications(); // 서버 read_at 기준 — 재로그인해도 유지

  // 프로필 드롭다운 — hover(데스크톱)와 클릭(터치) 모두 지원. 로그아웃을 어디서든 접근 가능하게.
  const [profileOpen, setProfileOpen] = useState(false);
  const doLogout = async () => {
    try {
      await logout();
    } finally {
      navigate(PATHS.LOGIN);
    }
  };

  const current = active === undefined ? (ROUTE_ACTIVE[location.pathname] ?? null) : active;
  const name = (me?.name ?? '').trim() || '학습자';

  const cls = (key: StudentNavKey) => `sl-navlink${current === key ? ' sl-active' : ''}`;
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="sl-navbar">
      <div className="sl-navinner">
        <Link to={PATHS.STUDENT_HOME} className="sl-logo" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="sl-logobadge">C</span>
          <div className="sl-logotext">
            <span className="sl-logotitle">CatChap</span>
            <span className="sl-logosub">시청을 검증하는 강의 학습</span>
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
          <Link to={PATHS.STUDENT_LECTURES} className={cls('lectures')} onClick={closeMenu}>
            강의
          </Link>
          <Link to={PATHS.STUDENT_ALL_LEARNING} className={cls('all')} onClick={closeMenu}>
            문제은행
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
          <ThemeToggle className="sl-iconbtn sl-theme" />
          <Link to={PATHS.STUDENT_SEARCH} title="검색" className="sl-iconbtn">
            <i className="ph-bold ph-magnifying-glass" />
          </Link>
          <Link to={PATHS.STUDENT_NOTIFICATIONS} title="알림" className="sl-iconbtn sl-bell">
            <i className="ph-fill ph-bell" />
            {unread > 0 && <span className="sl-belldot" />}
          </Link>
          {/* 프로필 — 아바타 꾸미기 은퇴(0718)로 클릭은 설정으로 이동, hover 드롭다운은
              로그아웃만 노출(사용자 결정 0714 유지) */}
          <div
            className={`sl-profilewrap${profileOpen ? ' sl-profilewrap-open' : ''}`}
            onMouseEnter={() => setProfileOpen(true)}
            onMouseLeave={() => setProfileOpen(false)}
          >
            <Link to={PATHS.STUDENT_SETTINGS} title="설정" className="sl-profile">
              <div className="sl-avatar" style={{ background: profileColor(me?.id) }}>
                <span className="sl-avatarinitial">{name.charAt(0)}</span>
              </div>
              <span className="sl-profilename">{name}</span>
            </Link>
            <div className="sl-dropdown" role="menu">
              <button type="button" className="sl-dropitem sl-dropitem-danger" role="menuitem" onClick={doLogout}>
                <i className="ph-fill ph-sign-out" /> 로그아웃
              </button>
            </div>
          </div>
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
