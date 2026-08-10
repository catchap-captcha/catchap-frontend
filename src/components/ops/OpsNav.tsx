import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { notificationApi, type Notification } from '../../api/notifications';
import {
  notifyNotificationsUpdated,
  useUnreadNotifications,
} from '../../hooks/useUnreadNotifications';
import { PATHS } from '../../routes/paths';
import wordmarkDark from '../../assets/brand/catchap-wordmark.png';
import wordmarkWhite from '../../assets/brand/catchap-wordmark-white.png';

/** 운영/강사 콘솔 공용 상단바 (모든 ops 페이지가 공유).
 *
 *  리뉴얼(2026-07-24): 좌측 사이드바 → 상단 가로 바 + 드롭다운 그룹으로 재구성한다
 *  (핸드오프: CatChap 운영 상단바 / 강사 상단바). 운영자는 3개 드롭다운 그룹
 *  (운영·데이터·시스템), 강사는 평평한 탭 4개(강사 홈·강의 관리·문항 검수·학습 분석).
 *  우측 클러스터는 알림·다크토글·아바타·로그아웃(기존 기능 보존). */
type NavItem = { to: string; icon: string; label: string; match?: string[] };
type NavGroup = { key: string; label: string; items: NavItem[] };

/** 운영자 상단바 — 드롭다운 3그룹(핸드오프 메뉴 구조 그대로).
 *  match: 그 항목을 활성/그룹활성으로 볼 형제 경로들(서브탭 페이지 포함). */
const GROUPS: NavGroup[] = [
  {
    key: 'ops',
    label: '운영',
    items: [
      { to: PATHS.OPS_APPROVAL, icon: 'ph-buildings', label: '기관 승인' },
      { to: PATHS.OPS_ORGS, icon: 'ph-list-checks', label: '기관 관리' },
      { to: PATHS.OPS_INSTRUCTORS, icon: 'ph-chalkboard-teacher', label: '강사 관리' },
      { to: PATHS.OPS_OPERATORS, icon: 'ph-shield-star', label: '운영자 계정' },
      { to: PATHS.OPS_INQUIRIES, icon: 'ph-chat-circle-dots', label: '문의 관리' },
      // 캡차를 풀 수 없어 로그인이 막힌 사용자의 최후 수단(잠금 해제·학생 임시 비밀번호)
      { to: PATHS.OPS_ACCOUNT_UNLOCK, icon: 'ph-lock-key-open', label: '계정 잠금 해제' },
    ],
  },
  {
    key: 'data',
    label: '데이터',
    items: [
      { to: PATHS.OPS_BEHAVIOR, icon: 'ph-fingerprint', label: '행동 데이터' },
      { to: PATHS.OPS_BEHAVIOR_EXPORT, icon: 'ph-export', label: '외부 내보내기' },
      { to: PATHS.OPS_LOGS, icon: 'ph-scroll', label: '감사 로그' },
    ],
  },
  {
    key: 'system',
    label: '시스템',
    items: [
      { to: PATHS.OPS_API_KEYS, icon: 'ph-key', label: 'API 발급' },
      // '설정' 우산을 걷고 그 안의 API 키·프롬프트를 시스템 드롭다운에 직접 노출한다(2026-08-08).
      // 셋(AI 모델·API 키·프롬프트)은 LLM 운영 묶음이라 나란히 둔다.
      { to: PATHS.OPS_LLM_MODELS, icon: 'ph-cpu', label: 'LLM 모델' },
      { to: PATHS.OPS_LLM_KEYS, icon: 'ph-key', label: 'API 키' },
      { to: PATHS.OPS_LLM_PROMPTS, icon: 'ph-note-pencil', label: '프롬프트' },
      { to: PATHS.OPS_MONITORING, icon: 'ph-gauge', label: '모니터링' },
      // '시스템 상태'는 ★지금 살아 있나(DB 왕복시간·SMTP·디스크 실측),
      // '시스템 경보'는 ★그동안 무슨 일이 있었나(감시 장치가 보낸 경보 이력·수신 설정).
      // 보는 시점이 달라 둘 다 둔다 — 상태는 현재, 경보는 지나간 일.
      { to: PATHS.OPS_SYSTEM_STATUS, icon: 'ph-heartbeat', label: '시스템 상태' },
      { to: PATHS.OPS_DEPLOYMENTS, icon: 'ph-rocket-launch', label: '배포 현황' },
      { to: PATHS.OPS_ALERTS, icon: 'ph-bell-ringing', label: '시스템 경보' },
    ],
  },
];

