/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import CountUp from '../../components/motion/CountUp';
import { PATHS } from '../../routes/paths';
import { parentApi } from '../../api/parents';
import { notificationApi, type Notification } from '../../api/notifications';
import { parseServerDate } from '../../utils/format';
import { reportApi } from '../../api/misc';
import { dateSuffix, downloadCanvasPng } from '../../utils/download';
import { canvasToPdf } from '../../utils/pdf';
import { drawWeeklyReport } from '../../utils/reportImage';
import ParentLayout from '../../layouts/ParentLayout';
import './ParentHome.css';

/**
 * handoff `CatChap 학부모.dc.html`(하은) + `CatChap 학부모 도윤.dc.html`(도윤) 통합 포팅.
 * `?child=doyun` 쿼리로 자녀 뷰 전환 — 단일 페이지 통합이므로 도윤 뷰에서도
 * 하은 원본의 인터랙티브 벨(드롭다운+토스트)을 그대로 사용한다.
 */

interface NotifItem {
  id: string;
  icon: string;
  color: string;
  bg: string;
  title: string;
  preview: string;
  time: string;
  unread: boolean;
}

interface Banner {
  bg: string;
  shadow: string;
  icon: string;
  iconColor: string;
  badgeColor: string;
  titleColor: string;
  bodyColor: string;
  title: string;
  body: string;
}

interface StatCard {
  icon: string;
  iconBg: string;
  iconColor: string;
  badge: string;
  badgeColor: string;
  badgeBg: string;
  value: string;
  unit: string;
  label: string;
}

type ViewKey = 'haeun' | 'doyun';

/* ===== 시각 템플릿용 데이터 (요약이 없을 때 배너/통계 스캐폴딩) ===== */

/** 스위처 자녀 색 순환 — 첫째=산호, 둘째=보라, 이후 반복 */
const CHILD_THEMES = [
  { active: '#FF5A4D', shadow: 'rgba(255,90,77,0.7)', avatarBg: '#FFE7D8', avatarColor: '#FF8A5B' },
  { active: '#8B6BFF', shadow: 'rgba(139,107,255,0.7)', avatarBg: '#EDE6FF', avatarColor: '#8B6BFF' },
];

const BANNERS_HAEUN: Record<string, Banner> = {
  '좋음': {
    bg: 'linear-gradient(120deg,#DBF5E8,#C6EEDB)', shadow: 'rgba(40,170,120,0.45)',
    icon: 'ph-fill ph-hand-waving', iconColor: '#17B08C', badgeColor: '#158A6E',
    titleColor: '#1E6B4E', bodyColor: '#3E8266',
    title: '{n}이가 이번 주에 꾸준히 잘 하고 있어요!',
    body: '캡챠 게임으로 국어·과학을 즐겁게 풀었어요. 수학 게임은 조금 더 함께하면 좋아요.',
  },
  '학습 뜸함': {
    bg: 'linear-gradient(120deg,#FFF3D6,#FFE7B0)', shadow: 'rgba(210,160,40,0.45)',
    icon: 'ph-fill ph-moon-stars', iconColor: '#E0940A', badgeColor: '#B5720B',
    titleColor: '#8A5A00', bodyColor: '#9A6B14',
    title: '{n}이가 요즘 학습이 조금 뜸해요',
    body: '며칠 게임을 쉬어간 것 같아요. 오늘 5분, 좋아하는 캡챠 게임 한 판부터 같이 시작해볼까요?',
  },
  '도움 필요': {
    bg: 'linear-gradient(120deg,#FFE0E4,#FFD1DB)', shadow: 'rgba(220,90,110,0.45)',
    icon: 'ph-fill ph-hand-heart', iconColor: '#E0475E', badgeColor: '#D33A54',
    titleColor: '#B23048', bodyColor: '#A8556A',
    title: '{n}이에게 조금 더 관심이 필요해요',
    body: '수학 캡챠 게임을 어려워하고 있어요. 오늘은 옆에서 한 문제만 함께 풀어주시면 큰 힘이 돼요.',
  },
};

const BANNERS_DOYUN: Record<string, Banner> = {
  '좋음': {
    bg: 'linear-gradient(120deg,#DBF5E8,#C6EEDB)', shadow: 'rgba(40,170,120,0.45)',
    icon: 'ph-fill ph-hand-waving', iconColor: '#17B08C', badgeColor: '#158A6E',
    titleColor: '#1E6B4E', bodyColor: '#3E8266',
    title: '{n}이가 이번 주에 꾸준히 잘 하고 있어요!',
    body: '한글과 그림 찾기에서 강점을 보였고, 숫자 놀이에서는 조금 더 연습하면 좋아요.',
  },
  '학습 뜸함': {
    bg: 'linear-gradient(120deg,#FFF3D6,#FFE7B0)', shadow: 'rgba(210,160,40,0.45)',
    icon: 'ph-fill ph-moon-stars', iconColor: '#E0940A', badgeColor: '#B5720B',
    titleColor: '#8A5A00', bodyColor: '#9A6B14',
    title: '{n}이가 요즘 학습이 조금 뜸해요',
    body: '며칠 쉬어간 것 같아요. 오늘 5분만 함께 시작해볼까요? 짧은 놀이부터 추천해요.',
  },
  '도움 필요': {
    bg: 'linear-gradient(120deg,#FFE0E4,#FFD1DB)', shadow: 'rgba(220,90,110,0.45)',
    icon: 'ph-fill ph-hand-heart', iconColor: '#E0475E', badgeColor: '#D33A54',
    titleColor: '#B23048', bodyColor: '#A8556A',
    title: '{n}이에게 조금 더 관심이 필요해요',
    body: '숫자 놀이에서 어려워하고 있어요. 오늘은 옆에서 함께 풀어주시면 큰 힘이 돼요.',
  },
};

