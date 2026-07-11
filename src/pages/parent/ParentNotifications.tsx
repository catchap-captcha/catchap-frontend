/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import ParentLayout from '../../layouts/ParentLayout';
import { PATHS } from '../../routes/paths';
import { notificationApi, type Notification } from '../../api/notifications';
import { parentApi } from '../../api/parents';
import { kstDateString, parseServerDate } from '../../utils/format';
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
  // 미연동/데이터 없음 시 데모 알림(하은) 대신 빈 상태 — 실제 알림이 있을 때만 채운다
  const [today, setToday] = useState<PnItem[]>([]);
  const [earlier, setEarlier] = useState<PnItem[]>([]);
  const [chips, setChips] = useState<PnChip[]>([{ key: 'all', label: '전체' }]);
  const [view, setView] = useState<'list' | 'empty'>('empty');
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
        // '오늘' 경계는 KST 자정 기준 — 브라우저 로컬 자정이 아니라
        const todayStr = kstDateString();
        list.forEach((n) => {
          (kstDateString(parseServerDate(n.created_at)) === todayStr ? t : e).push(toItem(n, nameById));
        });
        setToday(t);
        setEarlier(e);
        setView('list');
      }
      // 실패/비배열 응답은 빈 상태(기본값) 유지 — 데모 알림을 보이지 않음
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
