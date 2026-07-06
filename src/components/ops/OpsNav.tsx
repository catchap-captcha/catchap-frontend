import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { PATHS } from '../../routes/paths';
import mascot from '../../assets/characters/catchap-logo.png';

/** 운영 콘솔 공용 상단 네비게이션 (모든 ops 페이지가 공유) */
const LINKS = [
  { to: PATHS.OPS_APPROVAL, icon: 'ph-buildings', label: '기관 승인' },
  { to: PATHS.OPS_ORGS, icon: 'ph-list-checks', label: '기관 목록' },
  { to: PATHS.OPS_INQUIRIES, icon: 'ph-chat-circle-dots', label: '문의 관리' },
  { to: PATHS.OPS_LOGS, icon: 'ph-scroll', label: '감사 로그' },
];

export default function OpsNav() {
  const { pathname } = useLocation();
  const { me, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate(PATHS.HOME, { replace: true });
  };

  return (
    <header className="op-nav">
      <div className="op-nav-inner">
        <Link to={PATHS.OPS_APPROVAL} className="op-brand">
          <img src={mascot} alt="CatChap" className="op-brand-logo" />
          <div>
            <div className="op-brand-name">CatChap</div>
            <div className="op-brand-sub">운영 콘솔</div>
          </div>
        </Link>
        <nav className="op-nav-menu">
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={'op-nav-link' + (pathname === l.to ? ' op-nav-link--on' : '')}
            >
              <i className={`ph-fill ${l.icon}`} />
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="op-nav-right">
          <span className="op-nav-badge">
            <i className="ph-fill ph-shield-star" />
            운영자
          </span>
          <span className="op-nav-user">{me?.name ?? '운영자'}</span>
          <button type="button" className="op-nav-logout" onClick={onLogout}>
            <i className="ph-fill ph-sign-out" />
            로그아웃
          </button>
        </div>
      </div>
    </header>
  );
}
