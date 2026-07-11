import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { useAuth } from '../../hooks/useAuth';
import { useStudentSettings } from '../../stores/studentSettingsStore';
import { notifyNotificationsUpdated } from '../../hooks/useUnreadNotifications';
import { notificationApi, type Notification } from '../../api/notifications';
import { kstDateString, parseServerDate } from '../../utils/format';
import mascot from '../../assets/characters/catchap-logo.png';
import './StudentNotifications.css';

/**
 * handoff `CatChap 알림.dc.html` 포팅.
 * 원본 NAV는 학습 홈 NAV와 구조가 다름(로고가 링크, 알림 벨이 활성 배경 버튼,
 * 프로필 아바타가 이니셜 원형, 프로필 hover 색상) → StudentLayout 대신 페이지 내 자체 구현.
 * 원본이 screen-time-reminder.js를 로드하지 않으므로 ScreenTimeReminder 미포함.
 */

type NtCat = 'all' | '진도' | '배지' | '추천문제' | 'AI';

interface NtItem {
  id: string;
  title: string;
  body: string;
  time: string;
  icon: string;
  color: string;
  bg: string;
  unread: boolean;
  /** 원본 catMap[n.icon] 결과와 동일한 값 */
  cat: NtCat;
}

/** 원본 tagMap 그대로 */
const TAG_MAP: Record<string, string> = {
  진도: '진도',
  배지: '배지',
  추천문제: '추천문제',
  AI: 'AI 냥냥이',
};

/** 원본 CATS 그대로 */
const CATS: { key: NtCat; label: string; icon: string }[] = [
  { key: 'all', label: '전체', icon: 'ph-fill ph-squares-four' },
  { key: '진도', label: '학습 진도', icon: 'ph-fill ph-chart-line-up' },
  { key: '배지', label: '배지', icon: 'ph-fill ph-medal' },
  { key: '추천문제', label: '추천 문제', icon: 'ph-fill ph-lightbulb' },
  { key: 'AI', label: 'AI 냥냥이', icon: 'ph-fill ph-robot' },
];

// TODO(api): notificationApi.list() 실패 시 원본 하드코딩 알림 목록 유지
const FALLBACK_TODAY: NtItem[] = [
  { id: 't1', title: '퀴즈 완료!', body: '그림 찾기 퀴즈를 정답률 86%로 끝냈어요. 참 잘했어요!', time: '방금 전', icon: 'ph-fill ph-check-circle', color: '#17B08C', bg: '#DFF6ED', unread: true, cat: '진도' },
  { id: 't2', title: '새 배지 획득 🏅', body: '"매의 눈" 배지를 얻었어요. 배지함에서 확인해 보세요.', time: '10분 전', icon: 'ph-fill ph-medal', color: '#F0A400', bg: '#FFF3D6', unread: true, cat: '배지' },
  { id: 't3', title: '오늘의 추천 문제', body: '하은이에게 딱 맞는 숫자 놀이터 5문제를 준비했어요! 지금 도전해 볼까요?', time: '30분 전', icon: 'ph-fill ph-lightbulb', color: '#FF5A4D', bg: '#FFE7E2', unread: true, cat: '추천문제' },
  { id: 't4', title: 'AI 선생님 냥냥이', body: '"오늘 숫자 놀이터도 같이 해볼까? 5문제만 도전!"', time: '1시간 전', icon: 'ph-fill ph-robot', color: '#2E7BFF', bg: '#E6F0FF', unread: true, cat: 'AI' },
];

