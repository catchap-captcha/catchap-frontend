import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../routes/paths';
import { useAuth } from '../hooks/useAuth';
import { orgApi } from '../api/org';
import mascot from '../assets/characters/catchap-logo.png';
import './OrgLayout.css';

/**
 * 기관 콘솔 공용 사이드바 레이아웃 — handoff `CatChap 기관.dc.html` 사이드바 그대로.
 * 화면별로 다른 하단 위젯(Pro 요금제/새 학기/인사이트/컴플라이언스)은 widget prop으로 재현.
 * 프로필 카드 → 기관 마이페이지(원본 기관.dc.html 흐름), 마이페이지에서는 강조 스타일(profileHighlight).
 */

export type OrgMenuKey =
  | 'home'
  | 'classes'
  | 'students'
  | 'teachers'
  | 'analytics'
  | 'api'
  | 'apikeys'
  | 'ai'
  | 'security'
  | 'audit';

export type OrgSideWidget = 'pro' | 'semester' | 'insight' | 'compliance' | 'none';

const MENU: { key: OrgMenuKey; label: string; icon: string; to: string }[] = [
  { key: 'home', label: '기관 요약', icon: 'ph-fill ph-squares-four', to: PATHS.ORG_HOME },
  { key: 'classes', label: '학급 현황', icon: 'ph-fill ph-users-three', to: PATHS.ORG_CLASSES },
  { key: 'students', label: '학생 등록·코드', icon: 'ph-fill ph-identification-card', to: PATHS.ORG_STUDENTS },
  { key: 'teachers', label: '선생님 관리', icon: 'ph-fill ph-chalkboard-teacher', to: PATHS.ORG_TEACHERS },
  { key: 'analytics', label: '학습 분석', icon: 'ph-fill ph-chart-bar', to: PATHS.ORG_ANALYTICS },
  { key: 'api', label: 'API·사이트', icon: 'ph-fill ph-plugs-connected', to: PATHS.ORG_CAPTCHA_SETTINGS },
  { key: 'apikeys', label: 'API 키 발급', icon: 'ph-fill ph-key', to: PATHS.ORG_API_KEYS },
  { key: 'ai', label: 'AI 모델', icon: 'ph-fill ph-cpu', to: PATHS.ORG_AI_MODELS },
  { key: 'security', label: '보안·정책', icon: 'ph-fill ph-shield-check', to: PATHS.ORG_SECURITY_POLICY },
  { key: 'audit', label: '활동 기록', icon: 'ph-fill ph-clock-counter-clockwise', to: PATHS.ORG_AUDIT },
];

const WIDGETS: Record<
  Exclude<OrgSideWidget, 'none'>,
  { cls: string; title: string; sub: string; bar: boolean }
> = {
  pro: {
    cls: 'ol-widgetPro',
    title: 'Pro 요금제',
    sub: '이번 달 API 68% 사용',
    bar: true,
  },
  semester: {
    cls: 'ol-widgetSemester',
    title: '새 학기 준비',
    sub: '2026-2학기 담임 배정 · 12개 반 중 9개 완료',
    bar: true,
  },
  insight: {
    cls: 'ol-widgetInsight',
    title: '이번 주 인사이트',
    sub: '국어 정답률이 지난주 대비 +6%p 상승했어요.',
    bar: false,
  },
  compliance: {
    cls: 'ol-widgetCompliance',
    title: '컴플라이언스',
    sub: '개인정보보호법·아동 대상 처리 기준 준수 중',
    bar: false,
  },
};

/** GET /orgs/{id}/sidebar — 실패/로딩 중엔 WIDGETS 하드코딩 값 유지 */
interface OlSidebarData {
  pro?: { pct?: number; sub?: string; plan_name?: string };
  semester?: { done?: number; total?: number; pct?: number; sub?: string };
  insight?: { sub?: string };
}

interface OrgLayoutProps {
  active: OrgMenuKey | null;
  widget?: OrgSideWidget;
  /** 기관 마이페이지 원본: 프로필 카드 강조(#FFF0EE + #FFD9D2 테두리) */
  profileHighlight?: boolean;
  /** 기관 마이페이지 원본: 사이드바 기관명이 편집 중인 state와 연동 */
  orgNameOverride?: string;
  children: ReactNode;
}

