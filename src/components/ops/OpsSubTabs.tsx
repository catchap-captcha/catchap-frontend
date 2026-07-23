import { Link, useLocation } from 'react-router-dom';
import { PATHS } from '../../routes/paths';

/** 운영 콘솔 서브탭 — 메뉴 병합(2026-07-23)으로 여러 페이지를 한 메뉴 아래 탭으로 묶는다.
 *  각 탭은 독립 라우트(페이지)라 로직을 건드리지 않고 상단에 링크 탭만 얹는다(GitHub 설정식). */
export type OpsTab = { to: string; label: string; icon?: string };

export const LLM_TABS: OpsTab[] = [
  { to: PATHS.OPS_LLM_MODELS, label: '모델', icon: 'ph-robot' },
  { to: PATHS.OPS_LLM_KEYS, label: 'API 키', icon: 'ph-lock-key' },
  { to: PATHS.OPS_LLM_PROMPTS, label: '프롬프트', icon: 'ph-chat-text' },
];

export const BEHAVIOR_TABS: OpsTab[] = [
  { to: PATHS.OPS_BEHAVIOR, label: '행동 데이터', icon: 'ph-fingerprint' },
  { to: PATHS.OPS_BEHAVIOR_EXPORT, label: '외부 내보내기', icon: 'ph-export' },
];

export const ORG_TABS: OpsTab[] = [
  { to: PATHS.OPS_APPROVAL, label: '가입 승인', icon: 'ph-seal-check' },
  { to: PATHS.OPS_ORGS, label: '기관 관리', icon: 'ph-list-checks' },
];

export default function OpsSubTabs({ tabs }: { tabs: OpsTab[] }) {
  const { pathname } = useLocation();
  return (
    <div className="op-subtabs" role="tablist">
      {tabs.map((t) => {
        const on = pathname === t.to;
        return (
          <Link
            key={t.to}
            to={t.to}
            className={'op-subtab' + (on ? ' op-subtab--on' : '')}
            role="tab"
            aria-selected={on}
          >
            {t.icon && <i className={`ph-fill ${t.icon}`} />}
            <span>{t.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