const FALLBACK_EARLIER: NtItem[] = [
  { id: 'e1', title: '연속 학습 리마인드 🔥', body: '오늘 학습하면 12일 연속 기록을 이어갈 수 있어요!', time: '어제', icon: 'ph-fill ph-fire', color: '#FF922E', bg: '#FFEDE0', unread: false, cat: '진도' },
  { id: 'e2', title: '끌어놓기 놀이 완료', body: '정답률 100%! 드래그 마스터 배지에 한 걸음 가까워졌어요.', time: '어제', icon: 'ph-fill ph-hand-grabbing', color: '#17B08C', bg: '#DFF6ED', unread: false, cat: '진도' },
  { id: 'e3', title: '새 추천 문제 도착', body: '받침이 조금 헷갈렸죠? 한글 낱말 3문제를 추천해 드려요.', time: '어제', icon: 'ph-fill ph-lightbulb', color: '#FF5A4D', bg: '#FFE7E2', unread: false, cat: '추천문제' },
  { id: 'e4', title: 'AI 선생님 냥냥이', body: '"받침이 조금 헷갈렸구나. 천천히 소리 내어 읽어보자!"', time: '2일 전', icon: 'ph-fill ph-robot', color: '#2E7BFF', bg: '#E6F0FF', unread: false, cat: 'AI' },
  { id: 'e5', title: '주간 리포트가 도착했어요', body: '이번 주 학습 요약을 나의 기록에서 확인할 수 있어요.', time: '3일 전', icon: 'ph-fill ph-chart-line-up', color: '#8B6BFF', bg: '#EDE6FF', unread: false, cat: '진도' },
];

/** API 알림 type → 원본 디자인의 아이콘/색 (type이 category보다 세분화됨: progress/report 등) */
const TYPE_STYLE: Record<string, { icon: string; color: string; bg: string }> = {
  progress: { icon: 'ph-fill ph-check-circle', color: '#17B08C', bg: '#DFF6ED' },
  badge: { icon: 'ph-fill ph-medal', color: '#F0A400', bg: '#FFF3D6' },
  recommend: { icon: 'ph-fill ph-lightbulb', color: '#FF5A4D', bg: '#FFE7E2' },
  ai: { icon: 'ph-fill ph-robot', color: '#2E7BFF', bg: '#E6F0FF' },
  report: { icon: 'ph-fill ph-chart-line-up', color: '#8B6BFF', bg: '#EDE6FF' },
};

/** API 알림 category → 원본 카테고리별 아이콘/색 (type 매칭 실패 시 폴백) */
const API_STYLE: Record<string, { icon: string; color: string; bg: string }> = {
  진도: { icon: 'ph-fill ph-chart-line-up', color: '#8B6BFF', bg: '#EDE6FF' },
  배지: { icon: 'ph-fill ph-medal', color: '#F0A400', bg: '#FFF3D6' },
  추천문제: { icon: 'ph-fill ph-lightbulb', color: '#FF5A4D', bg: '#FFE7E2' },
  AI: { icon: 'ph-fill ph-robot', color: '#2E7BFF', bg: '#E6F0FF' },
};
const API_STYLE_DEFAULT = { icon: 'ph-fill ph-check-circle', color: '#17B08C', bg: '#DFF6ED' };

function relTime(iso: string): string {
  // 서버는 KST naive 문자열 — parseServerDate로 절대시각 고정(브라우저 시간대 무관)
  const t = parseServerDate(iso).getTime();
  if (!Number.isFinite(t)) return ''; // 깨진 날짜면 'NaN분 전' 대신 빈 문자열
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const days = Math.floor(hr / 24);
  if (days <= 1) return '어제';
  return `${days}일 전`;
}

function toItem(n: Notification): NtItem {
  const cat: NtCat = n.category in API_STYLE ? (n.category as NtCat) : 'all';
  const style = TYPE_STYLE[n.type] ?? API_STYLE[n.category] ?? API_STYLE_DEFAULT;
  return {
    id: n.id,
    title: n.title,
    body: n.message,
    time: relTime(n.created_at),
    icon: style.icon,
    color: style.color,
    bg: style.bg,
    unread: !n.read_at,
    cat,
  };
}