export default function OrgLayout({
  active,
  widget = 'pro',
  profileHighlight = false,
  orgNameOverride,
  children,
}: OrgLayoutProps) {
  const { me } = useAuth();
  const orgId = me?.organization_id ?? null;
  // 프로필은 me fallback 원본 이름(햇살초등학교)
  const orgName = orgNameOverride ?? (me?.organization_name || '햇살초등학교');
  const [sidebar, setSidebar] = useState<OlSidebarData | null>(null);

  // 학년부장은 전교 집계(기관 요약·학습 분석)와 기관 전체 설정(API·AI·보안) 메뉴 숨김 — 담당 학년 학급/교사만
  const isGradeHead = me?.role === 'grade_head';
  const menuItems = isGradeHead
    ? MENU.filter((m) => !['home', 'analytics', 'api', 'apikeys', 'ai', 'security'].includes(m.key))
    : MENU;
  // 학년부장은 ORG_HOME 접근 불가 → 로고/링크는 학급·학생 화면으로
  const homePath = isGradeHead ? PATHS.ORG_CLASSES : PATHS.ORG_HOME;
  const roleLabel = isGradeHead
    ? `학년부장${me?.managed_grade ? ` · ${me.managed_grade}학년 담당` : ''}`
    : me?.role === 'ops'
      ? '운영자'
      : '기관 관리자(교장)';

  useEffect(() => {
    if (!orgId) return;
    let on = true;
    orgApi
      .sidebar(orgId)
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      .then((res: any) => {
        if (!on || !res || typeof res !== 'object') return;
        setSidebar(res as OlSidebarData);
      })
      .catch(() => {
        // TODO(api): 실패 시 WIDGETS 하드코딩 값 유지
      });
    return () => {
      on = false;
    };
  }, [orgId]);

  const w = widget === 'none' ? null : WIDGETS[widget];
  // 'compliance'는 정적 — pro/semester/insight만 API 값으로 덮어씀
  const remote =
    widget === 'pro' || widget === 'semester' || widget === 'insight' ? sidebar?.[widget] : null;
  const wSub = typeof remote?.sub === 'string' && remote.sub ? remote.sub : w?.sub;
  const wPct =
    remote && 'pct' in remote && typeof remote.pct === 'number' ? remote.pct : null;

  return (
    <div className="ol-page">
      <aside className="ol-side">
        <Link to={homePath} className="ol-logo">
          <img src={mascot} alt="CatChap" className="ol-logoImg" />
          <div className="ol-logoText">
            <div className="ol-logoName">CatChap</div>
            <div className="ol-logoSub">기관 콘솔</div>
          </div>
        </Link>
        {isGradeHead ? (
          // 학년부장: 기관 마이페이지(교장 전용) 링크 대신 비링크 카드
          <div className="ol-profile">
            <span className="ol-profileIcon">
              <i className="ph-fill ph-user-gear" />
            </span>
            <div className="ol-profileText">
              <div className="ol-profileName">{me?.name || orgName}</div>
              <div className="ol-profileRole">{roleLabel}</div>
            </div>
          </div>
        ) : (
          <Link
            to={PATHS.ORG_MYPAGE}
            className={profileHighlight ? 'ol-profile ol-profileOn' : 'ol-profile'}
          >
            <span className="ol-profileIcon">
              <i className="ph-fill ph-buildings" />
            </span>
            <div className="ol-profileText">
              <div className="ol-profileName">{orgName}</div>
              <div className="ol-profileRole">{roleLabel}</div>
            </div>
          </Link>
        )}
        {menuItems.map((m) => (
          <Link
            key={m.key}
            to={m.to}
            className={active === m.key ? 'ol-menu ol-menuOn' : 'ol-menu'}
          >
            <i className={m.icon} />
            {m.label}
          </Link>
        ))}
        <div className="ol-contact">
          <div className="ol-contactHead">
            <span className="ol-contactIcon">
              <i className="ph-fill ph-headset" />
            </span>
            <div className="ol-contactTitle">관리자 문의</div>
          </div>
          <div className="ol-contactDesc">계약·정산·기술 문의는 전담 매니저가 도와드려요.</div>
          <Link to={PATHS.ORG_CONTACT} className="ol-contactBtn">
            <i className="ph-fill ph-chat-circle-text" />
            문의하기
          </Link>
        </div>
        {w && (
          <div className={`ol-widget ${w.cls}`}>
            <div className="ol-widgetTitle">{w.title}</div>
            <div className="ol-widgetSub">{wSub}</div>
            {w.bar && (
              <div className="ol-widgetBar">
                {/* inline width가 CSS 고정폭(pro 68% / semester 75%)을 덮어씀 — API 없으면 CSS 유지 */}
                <div className="ol-widgetFill" style={wPct != null ? { width: `${wPct}%` } : undefined} />
              </div>
            )}
          </div>
        )}
      </aside>
      <main className="ol-main">{children}</main>
    </div>
  );
}
