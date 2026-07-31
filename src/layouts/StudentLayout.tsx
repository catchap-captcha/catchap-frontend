import { useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { PATHS } from '../routes/paths';
import { useAuth } from '../hooks/useAuth';
import { useUnreadNotifications } from '../hooks/useUnreadNotifications';
import ThemeToggle from '../components/common/ThemeToggle';
import { profileColor } from '../utils/profileColor';
import { useTheme } from '../hooks/useTheme';
import wordmark from '../assets/brand/catchap-wordmark.png';
import wordmarkWhite from '../assets/brand/catchap-wordmark-white.png';
import './StudentLayout.css';

/**
 * 학생 화면 공통 상단 NAV 레이아웃.
 * 성인 인강(이수·수료 검증형)으로 재편(2026-07-20): 옛 아동 마스코트·'개념 설명'(초등 커리큘럼)을
 * 걷어내고, 시청→연습→복습→수료 흐름에 맞춰 홈·강의·문제은행·나의 기록으로 구성한다.
 */
export type StudentNavKey = 'home' | 'lectures' | 'all' | 'records';

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
  const { theme } = useTheme();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false); // 모바일 햄버거 메뉴 열림 상태
  // 상단 카테고리 드롭다운(내 학습·수료) 열림 그룹. 운영 콘솔 상단바와 같은 방식.
  const [openGroup, setOpenGroup] = useState<string | null>(null);
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

  const name = (me?.name ?? '').trim() || '학습자';
  const closeMenu = () => {
    setMenuOpen(false);
    setOpenGroup(null);
  };

  // 활성 판정 — '나의 기록'과 '수료 현황'은 같은 /student/records라 tab 쿼리로 가른다.
  const path = location.pathname;
  const onCompletion =
    path === PATHS.STUDENT_RECORDS && searchParams.get('tab') === 'completion';
  const onRecords = path === PATHS.STUDENT_RECORDS && !onCompletion;
  const homeOn = active === 'home' || (active === undefined && path === PATHS.STUDENT_HOME);
  const learnOn =
    path === PATHS.STUDENT_MY_COURSES || path === PATHS.STUDENT_ALL_LEARNING || onRecords;

  // 상단바 그룹 — 운영 콘솔식 드롭다운. 비슷한 화면을 '내 학습'·'수료'로 묶는다.
  const GROUPS = [
    {
      key: 'learn',
      label: '내 학습',
      on: learnOn,
      items: [
        { to: PATHS.STUDENT_MY_COURSES, label: '내 강의', icon: 'ph-books', desc: '수강 중·진도·이어보기', on: path === PATHS.STUDENT_MY_COURSES },
        { to: PATHS.STUDENT_RECORDS, label: '나의 기록', icon: 'ph-chart-bar', desc: '학습 통계·달력', on: onRecords },
        { to: PATHS.STUDENT_ALL_LEARNING, label: '문제은행', icon: 'ph-cards-three', desc: '확인 문제 풀기', on: path === PATHS.STUDENT_ALL_LEARNING },
      ],
    },
    {
      key: 'cert',
      label: '수료',
      on: onCompletion,
      items: [
        { to: `${PATHS.STUDENT_RECORDS}?tab=completion`, label: '수료시험', icon: 'ph-exam', desc: '응시·수료 현황', on: onCompletion },
        { to: `${PATHS.STUDENT_RECORDS}?tab=completion`, label: '수료증', icon: 'ph-certificate', desc: '발급·다운로드', on: onCompletion },
      ],
    },
  ];

  return (
    <div className="sl-navbar">
      <div className="sl-navinner">
        <Link to={PATHS.STUDENT_HOME} className="sl-logo">
          <img
            src={theme === 'dark' ? wordmarkWhite : wordmark}
            alt="CATCHAP"
            className="sl-logomark"
          />
          <span className="sl-logosub">시청을 검증하는 강의 학습</span>
        </Link>
        <nav className={`sl-menu${menuOpen ? ' sl-menu-open' : ''}`}>
          {onHomeClick ? (
            <a
              href="#"
              onClick={() => { closeMenu(); onHomeClick(); }}
              className={`sl-navlink${homeOn ? ' sl-active' : ''}`}
            >
              홈
            </a>
          ) : (
            <Link
              to={PATHS.STUDENT_HOME}
              className={`sl-navlink${homeOn ? ' sl-active' : ''}`}
              onClick={closeMenu}
            >
              홈
            </Link>
          )}
          {GROUPS.map((g) => (
            <div
              key={g.key}
              className={`sl-navgroup${openGroup === g.key ? ' sl-navgroup-open' : ''}`}
              onMouseEnter={() => setOpenGroup(g.key)}
              onMouseLeave={() => setOpenGroup((k) => (k === g.key ? null : k))}
            >
              <button
                type="button"
                className={`sl-navlink sl-gbtn${g.on ? ' sl-active' : ''}`}
                onClick={() => setOpenGroup(openGroup === g.key ? null : g.key)}
                aria-expanded={openGroup === g.key}
              >
                {g.label}
                <i className="ph-bold ph-caret-down sl-caret" />
              </button>
              <div className="sl-groupmenu" role="menu">
                {g.items.map((it) => (
                  <Link
                    key={it.label}
                    to={it.to}
                    role="menuitem"
                    className={`sl-gitem${it.on ? ' sl-gitem-on' : ''}`}
                    onClick={closeMenu}
                  >
                    <i className={`ph-fill ${it.icon}`} />
                    <span className="sl-gitem-body">
                      <span className="sl-gitem-label">{it.label}</span>
                      <span className="sl-gitem-desc">{it.desc}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
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
          {/* 문의하기 — 프로필 왼쪽(사용자 요청). 아이콘만 있는 왼쪽 버튼들과 달리 글자를 두는
              이유는, 학생이 막혔을 때 찾는 출구라 아이콘만으로는 눈에 안 들어오기 때문이다. */}
          <Link to={PATHS.STUDENT_INQUIRY} title="문의하기" className="sl-contact">
            <i className="ph-fill ph-chat-circle-text" />
            <span className="sl-contact-label">문의하기</span>
          </Link>
          {/* 프로필 — 아바타 꾸미기 은퇴(0718)로 클릭은 설정으로 이동, hover 드롭다운은
              로그아웃만 노출(사용자 결정 0714 유지) */}
          <div
            className={`sl-profilewrap${profileOpen ? ' sl-profilewrap-open' : ''}`}
            onMouseEnter={() => setProfileOpen(true)}
            onMouseLeave={() => setProfileOpen(false)}
          >
            <Link to={PATHS.STUDENT_MYPAGE} title="마이페이지" className="sl-profile">
              <div className="sl-avatar" style={{ background: profileColor(me?.id) }}>
                <span className="sl-avatarinitial">{name.charAt(0)}</span>
              </div>
              <span className="sl-profilename">{name}</span>
            </Link>
            {/* 실서비스식 빠른 허브 — 마이페이지·설정·로그아웃(나의 기록은 상단 nav에 이미 있어 중복 제거) */}
            <div className="sl-dropdown" role="menu">
              <Link to={PATHS.STUDENT_MYPAGE} className="sl-dropitem" role="menuitem" onClick={() => setProfileOpen(false)}>
                <i className="ph-fill ph-user" /> 마이페이지
              </Link>
              <Link to={`${PATHS.STUDENT_MYPAGE}?tab=account`} className="sl-dropitem" role="menuitem" onClick={() => setProfileOpen(false)}>
                <i className="ph-fill ph-gear-six" /> 설정
              </Link>
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
    </div>
  );
}
