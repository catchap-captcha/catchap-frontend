/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import ParentLayout from '../../layouts/ParentLayout';
import { PATHS } from '../../routes/paths';
import { notificationApi, type Notification } from '../../api/notifications';
import { parentApi } from '../../api/parents';
import mascot from '../../assets/characters/catchap-logo.png';
import './ParentNotifications.css';

/**
 * handoff `CatChap 학부모알림.dc.html` 포팅.
 * 원본 NAV 벨은 링크가 아닌 활성 상태 button(hover 없음) → 페이지에서 만들어 bell prop으로 전달.
 * 원본 renderVals의 toggleView/toggleLabel은 마크업에서 사용되지 않아(토글 버튼 없음) 미포팅.
 */

interface PnItem {
  id: string;
  title: string;
  tag?: string;
  body: string;
  time: string;
  icon: string;
  color: string;
  bg: string;
  unread: boolean;
  /** 필터 키 — FALLBACK: 자녀 이름, API: child_id(자녀 목록 로드 시 이름으로 치환) */
  child: string;
}

interface PnChip {
  key: string;
  label: string;
}

// TODO(api): notificationApi.list() 실패 시 원본 하드코딩 알림 목록 유지
const FALLBACK_TODAY: PnItem[] = [
  { id: 't1', title: '이수진 선생님 메시지', tag: '선생님', body: '"하은이가 오늘 숫자 놀이터를 끝까지 잘 해냈어요. 집에서도 칭찬 많이 해주세요!"', time: '방금 전', icon: 'ph-fill ph-chalkboard-teacher', color: '#FF5A4D', bg: '#FFE7E2', unread: true, child: '하은' },
  { id: 't2', title: '주간 리포트 도착', tag: '리포트', body: '하은이의 6월 넷째 주 학습 요약이 준비됐어요. 지금 확인해 보세요.', time: '1시간 전', icon: 'ph-fill ph-file-text', color: '#8B6BFF', bg: '#EDE6FF', unread: true, child: '하은' },
  { id: 't3', title: '새 배지 획득 🏅', body: '도윤이가 "첫 걸음" 배지를 얻었어요!', time: '3시간 전', icon: 'ph-fill ph-medal', color: '#F0A400', bg: '#FFF3D6', unread: true, child: '도윤' },
];

const FALLBACK_EARLIER: PnItem[] = [
  { id: 'e1', title: '박민호 선생님 메시지', tag: '선생님', body: '"도윤이가 그림 찾기를 참 좋아해요. 오늘도 스스로 3판이나 했답니다."', time: '어제', icon: 'ph-fill ph-chalkboard-teacher', color: '#FF5A4D', bg: '#FFE7E2', unread: false, child: '도윤' },
  { id: 'e2', title: '상담 AI 답변 준비 완료', body: '어제 남기신 질문에 대한 상담 AI 답변이 준비됐어요.', time: '어제', icon: 'ph-fill ph-robot', color: '#2E7BFF', bg: '#E6F0FF', unread: false, child: '하은' },
  { id: 'e3', title: '학습 리마인드', body: '하은이가 3일 연속 학습 중이에요. 오늘도 함께 응원해 주세요!', time: '2일 전', icon: 'ph-fill ph-fire', color: '#FF922E', bg: '#FFEDE0', unread: false, child: '하은' },
  { id: 'e4', title: '월간 리포트 안내', body: '6월 월간 리포트를 곧 보내드릴 예정이에요.', time: '4일 전', icon: 'ph-fill ph-calendar-check', color: '#17B08C', bg: '#DFF6ED', unread: false, child: '하은' },
];

/** 원본 CHILDREN 그대로 — parentApi.children() 성공 시 자녀 이름으로 재구성 */
const FALLBACK_CHIPS: PnChip[] = [
  { key: 'all', label: '전체' },
  { key: '하은', label: '하은' },
  { key: '도윤', label: '도윤' },
];

/** API 알림 category → 원본 알림 종류별 아이콘/색/태그 */
const API_STYLE: Record<string, { icon: string; color: string; bg: string; tag?: string }> = {
  선생님: { icon: 'ph-fill ph-chalkboard-teacher', color: '#FF5A4D', bg: '#FFE7E2', tag: '선생님' },
  리포트: { icon: 'ph-fill ph-file-text', color: '#8B6BFF', bg: '#EDE6FF', tag: '리포트' },
  배지: { icon: 'ph-fill ph-medal', color: '#F0A400', bg: '#FFF3D6' },
  AI: { icon: 'ph-fill ph-robot', color: '#2E7BFF', bg: '#E6F0FF' },
  리마인드: { icon: 'ph-fill ph-fire', color: '#FF922E', bg: '#FFEDE0' },
};
/** category가 '일반'처럼 포괄적일 때 type(teacher/report/badge/ai/remind)으로 2차 매핑 */
const API_TYPE_STYLE: Record<string, { icon: string; color: string; bg: string; tag?: string }> = {
  teacher: API_STYLE.선생님,
  report: API_STYLE.리포트,
  badge: API_STYLE.배지,
  ai: API_STYLE.AI,
  remind: API_STYLE.리마인드,
};
const API_STYLE_DEFAULT = { icon: 'ph-fill ph-calendar-check', color: '#17B08C', bg: '#DFF6ED' };

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
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

function toItem(n: Notification, nameById: Record<string, string>): PnItem {
  const style = API_STYLE[n.category] ?? API_TYPE_STYLE[n.type] ?? API_STYLE_DEFAULT;
  const childId = n.child_id ?? '';
  return {
    id: n.id,
    title: n.title,
    tag: 'tag' in style ? style.tag : undefined,
    body: n.message,
    time: relTime(n.created_at),
    icon: style.icon,
    color: style.color,
    bg: style.bg,
    unread: !n.read_at,
    child: nameById[childId] ?? childId,
  };
}

