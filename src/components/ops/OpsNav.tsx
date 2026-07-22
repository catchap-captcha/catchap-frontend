import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { settingsApi } from '../../api/settings';
import { notificationApi, type Notification } from '../../api/notifications';
import {
  notifyNotificationsUpdated,
  useUnreadNotifications,
} from '../../hooks/useUnreadNotifications';
import { PATHS } from '../../routes/paths';
import mascot from '../../assets/characters/catchap-logo.png';

/** 운영 콘솔 공용 사이드바 (모든 ops 페이지가 공유).
 *
 *  상단 가로 네비는 메뉴 11개에서 이미 잘려 가로 스크롤로 새고 있었다 — 실무 콘솔
 *  표준인 좌측 사이드바 + 업무 영역 그룹으로 바꾼다(기관·교사 콘솔의 사이드바와도
 *  한 계열). 좁은 화면(≤1080px)에서는 아이콘 레일(64px)로 접혀 전 메뉴가 유지된다.
 *
 *  강사(instructor)도 같은 사이드바를 쓰되 '내 강의'만 보인다 — 운영 메뉴는 서버가
 *  403으로 막지만, 애초에 링크를 노출하지 않는 것이 콘솔의 예의다. */
const GROUPS: { label: string; items: { to: string; icon: string; label: string }[] }[] = [
  {
    label: '운영',
    items: [
      { to: PATHS.OPS_APPROVAL, icon: 'ph-buildings', label: '기관 승인' },
      { to: PATHS.OPS_ORGS, icon: 'ph-list-checks', label: '기관 관리' },
      { to: PATHS.OPS_INSTRUCTORS, icon: 'ph-chalkboard-teacher', label: '강사 관리' },
      { to: PATHS.OPS_INQUIRIES, icon: 'ph-chat-circle-dots', label: '문의 관리' },
    ],
  },
  {
    label: '강의',
    items: [{ to: PATHS.OPS_LECTURES, icon: 'ph-video-camera', label: '강의 관리' }],
  },
  {
    // LLM 전용 그룹 — 종전엔 실 LLM 설정(모델 선택·API 키·프롬프트)이 범용 '설정' 한 페이지에
    // 묻혀 찾기 힘들었다. 문항 생성과 밀접하므로 '강의' 다음에 두고 셋으로 나눈다(사용자 요청).
    label: 'LLM',
    items: [
      { to: PATHS.OPS_LLM_MODELS, icon: 'ph-robot', label: '모델' },
      { to: PATHS.OPS_LLM_KEYS, icon: 'ph-lock-key', label: 'API 키' },
      { to: PATHS.OPS_LLM_PROMPTS, icon: 'ph-chat-text', label: '프롬프트' },
    ],
  },
  {
    label: '데이터',
    items: [
      { to: PATHS.OPS_BEHAVIOR, icon: 'ph-fingerprint', label: '행동 데이터' },
      { to: PATHS.OPS_BEHAVIOR_EXPORT, icon: 'ph-export', label: '외부 내보내기' },
      { to: PATHS.OPS_LOGS, icon: 'ph-scroll', label: '감사 로그' },
    ],
  },
  {
    label: '시스템',
    items: [
      { to: PATHS.OPS_API_KEYS, icon: 'ph-key', label: 'API 발급' },
      // 기관 콘솔 노출용 표시 카탈로그(실 LLM 호출과 무관) — 위 'LLM > 모델'과 구분되게 라벨 명확화
      { to: PATHS.OPS_AI_MODELS, icon: 'ph-cpu', label: '모델 카탈로그' },
      { to: PATHS.OPS_MONITORING, icon: 'ph-gauge', label: '모니터링' },
    ],
  },
];

const INSTRUCTOR_GROUPS: typeof GROUPS = [
  {
    label: '강사',
    items: [
      { to: PATHS.OPS_INSTRUCTOR_HOME, icon: 'ph-squares-four', label: '홈' },
      { to: PATHS.OPS_LECTURES, icon: 'ph-video-camera', label: '내 강의' },
    ],
  },
];

