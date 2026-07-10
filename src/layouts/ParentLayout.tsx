import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PATHS } from '../routes/paths';
import { useAuth } from '../hooks/useAuth';
import mascot from '../assets/characters/catchap-logo.png';
import './ParentLayout.css';

/**
 * 학부모 센터 공통 sticky NAV — CatChap 학부모.dc.html NAV 원본 그대로.
 * - 활성 메뉴는 route 기준으로 자동 결정.
 * - 벨 슬롯(bell)은 페이지가 넘긴다(학부모 홈: 드롭다운 벨 / 그 외: <ParentBellLink> 등 / 상담 AI: 없음 — 원본 기준).
 * - 페이지 배경/하단 여백은 원본별로 달라 className으로 페이지 CSS가 정의한다.
 */

/** 링크형 벨(원본: 리포트·마이페이지 dot 없음 / 도윤 홈 dot 있음) */
export function ParentBellLink({ dot = false }: { dot?: boolean }) {
  return (
    <Link to={PATHS.PARENT_NOTIFICATIONS} title="알림" className="pl-bell-link">
      <i className="ph-fill ph-bell" />
      {dot && <span className="pl-bell-dot" />}
    </Link>
  );
}

interface ParentLayoutProps {
  /** NAV 우측 벨 슬롯 — 없으면 벨 미표시(원본: 상담 AI) */
  bell?: ReactNode;
  /** 페이지 배경/패딩용 루트 클래스(페이지 CSS에서 정의) */
  className?: string;
  children: ReactNode;
}

export default function ParentLayout({ bell, className, children }: ParentLayoutProps) {
  const { me } = useAuth();
  const { pathname } = useLocation();
  const name = me?.name || '김서연';
  const [menuOpen, setMenuOpen] = useState(false); // 모바일 햄버거 메뉴 열림 상태

  const menu = [
    { label: '주간 요약', to: PATHS.PARENT_HOME },
    { label: '리포트', to: PATHS.PARENT_REPORTS },
    { label: '상담 AI', to: PATHS.PARENT_COUNSEL_AI },
  ];

  return (
    <div className={'pl-root' + (className ? ` ${className}` : '')}>
      <div className="pl-nav">
        <div className="pl-nav-inner">
          <Link to={PATHS.PARENT_HOME} className="pl-logo" style={{ textDecoration: 'none', color: 'inherit' }}>
            <img src={mascot} alt="CatChap" />
            <div className="pl-logo-text">
              <span className="pl-logo-name">CatChap</span>
              <span className="pl-logo-sub">학부모 센터</span>
            </div>
          </Link>
          <nav className={'pl-menu' + (menuOpen ? ' pl-menu-open' : '')}>
            {menu.map((it) => (
              <Link
                key={it.label}
                to={it.to}
                className={'pl-menu-link' + (pathname === it.to ? ' pl-active' : '')}
                onClick={() => setMenuOpen(false)}
              >
                {it.label}
              </Link>
            ))}
          </nav>
          <button
            type="button"
            className={'pl-burger' + (menuOpen ? ' pl-burger-open' : '')}
            aria-label="메뉴 열기"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
          <div className="pl-right">
            {bell}
            <Link
              to={PATHS.PARENT_MYPAGE}
              title="마이페이지"
              className={
                'pl-profile' + (pathname === PATHS.PARENT_MYPAGE ? ' pl-profile-active' : '')
              }
            >
              <div className="pl-profile-avatar">
                <i className="ph-fill ph-user" />
              </div>
              <span className="pl-profile-name">{name} 학부모</span>
            </Link>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