export default function StudentNotifications() {
  const { me } = useAuth();
  const { settings } = useStudentSettings();
  const [today, setToday] = useState<NtItem[]>(FALLBACK_TODAY);
  const [earlier, setEarlier] = useState<NtItem[]>(FALLBACK_EARLIER);
  const [view, setView] = useState<'list' | 'empty'>('list');
  const [allRead, setAllRead] = useState(false);
  const [cat, setCat] = useState<NtCat>('all');

  /** 설정 화면의 알림 토글 적용: 배지 획득 / 학습 리마인드 / 주간 요약 off 시 해당 알림 숨김 */
  const allowedBySettings = (n: NtItem) => {
    const tg = settings.toggles;
    if (!tg.badge && n.cat === '배지') return false;
    if (!tg.remind && n.title.includes('리마인드')) return false;
    if (!tg.weekly && (n.title.includes('주간') || n.body.includes('주간'))) return false;
    return true;
  };

  const name = (me?.name ?? '하은').trim() || '하은';

  useEffect(() => {
    notificationApi
      .list()
      .then((list) => {
        if (!list.length) {
          setView('empty');
          return;
        }
        const t: NtItem[] = [];
        const e: NtItem[] = [];
        // '오늘' 경계는 KST 자정 기준 — 브라우저 로컬 자정이 아니라
        const todayStr = kstDateString();
        list.forEach((n) => {
          (kstDateString(parseServerDate(n.created_at)) === todayStr ? t : e).push(toItem(n));
        });
        setToday(t);
        setEarlier(e);
      })
      .catch(() => {
        /* TODO(api): 백엔드 미구현 — FALLBACK 유지 */
      });
  }, []);

  /** 원본 build(): 카테고리 필터 + allRead 반영 + 태그 (+ 설정 알림 토글) */
  const build = (list: NtItem[]) =>
    list
      .filter(allowedBySettings)
      .filter((n) => cat === 'all' || n.cat === cat)
      .map((n) => ({ ...n, unread: n.unread && !allRead, tag: TAG_MAP[n.cat] ?? '' }));

  const todayView = build(today);
  const earlierView = build(earlier);
  const unreadCount = [...todayView, ...earlierView].filter((n) => n.unread).length;
  const unreadLabel = unreadCount > 0 ? `읽지 않은 알림 ${unreadCount}개` : '모든 알림을 확인했어요';

  const markAll = () => {
    setAllRead(true);
    notificationApi
      .markAllRead()
      .then(() => notifyNotificationsUpdated()) // 다른 화면 NAV 벨 점도 즉시 갱신
      .catch(() => {
        /* TODO(api): 실패해도 로컬 상태는 원본 동작대로 갱신 */
      });
  };

  const readOne = (n: NtItem & { tag: string }, section: 'today' | 'earlier') => {
    if (!n.unread) return;
    const update = (list: NtItem[]) => list.map((x) => (x.id === n.id ? { ...x, unread: false } : x));
    if (section === 'today') setToday(update);
    else setEarlier(update);
    notificationApi
      .markRead(n.id)
      .then(() => notifyNotificationsUpdated())
      .catch(() => {
        /* TODO(api): 실패해도 로컬 상태는 갱신 유지 */
      });
  };

  const renderCard = (n: NtItem & { tag: string }, section: 'today' | 'earlier') => (
    <div
      key={n.id}
      className={`nt-card ${n.unread ? 'nt-card--unread' : 'nt-card--read'}`}
      style={{ '--c': n.color, '--bg': n.bg } as CSSProperties}
      onClick={() => readOne(n, section)}
    >
      <span className="nt-iconwrap">
        <i className={n.icon} />
      </span>
      <div className="nt-cardbody">
        <div className="nt-cardtop">
          <span className="nt-cardtitle">{n.title}</span>
          {!!n.tag && <span className="nt-tag">{n.tag}</span>}
          {n.unread && <span className="nt-dot" />}
        </div>
        <p className="nt-cardtext">{n.body}</p>
      </div>
      <span className="nt-time">{n.time}</span>
    </div>
  );

  return (
    <div className="nt-root">
      {/* NAV — 원본 알림 화면 NAV 그대로(벨 활성 상태, 이니셜 아바타) */}
      <div className="nt-navbar">
        <div className="nt-navinner">
          <Link to={PATHS.STUDENT_HOME} className="nt-logo">
            <img src={mascot} alt="CatChap" className="nt-logoimg" />
            <div className="nt-logotext">
              <span className="nt-logotitle">CatChap</span>
              <span className="nt-logosub">놀면서 배우는 캡챠 학습</span>
            </div>
          </Link>
          <nav className="nt-menu">
            <Link to={PATHS.STUDENT_HOME} className="nt-navlink">
              홈
            </Link>
            <Link to={PATHS.STUDENT_ALL_LEARNING} className="nt-navlink">
              전체 학습
            </Link>
            <Link to={PATHS.STUDENT_CONCEPTS} className="nt-navlink">
              개념 설명
            </Link>
            <Link to={PATHS.STUDENT_AI_TEACHER} className="nt-navlink">
              AI 선생님
            </Link>
            <Link to={PATHS.STUDENT_RECORDS} className="nt-navlink">
              나의 기록
            </Link>
          </nav>
          <div className="nt-navright">
            <Link to={PATHS.STUDENT_SEARCH} className="nt-searchbtn">
              <i className="ph-bold ph-magnifying-glass" />
            </Link>
            <button className="nt-bellbtn">
              <i className="ph-fill ph-bell" />
              {unreadCount > 0 && <span className="nt-belldot" />}
            </button>
            <Link to={PATHS.STUDENT_PROFILE} title="마이페이지" className="nt-profile">
              <div className="nt-avatar">{name.charAt(0)}</div>
              <span className="nt-profilename">{name}</span>
            </Link>
          </div>
        </div>
      </div>

      <section className="nt-section">
        {/* header row */}
        <div className="nt-header">
          <div className="nt-headleft">
            <span className="nt-headicon">
              <i className="ph-fill ph-bell" />
            </span>
            <div>
              <h1 className="nt-title">알림</h1>
              <p className="nt-sub">{unreadLabel}</p>
            </div>
          </div>
          <div className="nt-headbtns">
            {/* '빈 상태 미리보기' 버튼은 사용자 요청으로 제거 — 빈 상태는 실제 알림이 없을 때만 표시 */}
            <button className="nt-markall" onClick={markAll}>
              <i className="ph-fill ph-checks" />
              전체 읽음 처리
            </button>
          </div>
        </div>

        {/* CATEGORY FILTER */}
        <div className="nt-chips">
          {CATS.map((c) => (
            <button
              key={c.key}
              className={`nt-chip ${cat === c.key ? 'nt-chip--on' : 'nt-chip--off'}`}
              onClick={() => setCat(c.key)}
            >
              <i className={c.icon} />
              {c.label}
            </button>
          ))}
        </div>

        {/* LIST VIEW */}
        {view === 'list' && (
          <div>
            <div className="nt-groupname">오늘</div>
            <div className="nt-list nt-list--today">
              {todayView.map((n) => renderCard(n, 'today'))}
            </div>
            <div className="nt-groupname">이전</div>
            <div className="nt-list">{earlierView.map((n) => renderCard(n, 'earlier'))}</div>
          </div>
        )}

        {/* EMPTY STATE */}
        {view === 'empty' && (
          <div className="nt-empty">
            <div className="nt-emptyart">
              <img src={mascot} alt="마스코트" className="nt-emptyimg" />
              <span className="nt-emptybadge">
                <i className="ph-fill ph-bell-slash" />
              </span>
            </div>
            <h2 className="nt-emptytitle">아직 알림이 없어요</h2>
            <p className="nt-emptytext">
              학습을 완료하거나 배지를 얻으면
              <br />
              여기에서 소식을 알려드릴게요!
            </p>
            <Link to={PATHS.STUDENT_ALL_LEARNING} className="nt-emptycta">
              <i className="ph-fill ph-play-circle" />
              학습하러 가기
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