// TODO(api): parentApi.childSummary() 실패 시 원본 하드코딩 요약 데이터 유지
const FALLBACK: Record<ViewKey, { name: string; status: string; banners: Record<string, Banner>; stats: StatCard[] }> = {
  haeun: {
    name: '하은',
    status: '좋음',
    banners: BANNERS_HAEUN,
    stats: [
      { icon: 'ph-fill ph-calendar-check', iconBg: '#FFEDE0', iconColor: '#FF922E', badge: '+3회', badgeColor: '#17B08C', badgeBg: '#E1F5EC', value: '14', unit: '회', label: '이번 주 학습 횟수' },
      { icon: 'ph-fill ph-target', iconBg: '#E1F5EC', iconColor: '#17B08C', badge: '+4%p', badgeColor: '#17B08C', badgeBg: '#E1F5EC', value: '89', unit: '%', label: '평균 정답률' },
      { icon: 'ph-fill ph-timer', iconBg: '#E6F0FF', iconColor: '#2E7BFF', badge: '-2초', badgeColor: '#8A8072', badgeBg: '#F3EEE7', value: '12', unit: '초', label: '평균 풀이 시간' },
      { icon: 'ph-fill ph-medal', iconBg: '#FFF3D6', iconColor: '#F0A400', badge: '+2개', badgeColor: '#17B08C', badgeBg: '#E1F5EC', value: '3', unit: '개', label: '이번 주 새 배지' },
    ],
  },
  doyun: {
    name: '도윤',
    status: '학습 뜸함',
    banners: BANNERS_DOYUN,
    stats: [
      { icon: 'ph-fill ph-calendar-check', iconBg: '#FFEDE0', iconColor: '#FF922E', badge: '-2회', badgeColor: '#17B08C', badgeBg: '#E1F5EC', value: '6', unit: '회', label: '이번 주 학습 횟수' },
      { icon: 'ph-fill ph-target', iconBg: '#E1F5EC', iconColor: '#17B08C', badge: '+4%p', badgeColor: '#17B08C', badgeBg: '#E1F5EC', value: '84', unit: '%', label: '평균 정답률' },
      { icon: 'ph-fill ph-timer', iconBg: '#E6F0FF', iconColor: '#2E7BFF', badge: '-2초', badgeColor: '#8A8072', badgeBg: '#F3EEE7', value: '18', unit: '초', label: '평균 풀이 시간' },
      { icon: 'ph-fill ph-medal', iconBg: '#FFF3D6', iconColor: '#F0A400', badge: '+1개', badgeColor: '#17B08C', badgeBg: '#E1F5EC', value: '1', unit: '개', label: '이번 주 새 배지' },
    ],
  },
};

const STRENGTHS = [
  { label: '한글 낱말 찾기', pct: 96 },
  { label: '그림 찾기 퀴즈', pct: 92 },
  { label: '안전 지킴이', pct: 88 },
];

const WEAKNESSES = [
  { label: '숫자 놀이터', pct: 72 },
  { label: '끌어놓기 (드래그)', pct: 78 },
  { label: '받침 낱말 완성', pct: 75 },
];

const RECOMMENDS = [
  { icon: 'ph-fill ph-plus-minus', color: '#FF922E', text: '숫자 놀이터를 하루 5문제씩, 난이도는 조금 낮춰서' },
  { icon: 'ph-fill ph-hand-grabbing', color: '#17B08C', text: '큰 카드로 드래그 연습 — 목표 칸을 크게 설정했어요' },
  { icon: 'ph-fill ph-book-open-text', color: '#8B6BFF', text: '헷갈린 낱말 5개를 소리 내어 함께 읽어보기' },
];

/** 원본 REASON 카드 3종 — 슬롯별 배지 클래스는 디자인 그대로, 내용만 API로 교체 */
const REASON_SLOTS: { badgeClass: string; icon: string; tag: string; body: ReactNode }[] = [
  {
    badgeClass: 'ph-reasonBadgeBlue',
    icon: 'ph-fill ph-hand-tap',
    tag: '조작 어려움',
    body: (
      <>
        개념은 이해했지만 정답 위치 근처에서 두 번 놓쳐, <b className="ph-reasonBoldBlue">터치·드래그 조작</b>에 살짝 어려움이 있었어요.
      </>
    ),
  },
  {
    badgeClass: 'ph-reasonBadgePink',
    icon: 'ph-fill ph-lightbulb',
    tag: '개념 혼동',
    body: (
      <>
        드래그 조작은 원활했지만 <b className="ph-reasonBoldPink">덧셈·뺄셈 개념</b>에서 헷갈린 것으로 보여요. 함께 세어보면 좋아요.
      </>
    ),
  },
  {
    badgeClass: 'ph-reasonBadgePurple',
    icon: 'ph-fill ph-arrows-left-right',
    tag: '선택지 혼동',
    body: (
      <>
        비슷한 <b className="ph-reasonBoldPurple">낱말 그림</b> 사이에서 여러 번 오갔어요. 헷갈리는 낱말을 함께 읽어보면 도움이 돼요.
      </>
    ),
  },
];