export default function OpsNav() {
  const { pathname } = useLocation();
  const { me, logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();
  const isInstructor = me?.role === 'instructor';
  const groups = isInstructor ? INSTRUCTOR_GROUPS : GROUPS;
  const home = isInstructor ? PATHS.OPS_INSTRUCTOR_HOME : PATHS.OPS_APPROVAL;

  // 알림 — 콘솔 벨. 안읽음 배지(useUnreadNotifications) + 패널에서 목록·읽음 처리.
  // 문항 자동 생성 완료/실패 알림(비동기 잡)이 여기로 온다(강사가 떠나 있어도 확인).
  const unread = useUnreadNotifications();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notes, setNotes] = useState<Notification[] | null>(null);

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

  // 강사 본인 비밀번호 변경 — 운영자는 운영자 계정 페이지에 같은 기능이 있지만,
  // 강사는 접근 가능한 관리 페이지가 없어 사이드바 푸터에서 직접 연다.
  const [pwOpen, setPwOpen] = useState(false);
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const onLogout = async () => {
    await logout();
    navigate(PATHS.HOME, { replace: true });
  };

  const openPw = () => {
    setCurPw('');
    setNewPw('');
    setNewPw2('');
    setPwErr('');
    setPwMsg('');
    setPwOpen(true);
  };
  const changePw = async () => {
    if (!curPw) return setPwErr('현재 비밀번호를 입력해 주세요.');
    if (newPw.length < 8) return setPwErr('새 비밀번호는 8자 이상으로 정해 주세요.');
    if (newPw !== newPw2) return setPwErr('새 비밀번호가 서로 달라요.');
    if (newPw === curPw) return setPwErr('현재 비밀번호와 다른 비밀번호로 정해 주세요.');
    setPwSaving(true);
    setPwErr('');
    try {
      await settingsApi.changePassword(curPw, newPw);
      setPwMsg('비밀번호를 변경했어요.');
      setTimeout(() => setPwOpen(false), 900);
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } };
      setPwErr(err.response?.data?.detail ?? '변경에 실패했어요. 현재 비밀번호를 확인해 주세요.');
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <aside className="op-side" aria-label={isInstructor ? '강사 콘솔 메뉴' : '운영 콘솔 메뉴'}>
      <Link to={home} className="op-side-brand">
        <img src={mascot} alt="CatChap" className="op-side-logo" />
        <div className="op-side-brandtext">
          <div className="op-side-name">CatChap</div>
          <div className="op-side-sub">{isInstructor ? '강사 콘솔' : '운영 콘솔'}</div>
        </div>
      </Link>
      <nav className="op-side-menu">
        {groups.map((g) => (
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
        {isInstructor ? (
          <button type="button" className="op-side-me" onClick={openPw} title="내 비밀번호 변경">
            <span className="op-side-avatar">
              <i className="ph-fill ph-chalkboard-teacher" />
            </span>
            <span className="op-side-mename">{me?.name ?? '강사'}</span>
          </button>
        ) : (
          <Link to={PATHS.OPS_OPERATORS} className="op-side-me" title="운영자 계정 관리">
            <span className="op-side-avatar">
              <i className="ph-fill ph-shield-star" />
            </span>
            <span className="op-side-mename">{me?.name ?? '운영자'}</span>
          </Link>
        )}
        <button
          type="button"
          className="op-side-logout op-side-notif"
          onClick={openNotif}
          title="알림"
        >
          <i className="ph-fill ph-bell" />
          <span>알림</span>
          {unread > 0 && <span className="op-side-notifbadge">{unread > 9 ? '9+' : unread}</span>}
        </button>
        <button
          type="button"
          className="op-side-logout op-side-theme"
          onClick={toggleTheme}
          title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
        >
          <i className={theme === 'dark' ? 'ph-fill ph-sun' : 'ph-fill ph-moon'} />
          <span>{theme === 'dark' ? '라이트 모드' : '다크 모드'}</span>
        </button>
        <button type="button" className="op-side-logout" onClick={onLogout} title="로그아웃">
          <i className="ph-fill ph-sign-out" />
          <span>로그아웃</span>
        </button>
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

      {/* 강사 본인 비밀번호 변경 모달 (OpsApproval.css 공용 모달 스타일) */}
      {pwOpen && (
        <div className="op-bh-overlay" onClick={() => !pwSaving && setPwOpen(false)}>
          <div className="op-formmodal" onClick={(e) => e.stopPropagation()}>
            <div className="op-bh-modal-h">
              <span><i className="ph-fill ph-lock-key" /> 내 비밀번호 변경</span>
              <button className="op-bh-modal-x" onClick={() => !pwSaving && setPwOpen(false)}>
                <i className="ph-bold ph-x" />
              </button>
            </div>
            <div className="op-form">
              <p className="op-form-hint">현재 비밀번호를 확인한 뒤 새 비밀번호(8자 이상)로 바꿔요.</p>
              <label className="op-form-row">
                <span className="op-form-lb">현재 비밀번호 <b>*</b></span>
                <input className="op-form-in" type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} placeholder="현재 비밀번호" />
              </label>
              <label className="op-form-row">
                <span className="op-form-lb">새 비밀번호 <b>*</b></span>
                <input className="op-form-in" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="8자 이상" />
              </label>
              <label className="op-form-row">
                <span className="op-form-lb">새 비밀번호 확인 <b>*</b></span>
                <input className="op-form-in" type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} placeholder="새 비밀번호 다시" />
              </label>
              {pwErr && <div className="op-form-err"><i className="ph-fill ph-warning-circle" />{pwErr}</div>}
              {pwMsg && <div className="op-form-hint" style={{ color: '#1d9e6f', fontWeight: 700 }}>{pwMsg}</div>}
              <div className="op-form-actions">
                <button className="op-btn op-btn--reject" disabled={pwSaving} onClick={() => setPwOpen(false)}>취소</button>
                <button className="op-btn op-btn--approve" disabled={pwSaving} onClick={changePw}>
                  <i className="ph-bold ph-check" />
                  {pwSaving ? '변경 중…' : '비밀번호 변경'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
