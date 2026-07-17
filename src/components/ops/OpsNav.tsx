import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { PATHS } from '../../routes/paths';
import mascot from '../../assets/characters/catchap-logo.png';

/** 운영 콘솔 공용 사이드바 (모든 ops 페이지가 공유).
 *
 *  상단 가로 네비는 메뉴 11개에서 이미 잘려 가로 스크롤로 새고 있었다 — 실무 콘솔
 *  표준인 좌측 사이드바 + 업무 영역 그룹으로 바꾼다(기관·교사 콘솔의 사이드바와도
 *  한 계열). 좁은 화면(≤1080px)에서는 아이콘 레일(64px)로 접혀 전 메뉴가 유지된다. */
const GROUPS: { label: string; items: { to: string; icon: string; label: string }[] }[] = [
  {
    label: '운영',
    items: [
      { to: PATHS.OPS_APPROVAL, icon: 'ph-buildings', label: '기관 승인' },
      { to: PATHS.OPS_ORGS, icon: 'ph-list-checks', label: '기관 관리' },
      { to: PATHS.OPS_INQUIRIES, icon: 'ph-chat-circle-dots', label: '문의 관리' },
    ],
  },
  {
    label: '강의',
    items: [{ to: PATHS.OPS_LECTURES, icon: 'ph-video-camera', label: '강의 관리' }],
  },
  {
    label: '데이터',
    items: [
      { to: PATHS.OPS_BEHAVIOR, icon: 'ph-fingerprint', label: '행동 데이터' },
      { to: PATHS.OPS_SCRATCH, icon: 'ph-pencil-line', label: '필기 집계' },
      { to: PATHS.OPS_BEHAVIOR_EXPORT, icon: 'ph-export', label: '외부 내보내기' },
      { to: PATHS.OPS_LOGS, icon: 'ph-scroll', label: '감사 로그' },
    ],
  },
  {
    label: '시스템',
    items: [
      { to: PATHS.OPS_API_KEYS, icon: 'ph-key', label: 'API 발급' },
      { to: PATHS.OPS_AI_MODELS, icon: 'ph-cpu', label: 'AI 모델' },
      { to: PATHS.OPS_SYSTEM, icon: 'ph-heartbeat', label: '시스템 상태' },
      { to: PATHS.OPS_SETTINGS, icon: 'ph-gear-six', label: '설정' },
    ],
  },
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
    <aside className="op-side" aria-label="운영 콘솔 메뉴">
      <Link to={PATHS.OPS_APPROVAL} className="op-side-brand">
        <img src={mascot} alt="CatChap" className="op-side-logo" />
        <div className="op-side-brandtext">
          <div className="op-side-name">CatChap</div>
          <div className="op-side-sub">운영 콘솔</div>
        </div>
      </Link>
      <nav className="op-side-menu">
        {GROUPS.map((g) => (
          <div key={g.label} className="op-side-group">
            <div className="op-side-grouplabel">{g.label}</div>
            {g.items.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                title={l.label}
                className={'op-side-link' + (pathname === l.to ? ' op-side-link--on' : '')}
                aria-current={pathname === l.to ? 'page' : undefined}
              >
                <i className={`ph-fill ${l.icon}`} />
                <span>{l.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="op-side-foot">
        <Link to={PATHS.OPS_OPERATORS} className="op-side-me" title="운영자 계정 관리">
          <span className="op-side-avatar">
            <i className="ph-fill ph-shield-star" />
          </span>
          <span className="op-side-mename">{me?.name ?? '운영자'}</span>
        </Link>
        <button type="button" className="op-side-logout" onClick={onLogout} title="로그아웃">
          <i className="ph-fill ph-sign-out" />
          <span>로그아웃</span>
        </button>
      </div>
    </aside>
  );
}