/** 원본 히어로 배지 기간 문구 (API period_label 실패 시 fallback) */
const PERIOD_LABEL_FALLBACK = '6월 넷째 주 (6.22~6.28)';

/* ===== API 응답 → 화면 상태 변환 (키/타입 불일치 보정) ===== */

/** class_name "1-2반" → "1학년" (API가 학년을 직접 주지 않을 때) */
function gradeFromClass(className: any): string | null {
  if (typeof className !== 'string') return null;
  const m = /^(\d+)/.exec(className);
  return m ? `${m[1]}학년` : null;
}

/** "14회" / "89%" → { value: '14', unit: '회' } — 카드의 값/단위 분리 표기용 */
function splitValueUnit(raw: any): { value: string; unit: string } | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const s = String(raw).trim();
  const m = /^([0-9][0-9.,]*)\s*(.*)$/.exec(s);
  if (!m) return { value: s, unit: '' };
  return { value: m[1], unit: m[2] };
}

/** "96%" → 96 */
function pctNum(raw: any): number | null {
  const n = parseFloat(String(raw).replace('%', ''));
  return Number.isFinite(n) ? n : null;
}

/** GET /summary strengths/weaknesses [{pct:'96%',name}] → [{label,pct:number}] */
function mapSwList(list: any, fb: { label: string; pct: number }[]): { label: string; pct: number }[] {
  if (!Array.isArray(list) || !list.length) return fb;
  return list.map((it: any, i: number) => ({
    label: typeof it?.name === 'string' && it.name ? it.name : (it?.label ?? fb[i % fb.length]?.label ?? ''),
    pct: pctNum(it?.pct) ?? fb[i % fb.length]?.pct ?? 0,
  }));
}

/* ===== 알림 — 실제 notificationApi.list()만 사용 (데모 시뮬레이션 제거) ===== */

/** API 알림 type/category → 원본 아이콘·색 매핑 (미지정 시 원본 토스트 기본색) */
const NOTIF_STYLES: Record<string, { icon: string; color: string; bg: string }> = {
  report: { icon: 'ph-fill ph-file-text', color: '#2E7BFF', bg: '#E6F0FF' },
  badge: { icon: 'ph-fill ph-medal', color: '#F0A400', bg: '#FFF3D6' },
  learning: { icon: 'ph-fill ph-check-circle', color: '#17B08C', bg: '#E1F5EC' },
  recommend: { icon: 'ph-fill ph-lightbulb', color: '#8B6BFF', bg: '#EAE2FF' },
  focus: { icon: 'ph-fill ph-timer', color: '#FF922E', bg: '#FFEDD6' },
  goal: { icon: 'ph-fill ph-star', color: '#FF5A6E', bg: '#FFE3E9' },
  // 실제 백엔드 type 값 (teacher/ai/remind) — 알림 페이지와 동일 팔레트
  teacher: { icon: 'ph-fill ph-chalkboard-teacher', color: '#FF5A4D', bg: '#FFE7E2' },
  ai: { icon: 'ph-fill ph-robot', color: '#2E7BFF', bg: '#E6F0FF' },
  remind: { icon: 'ph-fill ph-fire', color: '#FF922E', bg: '#FFEDE0' },
};

const NOTIF_STYLE_DEFAULT = { icon: 'ph-fill ph-bell', color: '#FF5A4D', bg: '#FFE0DB' };

function notifStyle(n: Notification) {
  return NOTIF_STYLES[n.type] ?? NOTIF_STYLES[n.category] ?? NOTIF_STYLE_DEFAULT;
}

function timeLabel(iso: string): string {
  // 서버는 KST naive 문자열 — parseServerDate로 절대시각 고정
  const t = parseServerDate(iso).getTime();
  if (Number.isNaN(t)) return '방금';
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day === 1) return '어제';
  return `${day}일 전`;
}

function mapApiNotif(n: Notification): NotifItem {
  const s = notifStyle(n);
  return {
    id: n.id, icon: s.icon, color: s.color, bg: s.bg,
    title: n.title, preview: n.message, time: timeLabel(n.created_at), unread: !n.read_at,
  };
}