export default function ParentNotifications() {
  const [today, setToday] = useState<PnItem[]>(FALLBACK_TODAY);
  const [earlier, setEarlier] = useState<PnItem[]>(FALLBACK_EARLIER);
  const [chips, setChips] = useState<PnChip[]>(FALLBACK_CHIPS);
  const [view, setView] = useState<'list' | 'empty'>('list');
  const [allRead, setAllRead] = useState(false);
  const [child, setChild] = useState('all');

  useEffect(() => {
    Promise.allSettled([notificationApi.list(), parentApi.children()]).then(([nRes, cRes]) => {
      const nameById: Record<string, string> = {};
      if (cRes.status === 'fulfilled' && Array.isArray(cRes.value) && cRes.value.length > 0) {
        // API 자녀 목록의 이름 키는 nickname (name은 구버전 호환)
        cRes.value.forEach((c: any) => {
          const nm = String(c.nickname ?? c.name ?? '');
          if (nm) nameById[String(c.id ?? c.child_id ?? '')] = nm;
        });
        setChips([
          { key: 'all', label: '전체' },
          ...cRes.value.map((c: any) => {
            const nm = String(c.nickname ?? c.name ?? c.id ?? '');
            return { key: nm, label: nm };
          }),
        ]);
      }
      // 배열이 아닌 응답이면 FALLBACK 유지 — forEach 크래시(미처리 예외)로 새지 않게 가드
      if (nRes.status === 'fulfilled' && Array.isArray(nRes.value)) {
        const list = nRes.value;
        if (list.length === 0) {
          setView('empty');
          return;
        }
        const t: PnItem[] = [];
        const e: PnItem[] = [];
        const todayStr = new Date().toDateString();
        list.forEach((n) => {
          (new Date(n.created_at).toDateString() === todayStr ? t : e).push(toItem(n, nameById));
        });
        setToday(t);
        setEarlier(e);
      }
      // TODO(api): 백엔드 미구현 — 실패한 호출은 FALLBACK 유지
    });
  }, []);

  /** 원본 build(): 자녀 필터 + allRead 반영 */
  const build = (list: PnItem[]) =>
    list
      .filter((n) => child === 'all' || n.child === child)
      .map((n) => ({ ...n, unread: n.unread && !allRead }));

  const todayView = build(today);
  const earlierView = build(earlier);
  const unreadCount = [...todayView, ...earlierView].filter((n) => n.unread).length;
  const unreadLabel = unreadCount > 0 ? `읽지 않은 알림 ${unreadCount}개` : '모든 알림을 확인했어요';

  const markAll = () => {
    setAllRead(true);
    notificationApi.markAllRead().catch(() => {
      /* TODO(api): 실패해도 로컬 상태는 원본 동작대로 갱신 */
    });
  };

  const renderCard = (n: PnItem) => (
    <div
      key={n.id}
      className={`pn-card ${n.unread ? 'pn-card--unread' : 'pn-card--read'}`}
      style={{ '--c': n.color, '--bg': n.bg } as CSSProperties}
    >
      <span className="pn-iconwrap">
        <i className={n.icon} />
      </span>
      <div className="pn-cardbody">
        <div className="pn-cardtop">
          <span className="pn-cardtitle">{n.title}</span>
          {!!n.tag && <span className="pn-tag">{n.tag}</span>}
          {n.unread && <span className="pn-dot" />}
        </div>
        <p className="pn-cardtext">{n.body}</p>
      </div>
      <span className="pn-time">{n.time}</span>
    </div>
  );

  return (
    <ParentLayout
      className="pn-bg"
      bell={
        <button className="pn-bell">
          <i className="ph-fill ph-bell" />
          <span className="pn-belldot" />
        </button>
      }
    >
      <section className="pn-section">
        {/* header row */}
        <div className="pn-header">
          <div className="pn-headleft">
            <span className="pn-headicon">
              <i className="ph-fill ph-bell" />
            </span>
            <div>
              <h1 className="pn-title">알림</h1>
              <p className="pn-sub">{unreadLabel}</p>
            </div>
          </div>
          <div className="pn-headbtns">
            <button className="pn-markall" onClick={markAll}>
              <i className="ph-fill ph-checks" />
              전체 읽음 처리
            </button>
          </div>
        </div>

        {/* CHILD FILTER */}
        <div className="pn-chips">
          {chips.map((c) => (
            <button
              key={c.key}
              className={`pn-chip ${child === c.key ? 'pn-chip--on' : 'pn-chip--off'}`}
              onClick={() => setChild(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* LIST VIEW */}
        {view === 'list' && (
          <div>
            <div className="pn-groupname">오늘</div>
            <div className="pn-list pn-list--today">{todayView.map(renderCard)}</div>
            <div className="pn-groupname">이전</div>
            <div className="pn-list">{earlierView.map(renderCard)}</div>
          </div>
        )}

        {/* EMPTY STATE */}
        {view === 'empty' && (
          <div className="pn-empty">
            <div className="pn-emptyart">
              <img src={mascot} alt="마스코트" className="pn-emptyimg" />
              <span className="pn-emptybadge">
                <i className="ph-fill ph-bell-slash" />
              </span>
            </div>
            <h2 className="pn-emptytitle">새 알림이 없어요</h2>
            <p className="pn-emptytext">
              선생님 메시지나 주간 리포트가 도착하면
              <br />
              여기에서 알려드릴게요!
            </p>
            <Link to={PATHS.PARENT_HOME} className="pn-emptycta">
              <i className="ph-fill ph-chart-line-up" />
              주간 요약 보기
            </Link>
          </div>
        )}
      </section>
    </ParentLayout>
  );
}