/** 강사 상단바 — 평평한 탭 4개(핸드오프: 강사 상단바). */
const INSTRUCTOR_TABS: NavItem[] = [
  { to: PATHS.OPS_INSTRUCTOR_HOME, icon: 'ph-squares-four', label: '강사 홈' },
  { to: PATHS.OPS_LECTURES, icon: 'ph-video-camera', label: '강의 관리' },
  // 코스 관리는 전용 화면(/ops/courses)이 있는데 '강의 관리' 안에만 묻혀 있었다.
  // 코스가 상품 단위(수강료·수료 시험이 붙는 곳)라 상단에서 바로 갈 수 있게 뺀다.
  { to: PATHS.OPS_COURSES, icon: 'ph-stack', label: '코스 관리' },
  { to: PATHS.OPS_QUESTION_REVIEW, icon: 'ph-seal-question', label: '문항 검수' },
  { to: PATHS.OPS_LEARNING_ANALYTICS, icon: 'ph-chart-bar', label: '학습 분석' },
];

/** 병합 항목은 대표 경로(to)뿐 아니라 형제 서브탭 경로(match)에서도 활성으로 본다. */
const itemActive = (l: NavItem, path: string) => path === l.to || !!l.match?.includes(path);
/** 그룹 안 항목 중 하나라도 현재 경로면 그룹 버튼을 활성으로 본다. */
const groupActive = (g: NavGroup, path: string) => g.items.some((l) => itemActive(l, path));

/** 상단 카테고리 진입 stagger를 '콘솔 첫 진입'에만 돌리기 위한 게이트.
 *
 *  OpsNav는 공용 레이아웃이 아니라 각 ops 페이지가 개별로 렌더한다 → 메뉴를 옮길 때마다
 *  통째로 재마운트된다. 게이트 없이 CSS 진입 애니메이션을 걸면 페이지 이동마다 상단바가
 *  다시 흘러내린다(ops 페이지엔 .cc-page-enter 페이드도 없어서 더 눈에 띈다).
 *  경로가 바뀌었는지로 판별하므로 StrictMode의 이중 렌더·재마운트(같은 경로)에서는 값이
 *  유지되고, 실제 라우팅에서만 꺼진다. 새로고침하면 모듈이 다시 평가돼 되살아난다.
 *
 *  단 강사 탭은 이 게이트를 쓰지 않는다 — 아래 isInstructor 분기 참고. */
let introGate: { path: string | null; play: boolean } = { path: null, play: true };
function useIntro(pathname: string): boolean {
  if (introGate.path !== pathname) {
    introGate = { path: pathname, play: introGate.path === null };
  }
  return introGate.play;
}