export default function ParentHome() {
  const [searchParams] = useSearchParams();

  /* ----- 자녀 목록 / 요약 ----- */
  const [children, setChildren] = useState<any[] | null>(null); // null=로딩중, []=연결된 자녀 없음
  const [summary, setSummary] = useState<any | null>(null);

  useEffect(() => {
    let cancelled = false;
    parentApi
      .children()
      // 연결된 자녀가 없으면 빈 배열 — 데모 자녀(FALLBACK)를 실데이터처럼 보여주지 않는다.
      .then((list) => {
        if (!cancelled) setChildren(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setChildren([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loaded = children !== null;
  const rawChildren: any[] = children ?? [];
  // ?child= 숫자 인덱스로 자녀 전환(레거시 'doyun'→1). 실제 자녀 수로 클램프 → N명 지원.
  const childParam = searchParams.get('child');
  const reqIdx = childParam === 'doyun' ? 1 : childParam && /^\d+$/.test(childParam) ? parseInt(childParam, 10) : 0;
  const activeIdx = Math.min(Math.max(0, reqIdx), Math.max(rawChildren.length - 1, 0));
  // API: [{id, nickname, age, status, student_code, class_name, ...}] — name/grade는 nickname/class_name에서 매핑
  const switcher = rawChildren.map((c: any) => ({
    id: c.id != null ? String(c.id) : null,
    name: String(c.nickname ?? c.name ?? ''),
    grade: String(
      c.grade_label ??
        (typeof c.grade === 'number' ? `${c.grade}학년` : c.grade) ??
        gradeFromClass(c.class_name) ??
        '',
    ),
  }));

  useEffect(() => {
    setSummary(null);
    const id = rawChildren[activeIdx]?.id;
    if (id == null) return;
    let cancelled = false;
    parentApi
      .childSummary(String(id))
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children, activeIdx]);

  // 시각 템플릿(배너 색/아이콘·통계 레이아웃)만 FALLBACK에서 — 값은 summary(실집계 or 데모)로 덮인다.
  const fbKey: ViewKey = activeIdx === 1 ? 'doyun' : 'haeun';
  const fb = FALLBACK[fbKey];
  // 자녀에게 실제 학습 기록이 없어 백엔드가 프리셋을 내려준 경우(demo) — 화면에 '데모' 표시.
  const isDemo = !!summary?.demo;
  const childName = switcher[activeIdx]?.name || fb.name;
  const status: string = summary?.status && fb.banners[summary.status] ? summary.status : fb.status;
  // API banner {title, body}는 이미 자녀 이름이 반영된 문구 — 색/아이콘 등 디자인 값은 status별 원본 유지
  const bannerBase = fb.banners[status];
  const banner: Banner = {
    ...bannerBase,
    title: typeof summary?.banner?.title === 'string' && summary.banner.title ? summary.banner.title : bannerBase.title,
    body: typeof summary?.banner?.body === 'string' && summary.banner.body ? summary.banner.body : bannerBase.body,
  };
  const periodLabel: string =
    typeof summary?.period_label === 'string' && summary.period_label ? summary.period_label : PERIOD_LABEL_FALLBACK;
  // API 키는 kpis([{delta,label,value}], value는 '6회'처럼 단위 포함 문자열) — stats 키는 구버전 호환
  const apiKpis: any[] | null = Array.isArray(summary?.kpis)
    ? summary.kpis
    : Array.isArray(summary?.stats)
      ? summary.stats
      : null;
  const stats: StatCard[] = fb.stats.map((s, i) => {
    const api = apiKpis?.[i];
    if (!api) return s;
    const sv = splitValueUnit(api.value);
    return {
      ...s,
      value: sv ? sv.value : s.value,
      unit: sv && sv.unit ? sv.unit : s.unit,
      badge: api.delta != null ? String(api.delta) : s.badge,
      label: typeof api.label === 'string' && api.label ? api.label : s.label,
    };
  });
  // 강점/약점: API [{pct:'96%',name}] → [{label,pct:number}] / 추천·이유: 색상 등 디자인 값은 슬롯별 원본 유지
  const strengths = mapSwList(summary?.strengths, STRENGTHS);
  const weaknesses = mapSwList(summary?.weaknesses, WEAKNESSES);
  const recommends: { icon: string; color: string; text: string }[] =
    Array.isArray(summary?.recommendations) && summary.recommendations.length
      ? summary.recommendations.map((rc: any, i: number) => {
          const slot = RECOMMENDS[i % RECOMMENDS.length];
          return {
            icon: typeof rc?.icon === 'string' && rc.icon ? rc.icon : slot.icon,
            color: slot.color,
            text: typeof rc?.text === 'string' && rc.text ? rc.text : slot.text,
          };
        })
      : RECOMMENDS;
  const reasons: { badgeClass: string; icon: string; tag: string; body: ReactNode }[] =
    Array.isArray(summary?.reasons) && summary.reasons.length
      ? summary.reasons.map((rs: any, i: number) => {
          const slot = REASON_SLOTS[i % REASON_SLOTS.length];
          return {
            badgeClass: slot.badgeClass,
            icon: typeof rs?.icon === 'string' && rs.icon ? rs.icon : slot.icon,
            tag: typeof rs?.tag === 'string' && rs.tag ? rs.tag : slot.tag,
            body: (typeof rs?.body === 'string' && rs.body ? rs.body : slot.body) as ReactNode,
          };
        })
      : REASON_SLOTS;

  /* ----- 실시간 알림 ----- */
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotifItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState<NotifItem | null>(null);
  const [bellShake, setBellShake] = useState(false);

  const notifOpenRef = useRef(false);
  const apiModeRef = useRef(false);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const pollIvRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const bellTimerRef = useRef<number | null>(null);

  useEffect(() => {
    notifOpenRef.current = notifOpen;
  }, [notifOpen]);

  const receive = useCallback((item: NotifItem) => {
    setNotifs((prev) => [item, ...prev].slice(0, 12));
    setToast(item);
    setUnread((prev) => (notifOpenRef.current ? 0 : prev + 1));
    setBellShake(true);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 5200);
    if (bellTimerRef.current) window.clearTimeout(bellTimerRef.current);
    bellTimerRef.current = window.setTimeout(() => setBellShake(false), 900);
  }, []);

  useEffect(() => {
    let cancelled = false;

    notificationApi
      .list()
      .then((list) => {
        if (cancelled) return;
        apiModeRef.current = true;
        seenIdsRef.current = new Set(list.map((n) => n.id));
        setNotifs(list.slice(0, 12).map(mapApiNotif));
        setUnread(list.filter((n) => !n.read_at).length);
        pollIvRef.current = window.setInterval(() => {
          notificationApi
            .list()
            .then((cur) => {
              const fresh = cur.filter((n) => !seenIdsRef.current.has(n.id));
              if (!fresh.length) return;
              fresh
                .slice()
                .reverse()
                .forEach((n) => {
                  seenIdsRef.current.add(n.id);
                  const s = notifStyle(n);
                  receive({
                    id: n.id, icon: s.icon, color: s.color, bg: s.bg,
                    title: n.title, preview: n.message, time: '방금', unread: true,
                  });
                });
            })
            .catch(() => {
              // TODO(api): 폴링 일시 실패 — 다음 주기에 재시도
            });
        }, 10000);
      })
      .catch(() => {
        // 알림 조회 실패 시 데모 시뮬레이션 대신 빈 알림 유지
        if (!cancelled) setNotifs([]);
      });

    return () => {
      cancelled = true;
      if (pollIvRef.current) window.clearInterval(pollIvRef.current);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (bellTimerRef.current) window.clearTimeout(bellTimerRef.current);
    };
  }, [receive]);

  const syncMarkAllRead = () => {
    if (apiModeRef.current) {
      notificationApi.markAllRead().catch(() => {
        // TODO(api): 읽음 동기화 실패 무시(로컬 상태는 원본대로 유지)
      });
    }
  };

  const toggleNotif = () => {
    const opening = !notifOpen;
    setNotifOpen(opening);
    notifOpenRef.current = opening;
    setUnread(0);
    setToast(null);
    if (opening) {
      setNotifs((ns) => ns.map((x) => ({ ...x, unread: false })));
      syncMarkAllRead();
    }
  };

  const closeNotif = () => {
    setNotifOpen(false);
    notifOpenRef.current = false;
  };

  const markAllRead = () => {
    setUnread(0);
    setNotifs((ns) => ns.map((x) => ({ ...x, unread: false })));
    syncMarkAllRead();
  };

  const openFromToast = () => {
    setNotifOpen(true);
    notifOpenRef.current = true;
    setUnread(0);
    setToast(null);
    setNotifs((ns) => ns.map((x) => ({ ...x, unread: false })));
    syncMarkAllRead();
  };

  const dismissToast = (e: MouseEvent) => {
    e.stopPropagation();
    setToast(null);
  };

  /* ----- 주간 리포트 다운로드 ----- */
  const flashToast = (item: NotifItem) => {
    setToast(item);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 5200);
  };

  const downloadReport = async (format: 'pdf' | 'png' = 'pdf') => {
    try {
      // 화면 실데이터로 주간 리포트를 그려 즉시 파일 저장 (기본 PDF, 이미지도 선택 가능)
      const canvas = drawWeeklyReport({
        childName,
        periodLabel,
        stats: stats.map((s) => ({ label: s.label, value: s.value, unit: s.unit, badge: s.badge })),
        strengths: strengths.map((b) => ({ label: b.label, pct: b.pct })),
        weaknesses: weaknesses.map((b) => ({ label: b.label, pct: b.pct })),
        recommends: recommends.map((r) => r.text),
      });
      // await 필수 — canvasToPdf가 async(jspdf 지연 로드)라 안 기다리면 실패가
      // catch에 안 걸리고 성공 토스트만 뜬다(가짜 성공 금지)
      if (format === 'pdf') await canvasToPdf(`${childName}_주간리포트_${dateSuffix()}.pdf`, canvas);
      else downloadCanvasPng(`${childName}_주간리포트_${dateSuffix()}.png`, canvas);
      flashToast({
        id: 'dl-ok-' + Date.now(), icon: 'ph-fill ph-check-circle', color: '#17B08C', bg: '#E1F5EC',
        title: `주간 리포트 ${format === 'pdf' ? 'PDF' : '이미지'}를 저장했어요`, preview: '다운로드 폴더에서 확인해 주세요.', time: '방금', unread: false,
      });
      // 다운로드 감사 기록 (백엔드 audit) — 실패해도 파일 저장엔 영향 없음
      reportApi
        .list()
        .then((reports: any) => {
          const arr = Array.isArray(reports) ? reports : reports?.items;
          const latest = Array.isArray(arr) ? arr[0] : null;
          if (latest?.id != null) reportApi.requestDownload(String(latest.id)).catch(() => {});
        })
        .catch(() => {});
    } catch {
      flashToast({
        id: 'dl-fail-' + Date.now(), icon: 'ph-fill ph-warning', color: '#FF5A6E', bg: '#FFE3E9',
        title: '리포트 저장에 실패했어요', preview: '잠시 후 다시 시도해 주세요.', time: '방금', unread: false,
      });
    }
  };

  /* ----- 자녀 연결 모달 ----- */
  const [linkOpen, setLinkOpen] = useState(false);
  const [linked, setLinked] = useState(false);
  const [code, setCode] = useState('');
  const [linkError, setLinkError] = useState('');

  const openLink = () => {
    setLinkOpen(true);
    setLinked(false);
    setCode('');
    setLinkError('');
  };
  const closeLink = () => setLinkOpen(false);
  const onCodeChange = (e: ChangeEvent<HTMLInputElement>) => {
    // 초대코드 형식 LINK-XXXX-XXXX (최대 14자)
    setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 14));
    setLinkError('');
  };
  const confirmLink = () => {
    const c = code.trim();
    if (!c) return;
    setLinkError('');
    // 성공을 미리 위장하지 않는다 — 서버가 실제로 연결한 뒤에만 성공 화면 전환
    parentApi
      .linkInvite(c)
      .then(() => {
        setLinked(true);
        parentApi
          .children()
          .then((list) => {
            if (Array.isArray(list) && list.length > 0) setChildren(list);
          })
          .catch(() => {});
      })
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      .catch((err: any) => {
        const st = err?.response?.status;
        setLinkError(
          st === 404
            ? '초대코드가 올바르지 않아요. 다시 확인해 주세요.'
            : st === 410
              ? '만료되었거나 이미 다 사용된 초대코드예요.'
              : st === 409
                ? '이미 연결된 자녀예요.'
                : st === 429
                  ? '시도가 너무 많아요. 잠시 후 다시 시도해 주세요.'
                  : '연결에 실패했어요. 초대코드를 다시 확인해 주세요.',
        );
      });
  };

  /* ----- 인터랙티브 벨 (ParentLayout bell slot) ----- */
  const bell = (
    <div className="ph-bellWrap">
      <button onClick={toggleNotif} title="알림" className="ph-bellBtn">
        <i
          className="ph-fill ph-bell ph-bellIcon"
          style={{ animation: bellShake ? 'phBellShake .8s ease' : 'none' }}
        />
        {unread > 0 && <span className="ph-bellBadge">{unread > 9 ? '9+' : String(unread)}</span>}
      </button>
      {notifOpen && (
        <>
          <div onClick={closeNotif} className="ph-notifOverlay" />
          <div className="ph-notifDrop">
            <div className="ph-notifHead">
              <div className="ph-notifHeadLeft">
                <i className="ph-fill ph-bell ph-notifHeadIcon" />
                <span className="ph-notifHeadTitle">알림</span>
              </div>
              <button onClick={markAllRead} className="ph-markAll">모두 읽음</button>
            </div>
            <div className="ph-notifList">
              {notifs.length === 0 && (
                <div className="ph-notifEmpty">아직 새로운 알림이 없어요</div>
              )}
              {notifs.map((n) => (
                <div key={n.id} className={'ph-notifRow' + (n.unread ? ' ph-notifRowUnread' : '')}>
                  <span className="ph-notifRowIcon" style={{ background: n.bg, color: n.color }}>
                    <i className={n.icon} />
                  </span>
                  <div className="ph-notifRowBody">
                    <div className="ph-notifRowTitleLine">
                      <span className="ph-notifRowTitle">{n.title}</span>
                      {n.unread && <span className="ph-notifDot" />}
                    </div>
                    <div className="ph-notifRowPreview">{n.preview}</div>
                  </div>
                  <span className="ph-notifRowTime">{n.time}</span>
                </div>
              ))}
            </div>
            <Link to={PATHS.PARENT_NOTIFICATIONS} className="ph-notifAll">
              모든 알림 보기 <i className="ph-bold ph-arrow-right" />
            </Link>
          </div>
        </>
      )}
    </div>
  );

  return (
    <ParentLayout className="ph-bg" bell={bell}>
      <div className="ph-container">
        {!loaded ? (
          <div className="ph-emptyState">불러오는 중…</div>
        ) : rawChildren.length === 0 ? (
          <div className="ph-emptyState">
            <div className="ph-emptyIcon"><i className="ph-fill ph-users-three" /></div>
            <h2 className="ph-emptyTitle">아직 연결된 자녀가 없어요</h2>
            <p className="ph-emptyText">
              학교에서 받은 <b>자녀 초대코드</b>를 입력하면 자녀의 학습 현황을 볼 수 있어요.
            </p>
            <button onClick={openLink} className="ph-emptyBtn">
              <i className="ph-bold ph-plus" /> 자녀 연결하기
            </button>
          </div>
        ) : (
          <>
        {/* CHILD SWITCHER */}
        <div className="ph-switcher">
          <span className="ph-switcherLabel">자녀 선택</span>
          <div className="ph-switcherBtns">
            {switcher.map((c, i) => {
              const theme = CHILD_THEMES[i % CHILD_THEMES.length];
              return i === activeIdx ? (
                <button
                  key={c.id ?? c.name}
                  className="ph-childActive"
                  style={{ '--ph-active': theme.active, '--ph-activeShadow': theme.shadow } as CSSProperties}
                >
                  <span className="ph-childActiveAvatar">{c.name.charAt(0)}</span>
                  <span className="ph-childName">{c.name} · {c.grade}</span>
                </button>
              ) : (
                <Link
                  key={c.id ?? c.name}
                  to={i === 0 ? PATHS.PARENT_HOME : `${PATHS.PARENT_HOME}?child=${i}`}
                  className="ph-childLink"
                  style={{ '--ph-avatarBg': theme.avatarBg, '--ph-avatarColor': theme.avatarColor } as CSSProperties}
                >
                  <span className="ph-childLinkAvatar">{c.name.charAt(0)}</span>
                  <span className="ph-childName">{c.name} · {c.grade}</span>
                </Link>
              );
            })}
            <button onClick={openLink} className="ph-childAdd">
              <i className="ph-bold ph-plus" />자녀 연결
            </button>
          </div>
        </div>

        {/* SUMMARY HERO */}
        <div className="ph-hero" style={{ background: banner.bg, boxShadow: `0 20px 40px -26px ${banner.shadow}` }}>
          <div className="ph-heroCircle" />
          <div className="ph-heroIconBox">
            <i className={banner.icon} style={{ color: banner.iconColor }} />
          </div>
          <div className="ph-heroBody">
            <span className="ph-heroBadge" style={{ color: banner.badgeColor }}>
              {periodLabel} · {status}
            </span>
            <h1 className="ph-heroTitle" style={{ color: banner.titleColor }}>
              {banner.title.replace('{n}', childName)}
            </h1>
            <p className="ph-heroText" style={{ color: banner.bodyColor }}>{banner.body}</p>
          </div>
        </div>

        {/* 실제 학습 기록이 없어 예시(데모) 수치가 표시될 때 알림 — 실데이터로 오인 방지 */}
        {isDemo && (
          <div className="ph-demoNotice">
            <i className="ph-fill ph-info" />
            아직 자녀의 학습 기록이 없어 <b>예시(데모) 수치</b>를 보여드려요. 자녀가 학습을 시작하면 실제 데이터로 채워집니다.
          </div>
        )}

        {/* WEEKLY STATS */}
        <div className="ph-statsGrid">
          {stats.map((s) => (
            <div key={s.label} className="ph-statCard">
              <div className="ph-statTop">
                <span className="ph-statIcon" style={{ background: s.iconBg, color: s.iconColor }}>
                  <i className={s.icon} />
                </span>
                <span className="ph-statBadge" style={{ color: s.badgeColor, background: s.badgeBg }}>{s.badge}</span>
              </div>
              <div className="ph-statValue">
                <CountUp value={s.value} />
                <span className="ph-statUnit">{s.unit}</span>
              </div>
              <div className="ph-statLabel">{s.label}</div>
            </div>
          ))}
        </div>

        {/* STRENGTHS / WEAKNESS */}
        <div className="ph-swGrid">
          <div className="ph-swCard">
            <div className="ph-swHead">
              <span className="ph-swHeadIcon ph-swHeadIconGood">
                <i className="ph-fill ph-thumbs-up" />
              </span>
              <h3 className="ph-swTitle">잘하고 있어요</h3>
            </div>
            <div className="ph-swList">
              {strengths.map((s) => (
                <div key={s.label}>
                  <div className="ph-swRowHead">
                    <span>{s.label}</span>
                    <span className="ph-swPctGood">{s.pct}%</span>
                  </div>
                  <div className="ph-swTrack ph-swTrackGood">
                    <div className="ph-swFill ph-swFillGood" style={{ width: `${s.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="ph-swCard">
            <div className="ph-swHead">
              <span className="ph-swHeadIcon ph-swHeadIconWeak">
                <i className="ph-fill ph-sparkle" />
              </span>
              <h3 className="ph-swTitle">조금 더 연습해 볼 부분</h3>
            </div>
            <div className="ph-swList">
              {weaknesses.map((s) => (
                <div key={s.label}>
                  <div className="ph-swRowHead">
                    <span>{s.label}</span>
                    <span className="ph-swPctWeak">{s.pct}%</span>
                  </div>
                  <div className="ph-swTrack ph-swTrackWeak">
                    <div className="ph-swFill ph-swFillWeak" style={{ width: `${s.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* REASON CARDS */}
        <div className="ph-reasonSection">
          <h2 className="ph-reasonH2">이런 점을 살펴봤어요</h2>
          <p className="ph-reasonSub">틀린 이유를 쉬운 말로 알려드려요. 확정이 아닌 참고용 추정이에요.</p>
          <div className="ph-reasonGrid">
            {reasons.map((rs, i) => (
              <div key={i} className="ph-reasonCard">
                <span className={`ph-reasonBadge ${rs.badgeClass}`}>
                  <i className={rs.icon} />{rs.tag}
                </span>
                <p className="ph-reasonText">{rs.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* RECOMMEND + REPORT */}
        <div className="ph-bottomGrid">
          <div className="ph-recoCard">
            <div className="ph-recoHead">
              <span className="ph-recoHeadIcon">
                <i className="ph-fill ph-star-four" />
              </span>
              <h3 className="ph-recoTitle">이번 주 추천</h3>
            </div>
            <div className="ph-recoList">
              {recommends.map((r) => (
                <div key={r.text} className="ph-recoRow">
                  <i className={r.icon} style={{ color: r.color }} />
                  <span className="ph-recoText">{r.text}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="ph-reportCard">
            <div className="ph-reportHead">
              <span className="ph-reportHeadIcon">
                <i className="ph-fill ph-file-pdf" />
              </span>
              <h3 className="ph-reportTitle">성적표 받기</h3>
            </div>
            <p className="ph-reportText">자녀 학습 리포트를 PDF로 저장하거나 공유 링크로 보낼 수 있어요.</p>
            <div className="ph-reportShield">
              <i className="ph-fill ph-shield-check" />다운로드 시 CAPTCHA + OTP 확인
            </div>
            <button onClick={() => downloadReport('pdf')} className="ph-reportBtn">주간 리포트 다운로드 (PDF)</button>
            <button
              onClick={() => downloadReport('png')}
              className="ph-reportBtn"
              style={{ marginTop: 8, background: '#fff', color: '#FF5A4D', border: '1.5px solid #FFD9CC' }}
            >
              이미지(PNG)로 저장
            </button>
          </div>
        </div>

        <p className="ph-footNote">연결된 자녀의 요약 정보만 표시됩니다 · 다른 학생의 이름·점수, 원본 행동 데이터는 제공되지 않아요.</p>
          </>
        )}
      </div>

      {/* ===== CHILD LINK MODAL ===== */}
      {linkOpen && (
        <div className="ph-modalOverlay">
          <div className="ph-modal">
            <div className="ph-modalHead">
              <div className="ph-modalHeadIcon">
                <i className="ph-fill ph-link" />
              </div>
              <div className="ph-modalHeadText">
                <div className="ph-modalHeadTitle">자녀 연결</div>
                <div className="ph-modalHeadSub">학교 발급 초대코드로 자녀 계정을 연결해요</div>
              </div>
              <button onClick={closeLink} className="ph-modalClose">
                <i className="ph-bold ph-x" />
              </button>
            </div>

            {!linked ? (
              <div className="ph-modalBody">
                <div className="ph-modalStudentWrap">
                  <div className="ph-modalStudentIcon">
                    <i className="ph-fill ph-student" />
                  </div>
                </div>
                <h3 className="ph-modalTitle">학교에서 받은 초대코드를 입력해 주세요</h3>
                <p className="ph-modalDesc">
                  초대코드는 자녀가 다니는 <b>학교(기관)에서 발급</b>해요.<br />담임 선생님이나 기관에 요청하면 받을 수 있어요.
                </p>

                <label className="ph-modalLabel">초대코드</label>
                <div className="ph-modalInputWrap">
                  <i className="ph-fill ph-identification-badge ph-modalInputIcon" />
                  <input
                    type="text"
                    placeholder="예) LINK-7QX3-9K2M"
                    value={code}
                    onChange={onCodeChange}
                    className="ph-modalInput"
                  />
                </div>
                {linkError ? (
                  <div className="ph-modalHint" style={{ color: '#E0475E' }}>
                    <i className="ph-fill ph-warning-circle" />
                    <span className="ph-modalHintText">{linkError}</span>
                  </div>
                ) : (
                  <div className="ph-modalHint">
                    <i className="ph-fill ph-shield-check" />
                    <span className="ph-modalHintText">초대코드는 1회용이며 유효기간이 있어요. 안전하게 연결돼요.</span>
                  </div>
                )}

                <button onClick={confirmLink} className="ph-modalConfirm">
                  <i className="ph-fill ph-link" />연결하기
                </button>
                <button onClick={closeLink} className="ph-modalCancel">취소</button>
              </div>
            ) : (
              <div className="ph-modalSuccess">
                <div className="ph-modalSuccessIcon">
                  <i className="ph-fill ph-check-circle" />
                </div>
                <h3 className="ph-modalSuccessTitle">연결되었어요!</h3>
                <p className="ph-modalSuccessText">
                  코드 <b className="ph-modalSuccessCode">{code}</b> 로<br />자녀 계정이 바로 연동되었어요.<br />이제 자녀의 학습 현황을 확인할 수 있어요.
                </p>
                <button onClick={closeLink} className="ph-modalSuccessBtn">확인</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LIVE NOTIFICATION TOAST */}
      {toast && (
        <div onClick={openFromToast} className="ph-toast">
          <span className="ph-toastIcon" style={{ background: toast.bg, color: toast.color }}>
            <i className={toast.icon} />
          </span>
          <div className="ph-toastBody">
            <div className="ph-toastMeta">
              <span className="ph-toastNew">NEW</span>
              <span className="ph-toastTime">방금</span>
            </div>
            <div className="ph-toastTitle">{toast.title}</div>
            <div className="ph-toastPreview">{toast.preview}</div>
          </div>
          <button onClick={dismissToast} className="ph-toastClose">
            <i className="ph-bold ph-x" />
          </button>
        </div>
      )}
    </ParentLayout>
  );
}