export default function OpsNav() {
  const { pathname } = useLocation();
  const { me, logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();
  const firstEntry = useIntro(pathname);
  const isInstructor = me?.role === 'instructor';
  // 강사 탭은 학생 콘솔(.sl-navlink)과 같은 감각으로 — 탭을 옮길 때마다 다시 흘러내린다.
  // 학생 상단 NAV(StudentNav)도 공용 레이아웃이 아니라 페이지마다 렌더돼 매번 재생되고,
  // 사용자가 그쪽을 기준으로 잡았다(2026-07-27). 운영자 드롭다운 그룹은 첫 진입에만 유지.
  const intro = isInstructor || firstEntry;
  // 강사는 강사 홈(/ops/home), 운영자는 운영 홈(/ops/dashboard)으로. 로고 클릭도 이 값으로 간다.
  const home = isInstructor ? PATHS.OPS_INSTRUCTOR_HOME : PATHS.OPS_DASHBOARD;

  // 알림 — 콘솔 벨. 안읽음 배지(useUnreadNotifications) + 패널에서 목록·읽음 처리.
  // 문항 자동 생성 완료/실패 알림(비동기 잡)이 여기로 온다(강사가 떠나 있어도 확인).
  const unread = useUnreadNotifications();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notes, setNotes] = useState<Notification[] | null>(null);
  // 상단바 드롭다운 — 열린 그룹 키(운영/데이터/시스템) 하나만. 스크림 클릭으로 닫힘.
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  // 호버로 펼치기 — 클릭 토글은 그대로 두고(터치·키보드 진입로) 마우스에선 갖다 대면 열린다.
  // 닫기는 약간 늦춘다: 버튼 → 메뉴로 포인터를 옮기는 중 잠깐 벗어나도 닫히지 않게.
  // 그룹 사이를 가로지를 때는 다음 그룹의 enter가 이 타이머를 취소해 메뉴바처럼 이어진다.
  // (버튼과 메뉴 사이 7px 간격은 .op-top-menu::before 브릿지가 덮는다 — CSS 참고)
  const closeTimer = useRef<number | null>(null);
  const cancelClose = () => {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  useEffect(() => cancelClose, []); // 언마운트 후 setState 방지
  // 터치 기기에선 탭이 mouseenter로도 잡혀 클릭 토글과 충돌한다 → 진짜 호버 가능할 때만.
  const canHover = () =>
    typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;
  const hoverOpen = (key: string) => {
    if (!canHover()) return;
    cancelClose();
    setOpenGroup(key);
  };
  const hoverClose = () => {
    if (!canHover()) return;
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpenGroup(null), 140);
  };

  const openNotif = () => {
    setNotifOpen(true);
    setNotes(null);
    notificationApi
      .list()
      .then(setNotes)
      .catch(() => setNotes([]));
  };
  const readOne = async (n: Notification) => {
    if (n.read_at) return;
    try {
      await notificationApi.markRead(n.id);
      setNotes((prev) => prev?.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)) ?? null);
      notifyNotificationsUpdated(); // 벨 배지 갱신
    } catch {
      /* 실패해도 목록은 유지 */
    }
  };
  const readAll = async () => {
    try {
      await notificationApi.markAllRead();
      const now = new Date().toISOString();
      setNotes((prev) => prev?.map((x) => ({ ...x, read_at: x.read_at ?? now })) ?? null);
      notifyNotificationsUpdated();
    } catch {
      /* ignore */
    }
  };

  const onLogout = async () => {
    await logout();
    navigate(PATHS.HOME, { replace: true });
  };

  const roleLabel = isInstructor ? '강사' : '운영자';
  const avatarInitial = (me?.name ?? roleLabel).slice(0, 1);

  return (
    <header className="op-top" aria-label={isInstructor ? '강사 콘솔 메뉴' : '운영 콘솔 메뉴'}>
      {openGroup && <div className="op-top-scrim" onClick={() => setOpenGroup(null)} />}
      <div className="op-top-inner">
        <Link to={home} className="op-top-brand" onClick={() => setOpenGroup(null)}>
          <img
            src={theme === 'dark' ? wordmarkWhite : wordmarkDark}
            alt="CATCHAP"
            className="op-top-wordmark-img"
          />
          <span className="op-top-console">{isInstructor ? '강사 콘솔' : '운영 콘솔'}</span>
        </Link>

        <nav className={'op-top-nav' + (intro ? ' op-top-nav--intro' : '')}>
          {isInstructor
            ? INSTRUCTOR_TABS.map((l) => {
                const on = itemActive(l, pathname);
                return (
                  <Link
                    key={l.to}
                    to={l.to}
                    className={'op-top-tab' + (on ? ' op-top-tab--on' : '')}
                    aria-current={on ? 'page' : undefined}
                  >
                    <i className={`ph ${l.icon}`} />
                    <span>{l.label}</span>
                  </Link>
                );
              })
            : (
              <>
                {/* 운영 홈 — 운영자 착지 대시보드 탭(드롭다운 아님). '운영' 그룹 왼쪽에 둔다. */}
                <Link
                  to={PATHS.OPS_DASHBOARD}
                  className={'op-top-tab' + (pathname === PATHS.OPS_DASHBOARD ? ' op-top-tab--on' : '')}
                  aria-current={pathname === PATHS.OPS_DASHBOARD ? 'page' : undefined}
                  onClick={() => setOpenGroup(null)}
                >
                  <i className="ph ph-squares-four" />
                  <span>운영 홈</span>
                </Link>
                {GROUPS.map((g) => {
                const gon = groupActive(g, pathname);
                const open = openGroup === g.key;
                return (
                  <div
                    key={g.key}
                    className="op-top-group"
                    onMouseEnter={() => hoverOpen(g.key)}
                    onMouseLeave={hoverClose}
                  >
                    <button
                      type="button"
                      className={
                        'op-top-gbtn' + (gon ? ' op-top-gbtn--on' : '') + (open ? ' op-top-gbtn--open' : '')
                      }
                      onClick={() => setOpenGroup(open ? null : g.key)}
                      aria-expanded={open}
                    >
                      {g.label}
                      {/* 글리프를 바꾸지 않고 항상 caret-down을 두고 CSS로 180도 회전
                          시킨다 — up/down 교체는 순간이동이라 회전 모션이 안 붙는다. */}
                      <i className="ph-bold ph-caret-down op-top-caret" />
                    </button>
                    {open && (
                      <div className="op-top-menu" role="menu">
                        {g.items.map((l) => {
                          const on = itemActive(l, pathname);
                          return (
                            <Link
                              key={l.to}
                              to={l.to}
                              role="menuitem"
                              className={'op-top-mitem' + (on ? ' op-top-mitem--on' : '')}
                              onClick={() => setOpenGroup(null)}
                            >
                              <i className={`ph ${l.icon}`} />
                              <span>{l.label}</span>
                              {on && <i className="ph ph-check op-top-mcheck" />}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              </>
            )}
        </nav>

        <div className="op-top-right">
          <button type="button" className="op-top-icbtn op-top-notif" onClick={openNotif} title="알림">
            <i className="ph ph-bell" />
            {unread > 0 && <span className="op-top-notifbadge">{unread > 9 ? '9+' : unread}</span>}
          </button>
          <button
            type="button"
            className="op-top-icbtn"
            onClick={toggleTheme}
            title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            <i className={theme === 'dark' ? 'ph ph-sun' : 'ph ph-moon'} />
          </button>
          <div className="op-top-divider" />
          {/* 문의하기 — 프로필 왼쪽(사용자 요청). 옆 아이콘 버튼들과 구분되게 테두리 알약 + 글자로
              '누를 수 있는 것'이 바로 읽히게 한다. 좁은 화면에선 글자를 접고 아이콘만 남긴다. */}
          <Link to={PATHS.OPS_INQUIRY} className="op-top-inquiry" title="문의하기">
            <i className="ph-fill ph-chat-circle-text" />
            <span className="op-top-inquiry-label">문의하기</span>
          </Link>
          {isInstructor ? (
            <Link to={PATHS.OPS_INSTRUCTOR_PROFILE} className="op-top-me" title="강사 프로필">
              <span className="op-top-avatar">{avatarInitial}</span>
              <span className="op-top-meblock">
                <span className="op-top-mename">{me?.name ?? '강사'}</span>
                <span className="op-top-merole">{roleLabel}</span>
              </span>
            </Link>
          ) : (
            <Link to={PATHS.OPS_OPERATORS} className="op-top-me" title="운영자 계정 관리">
              <span className="op-top-avatar">{avatarInitial}</span>
              <span className="op-top-meblock">
                <span className="op-top-mename">{me?.name ?? '운영자'}</span>
                <span className="op-top-merole">{roleLabel}</span>
              </span>
            </Link>
          )}
          <button type="button" className="op-top-icbtn" onClick={onLogout} title="로그아웃">
            <i className="ph ph-sign-out" />
          </button>
        </div>
      </div>

      {/* 알림 패널 — 목록 + 읽음 처리(문항 생성 완료/실패 등) */}
      {notifOpen && (
        <div className="op-bh-overlay" onClick={() => setNotifOpen(false)}>
          <div className="op-formmodal op-notif-panel" onClick={(e) => e.stopPropagation()}>
            <div className="op-bh-modal-h">
              <span><i className="ph-fill ph-bell" /> 알림</span>
              <button className="op-bh-modal-x" onClick={() => setNotifOpen(false)}>
                <i className="ph-bold ph-x" />
              </button>
            </div>
            {notes && notes.some((n) => !n.read_at) && (
              <button type="button" className="op-notif-readall" onClick={readAll}>
                <i className="ph-bold ph-checks" /> 모두 읽음
              </button>
            )}
            <div className="op-notif-list">
              {notes === null ? (
                <div className="op-notif-empty">불러오는 중…</div>
              ) : notes.length === 0 ? (
                <div className="op-notif-empty">알림이 없어요.</div>
              ) : (
                notes.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className={'op-notif-item' + (n.read_at ? '' : ' op-notif-item--unread')}
                    onClick={() => readOne(n)}
                  >
                    <div className="op-notif-item-h">
                      {!n.read_at && <span className="op-notif-dot" />}
                      <span className="op-notif-title">{n.title}</span>
                    </div>
                    <div className="op-notif-msg">{n.message}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
