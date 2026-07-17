import { useEffect, useRef, useState, type CSSProperties } from 'react';
import CountUp from '../../components/motion/CountUp';
import DemoBadge from '../../components/common/DemoBadge';
import { Link } from 'react-router-dom';
import StudentLayout from '../../layouts/StudentLayout';
import { PATHS } from '../../routes/paths';
import { useAuth } from '../../hooks/useAuth';
import { studentApi } from '../../api/students';
import { lectureApi, type LectureItem } from '../../api/lectures';
import { notificationApi } from '../../api/notifications';
import mascot from '../../assets/characters/catchap-logo.png';
import './StudentHome.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface SubjectCard {
  subject: string;
  grad: string;
  shadow: string;
  shadowHover: string;
  icon: string;
  desc: string;
  descColor: string;
  done: number;
  total: number;
}

interface WeekBar {
  day: string;
  time: string;
  height: string;
  tone: 'mid' | 'hi' | 'low';
}

interface HomeData {
  todayDone: number;
  todayTotal: number;
  mascotMessage: string;
  showRank: boolean;
  rankLabel: string;
  subjects: SubjectCard[];
  streakDays: number;
  weekSolved: number;
  accuracy: number;
  weekDelta: string;
  weekTotal: string;
  weekBars: WeekBar[];
  badgeCount: number;
  aiComment: string;
}

// TODO(api): studentApi.dashboard() 실패 시 원본 하드코딩 데이터 유지
const FALLBACK: HomeData = {
  todayDone: 2,
  todayTotal: 6,
  mascotMessage: '오늘도 같이 배워볼까?',
  showRank: false,
  rankLabel: '상위 30%',
  subjects: [
    {
      subject: '국어',
      grad: 'linear-gradient(160deg,#FF7A7A,#FF5A6E)',
      shadow: 'rgba(255,90,110,0.8)',
      shadowHover: 'rgba(255,90,110,0.85)',
      icon: 'ph-fill ph-book-open',
      desc: '글자와 낱말을 배우는 오늘의 국어 강의 한 편',
      descColor: 'rgba(255,255,255,0.9)',
      done: 5,
      total: 5,
    },
    {
      subject: '영어',
      grad: 'linear-gradient(160deg,#FFB43C,#FF922E)',
      shadow: 'rgba(255,160,40,0.8)',
      shadowHover: 'rgba(255,160,40,0.85)',
      icon: 'ph-fill ph-translate',
      desc: '알파벳과 쉬운 단어를 배우는 영어 강의 한 편',
      descColor: 'rgba(255,255,255,0.92)',
      done: 3,
      total: 5,
    },
    {
      subject: '수학',
      grad: 'linear-gradient(160deg,#33C892,#17B0A0)',
      shadow: 'rgba(30,190,150,0.8)',
      shadowHover: 'rgba(30,190,150,0.85)',
      icon: 'ph-fill ph-plus-minus',
      desc: '수와 셈을 재미있게 배우는 수학 강의 한 편',
      descColor: 'rgba(255,255,255,0.92)',
      done: 5,
      total: 5,
    },
    {
      subject: '과학',
      grad: 'linear-gradient(160deg,#4AA6FF,#2E7BFF)',
      shadow: 'rgba(46,123,255,0.8)',
      shadowHover: 'rgba(46,123,255,0.85)',
      icon: 'ph-fill ph-flask',
      desc: '그림으로 관찰하고 탐구하는 과학 강의 한 편',
      descColor: 'rgba(255,255,255,0.92)',
      done: 0,
      total: 5,
    },
    {
      subject: '사회',
      grad: 'linear-gradient(160deg,#A98CFF,#8B6BFF)',
      shadow: 'rgba(139,107,255,0.8)',
      shadowHover: 'rgba(139,107,255,0.85)',
      icon: 'ph-fill ph-scroll',
      desc: '학교와 마을, 민주주의를 배우는 사회 강의 한 편',
      descColor: 'rgba(255,255,255,0.92)',
      done: 0,
      total: 5,
    },
    {
      subject: '생활',
      grad: 'linear-gradient(160deg,#FF93BE,#FF6DA6)',
      shadow: 'rgba(255,109,166,0.8)',
      shadowHover: 'rgba(255,109,166,0.85)',
      icon: 'ph-fill ph-house-line',
      desc: '생활 속 안전과 지혜를 배우는 생활 강의 한 편',
      descColor: 'rgba(255,255,255,0.92)',
      done: 0,
      total: 5,
    },
  ],
  streakDays: 12,
  weekSolved: 86,
  accuracy: 92,
  weekDelta: '지난주보다 +18%',
  weekTotal: '5h 43m',
  weekBars: [
    { day: '월', time: '40m', height: '45%', tone: 'mid' },
    { day: '화', time: '58m', height: '65%', tone: 'mid' },
    { day: '수', time: '36m', height: '40%', tone: 'mid' },
    { day: '목', time: '1h 12m', height: '80%', tone: 'mid' },
    { day: '금', time: '1h 30m', height: '100%', tone: 'hi' },
    { day: '토', time: '27m', height: '30%', tone: 'low' },
    { day: '일', time: '20m', height: '22%', tone: 'low' },
  ],
  badgeCount: 8,
  aiComment: '“그림 찾기가 조금 어려웠구나! 천천히 다시 해보면 금방 늘어요.”',
};

/* 원본 DCLogic의 CHEERS / SPOTS 그대로 */
const CHEERS = [
  { full: '오늘도 와줘서 정말 고마워! 🐾', short: '고마워!', icon: 'ph-fill ph-hand-heart', color: '#FF5A4D' },
  { full: '{n}이 너무 잘하고 있어!', short: '잘하고 있어!', icon: 'ph-fill ph-thumbs-up', color: '#2E7BFF' },
  { full: '우와, {n} 최고야! 🌟', short: '최고야!', icon: 'ph-fill ph-crown-simple', color: '#F0A400' },
  { full: '참 잘했어요! 👏', short: '참 잘했어요!', icon: 'ph-fill ph-star', color: '#FFB01F' },
  { full: '천천히 해도 괜찮아, {n}!', short: '괜찮아!', icon: 'ph-fill ph-hand-peace', color: '#17B08C' },
  { full: '{n}이랑 공부하니 즐거워!', short: '즐거워!', icon: 'ph-fill ph-smiley', color: '#FF6DA6' },
  { full: '반짝반짝 빛나는 중! ✨', short: '반짝반짝!', icon: 'ph-fill ph-sparkle', color: '#8B6BFF' },
  { full: '조금씩 매일매일, {n} 대단해!', short: '대단해!', icon: 'ph-fill ph-fire', color: '#FF922E' },
];
const SPOTS = [
  { left: '-8%', top: '30%' },
  { left: '62%', top: '58%' },
  { left: '2%', top: '64%' },
  { left: '58%', top: '22%' },
];

interface Pop {
  id: string;
  text: string;
  icon: string;
  color: string;
  left: string;
  top: string;
}

const QUICK_MENU = [
  { label: '개념 설명', to: PATHS.STUDENT_CONCEPTS, bg: '#FFE7D8', color: '#FF7A4D', icon: 'ph-fill ph-book-bookmark', badge: null as string | null, badgeNew: false },
  { label: '오늘의 강의', to: PATHS.STUDENT_LECTURES, bg: '#FFEDE0', color: '#FF922E', icon: 'ph-fill ph-video-camera', badge: null as string | null, badgeNew: false },
  { label: '오답 노트', to: PATHS.STUDENT_WRONG_NOTES, bg: '#FFE3E9', color: '#FF5A6E', icon: 'ph-fill ph-notebook', badge: null, badgeNew: false },
  { label: '추천 문제', to: PATHS.STUDENT_RECOMMENDED, bg: '#EDE6FF', color: '#8B6BFF', icon: 'ph-fill ph-sparkle', badge: null, badgeNew: false },
  { label: '성장 리포트', to: PATHS.STUDENT_RECORDS, bg: '#DFF6ED', color: '#17B08C', icon: 'ph-fill ph-chart-line-up', badge: null, badgeNew: false },
  { label: '설정', to: PATHS.STUDENT_SETTINGS, bg: '#FFE9F1', color: '#FF6DA6', icon: 'ph-fill ph-gear-six', badge: null, badgeNew: false },
];

const STAT_TILES = [
  { icon: 'ph-fill ph-fire', bg: '#FFEDE0', color: '#FF922E', unit: '일', label: '연속 학습', key: 'streakDays' as const },
  { icon: 'ph-fill ph-puzzle-piece', bg: '#E6F0FF', color: '#2E7BFF', unit: '개', label: '이번 주 푼 문제', key: 'weekSolved' as const },
  { icon: 'ph-fill ph-target', bg: '#E1F5EC', color: '#17B08C', unit: '%', label: '평균 정답률', key: 'accuracy' as const },
];

/**
 * GET /students/me/dashboard 응답 → HomeData 매핑.
 * 실제 응답 형태: { today:{done,total}, growth:{accuracy,week_bars[{day,pct,today?}],time_delta,streak_days,week_solved},
 *                 badges:{earned,total}, class_rank:{band,note}, subjects[{subject,desc,done,total,state,meta}],
 *                 ai_comment, mascot_message, ... }
 * API가 준 필드만 덮어쓰고(week_total·바 time 라벨 포함), 없는 필드는 FALLBACK 값을 유지한다.
 */
function mapDashboard(d: any, prev: HomeData): Partial<HomeData> {
  const out: Partial<HomeData> = {};

  if (typeof d.today?.done === 'number') out.todayDone = d.today.done;
  if (typeof d.today?.total === 'number') out.todayTotal = d.today.total;
  if (typeof d.mascot_message === 'string') out.mascotMessage = d.mascot_message;

  // class_rank: { band: '상위 30%', note } — band가 있으면 랭크 카드 노출
  if (typeof d.class_rank?.band === 'string' && d.class_rank.band) {
    out.showRank = true;
    out.rankLabel = d.class_rank.band;
  }

  const g = d.growth ?? {};
  if (typeof g.streak_days === 'number') out.streakDays = g.streak_days;
  if (typeof g.week_solved === 'number') out.weekSolved = g.week_solved;
  if (typeof g.accuracy === 'number') out.accuracy = g.accuracy;
  // time_delta: '+18%' → 화면 문구 '지난주보다 +18%'. 빈 문자열 = 지난주 실측 없음(비교 불능) —
  // FALLBACK 데모 델타(+18%)로 떨어뜨리지 않고 정직한 문구로 대체한다.
  if (typeof g.time_delta === 'string') {
    out.weekDelta = g.time_delta ? `지난주보다 ${g.time_delta}` : '이번 주 기록이 쌓이는 중이에요';
  }
  // week_total: 'Nh Nm' — 주간 총 학습시간 (solve_time_ms 실집계)
  if (typeof g.week_total === 'string' && g.week_total) out.weekTotal = g.week_total;

  // week_bars: [{ day, pct(0..100), time, today? }] → { day, time, height:'NN%', tone }
  if (Array.isArray(g.week_bars) && g.week_bars.length) {
    out.weekBars = g.week_bars.map((b: any, i: number): WeekBar => {
      const pct = typeof b?.pct === 'number' ? b.pct : 0;
      return {
        day: typeof b?.day === 'string' ? b.day : (prev.weekBars[i]?.day ?? ''),
        time: typeof b?.time === 'string' ? b.time : (prev.weekBars[i]?.time ?? ''),
        height: `${pct}%`,
        tone: b?.today ? 'hi' : pct < 35 ? 'low' : 'mid',
      };
    });
  }

  // badges: { earned, total } → 획득 개수만 사용
  if (typeof d.badges?.earned === 'number') out.badgeCount = d.badges.earned;
  if (typeof d.ai_comment === 'string' && d.ai_comment) out.aiComment = `“${d.ai_comment}”`;

  // subjects: 과목명 기준 매칭, done/total만 덮어씀 (색·아이콘 테마는 디자인 값 유지).
  // desc는 덮지 않는다 — 서버 dashboard desc는 퀴즈 문구라, 카드가 '오늘의 강의'로 전환되며
  // 정적 강의 소개 문구(FALLBACK)를 유지한다(시청 상태는 lect 소스가 담당).
  if (Array.isArray(d.subjects) && d.subjects.length) {
    out.subjects = prev.subjects.map((s) => {
      const m = d.subjects.find((x: any) => x?.subject === s.subject);
      if (!m) return s;
      return {
        ...s,
        done: typeof m.done === 'number' ? m.done : s.done,
        total: typeof m.total === 'number' ? m.total : s.total,
      };
    });
  }

  return out;
}

/** 과목별 '오늘의 강의' 카드 상태 — GET /lectures(내 진행 포함)에서 파생 */
interface SubjectLecture {
  id: string;
  title: string;
  state: 'new' | 'watching' | 'done'; // done = 그 과목 강의 전부 시청 완료
  frac: number; // 현재 강의 시청 비율(0~1) — 카드 세그먼트 표시용
}

/** 과목별 현재 강의: 목차 순서(order_no)에서 첫 미완료 강의, 전부 완료면 마지막 강의 */
function mapLectures(rows: LectureItem[]): Record<string, SubjectLecture> {
  const bySubject: Record<string, LectureItem[]> = {};
  rows.forEach((l) => {
    (bySubject[l.subject] = bySubject[l.subject] ?? []).push(l);
  });
  const out: Record<string, SubjectLecture> = {};
  Object.entries(bySubject).forEach(([sub, items]) => {
    const current = items.find((l) => l.progress?.status !== 'done');
    const pick = current ?? items[items.length - 1];
    if (!pick) return;
    const watched = pick.progress?.watched_max_sec ?? 0;
    out[sub] = {
      id: pick.id,
      title: pick.title,
      state: current ? (watched > 0 ? 'watching' : 'new') : 'done',
      frac: pick.duration_sec > 0 ? Math.min(1, watched / pick.duration_sec) : 0,
    };
  });
  return out;
}

export default function StudentHome() {
  const { me } = useAuth();
  const name = (me?.name ?? '하은').trim() || '하은';

  const [data, setData] = useState<HomeData>(FALLBACK);
  const [demo, setDemo] = useState(false); // 성장 그래프가 데모값(시도 없음)이면 true
  // 과목별 오늘의 강의(시청 기준) — null = 아직 조회 전 또는 실패(카드가 목록 링크로 폴백)
  const [lect, setLect] = useState<Record<string, SubjectLecture> | null>(null);
  const [scrollActive, setScrollActive] = useState<'home' | 'today'>('home');
  const [bubbleMessage, setBubbleMessage] = useState<string | null>(null);
  const [bubbleKey, setBubbleKey] = useState(0);
  const [pops, setPops] = useState<Pop[]>([]);
  const lastCheer = useRef(-1);
  // 학부모 연동 알림 팝업 (미읽음 parent_link 알림이 있으면 1회 노출)
  const [linkNotice, setLinkNotice] = useState<{ id: string; title: string; message: string } | null>(null);
  // 오늘의 생활 교육과정 과제 — '이어서 학습하기'를 실전 플레이로 연동 (실패 시 원본 데모 링크 유지)

  useEffect(() => {
    let mounted = true;
    studentApi
      .dashboard()
      .then((d: any) => {
        if (!mounted || !d) return;
        setDemo(!!d.demo);
        setData((prev) => ({ ...prev, ...mapDashboard(d, prev) }));
      })
      .catch(() => {
        // 실패 시 FALLBACK(예시값)을 실데이터처럼 보여주지 않는다 — 데모로 명시(적대적검토 #6).
        if (mounted) setDemo(true);
      });
    // 오늘의 강의 카드(시청 기준) — dashboard(성장 통계)와 별도 소스.
    // 백엔드 dashboard가 아직 시청 기준이 아니라 강의 목록 API에서 직접 파생한다(이중 소스 트레이드오프).
    // 실패 시 카드가 시청 상태 없이 '강의 보기'(목록 링크)로만 동작 — 가짜 진행 표시는 하지 않는다.
    lectureApi
      .list()
      .then((rows) => {
        if (!mounted || !Array.isArray(rows)) return;
        setLect(mapLectures(rows));
      })
      .catch(() => {
        if (mounted) setLect(null);
      });
    // (메인 CTA가 '오늘의 퀴즈'로 통일되면서 생활 일일 과제 조회는 오늘의퀴즈 페이지 몫)
    // 보호자 연동 알림: 안 읽은 parent_link 알림이 있으면 팝업으로 안내
    notificationApi
      .list()
      .then((rows) => {
        if (!mounted || !Array.isArray(rows)) return;
        const link = rows.find((n: any) => n.type === 'parent_link' && !n.read_at);
        if (link) setLinkNotice({ id: link.id, title: link.title, message: link.message });
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const closeLinkNotice = () => {
    if (linkNotice) notificationApi.markRead(linkNotice.id).catch(() => {});
    setLinkNotice(null);
  };

  /* 원본 componentDidMount: #today 해시 + 스크롤 위치로 NAV `홈` 활성 전환 */
  useEffect(() => {
    if (window.location.hash === '#today') setScrollActive('today');
    const onScroll = () => {
      const el = document.getElementById('today');
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      setScrollActive(top <= 140 ? 'today' : 'home');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* 원본 cheer(): 마스코트 클릭 응원 말풍선 + 팝업(ccRise) */
  const cheer = () => {
    let i = Math.floor(Math.random() * CHEERS.length);
    if (i === lastCheer.current) i = (i + 1) % CHEERS.length;
    lastCheer.current = i;
    const c = CHEERS[i];
    const spot = SPOTS[Math.floor(Math.random() * SPOTS.length)];
    const id = 'p' + Date.now() + Math.round(Math.random() * 999);
    setBubbleMessage(c.full.replace(/\{n\}/g, name));
    setBubbleKey((k) => k + 1);
    setPops((prev) => [
      ...prev,
      { id, text: c.short, icon: c.icon, color: c.color, left: spot.left, top: spot.top },
    ]);
    window.setTimeout(() => {
      setPops((prev) => prev.filter((p) => p.id !== id));
    }, 1850);
  };

  // 오늘 학습 진행 = 과목별 강의 시청 완료 수(시청 기준). 강의 데이터가 없으면 0/6로 정직 표시.
  const subjectLects = data.subjects.map((s) => lect?.[s.subject] ?? null);
  const lectAvailable = subjectLects.filter(Boolean).length;
  const total = lect && lectAvailable > 0 ? lectAvailable : Math.max(1, data.subjects.length);
  const done = subjectLects.filter((li) => li?.state === 'done').length;
  const barWidth = Math.round((done / total) * 100) + '%';
  // 다음에 볼 강의(목차 순 첫 미완료 과목) — 전부 다 봤거나 데이터 없으면 null → 강의 목록으로
  const nextLecture = subjectLects.find((li) => li && li.state !== 'done') ?? null;
  // 아직 오늘 강의를 다 못 본 과목 수 — 퀵메뉴 '오늘의 강의' 배지용
  const lectUndone = subjectLects.filter((li) => li && li.state !== 'done').length;

  return (
    <StudentLayout
      className="sh-root"
      active={scrollActive === 'today' ? null : 'home'}
      onHomeClick={() => setScrollActive('home')}
    >
      <div style={{ padding: '0 16px' }}><DemoBadge show={demo} variant="banner" /></div>
      {/* ================= HERO ================= */}
      <section className="sh-hero-sec">
        <div className="sh-hero">
          <div className="sh-hero-c1" />
          <div className="sh-hero-c2" />
          <div className="sh-dot1" />
          <div className="sh-dot2" />
          <div className="sh-dot3" />

          <div className="sh-hero-left">
            <span className="sh-hero-tag">
              <i className="ph-fill ph-paw-print" />
              오늘의 학습
            </span>
            <h1 className="sh-hero-title">
              안녕, {name}! <br />
              오늘도 만나서 반가워 🐾
            </h1>
            <p className="sh-hero-desc">
              고양이 선생님의 강의를 보고, 시청 중 확인 문제를 맞히며 재미있게 배워요.
            </p>

            <div className="sh-progress">
              <div className="sh-progress-head">
                <span className="sh-progress-label">오늘 학습 진행</span>
                <span className="sh-progress-count">
                  {done}
                  <span className="sh-progress-total">/{total} 완료</span>
                </span>
              </div>
              <div className="sh-progress-track">
                <div className="sh-progress-fill" style={{ width: barWidth }} />
              </div>
            </div>

            <div className="sh-cta-row">
              {/* 메인 CTA는 '오늘의 강의' — 목차 순 첫 미완료 과목의 강의실로 바로 진입.
                  강의 데이터가 없으면 강의 목록으로(가짜 진행 없이 목록에서 상태 확인). */}
              <Link
                to={nextLecture ? PATHS.STUDENT_LECTURE : PATHS.STUDENT_LECTURES}
                state={nextLecture ? { id: nextLecture.id } : undefined}
                className="sh-cta-primary"
              >
                <i className="ph-fill ph-play-circle" />
                {nextLecture
                  ? nextLecture.state === 'watching'
                    ? '오늘의 강의 이어서 보기'
                    : '오늘의 강의 시작하기'
                  : lect && lectAvailable > 0
                    ? '오늘 강의 다 봤어요 — 다시 보기'
                    : '오늘의 강의 시작하기'}
              </Link>
              <Link to={PATHS.STUDENT_ALL_LEARNING} className="sh-cta-secondary">
                전체 학습 보기
              </Link>
            </div>
          </div>

          <div className="sh-mascot-col">
            <div className="sh-pops">
              {pops.map((p) => (
                <div key={p.id} className="sh-pop" style={{ left: p.left, top: p.top }}>
                  <i className={p.icon} style={{ color: p.color }} />
                  <span className="sh-pop-text">{p.text}</span>
                </div>
              ))}
            </div>
            <div key={bubbleKey} className="sh-bubble">
              {bubbleMessage ?? data.mascotMessage}
              <div className="sh-bubble-tail" />
            </div>
            <div onClick={cheer} title="눌러서 응원 받기" className="sh-mascot">
              <img src={mascot} alt="CatChap 마스코트" className="sh-mascot-img" />
              <span className="sh-tap">
                <i className="ph-fill ph-hand-tap" />
                눌러봐
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ================= CATEGORY CARDS ================= */}
      <section id="today" className="sh-today-sec">
        <div className="sh-sechead">
          <div className="sh-sechead-left">
            <span className="sh-sechip sh-sechip-today">
              <i className="ph-fill ph-cards-three" />
            </span>
            <div>
              <h2 className="sh-sectitle">오늘의 강의</h2>
              <p className="sh-secsub">매일 강의 하나씩, 오늘 볼 여섯 편이에요</p>
            </div>
          </div>
          <Link to={PATHS.STUDENT_LECTURES} className="sh-seclink">
            강의 목차 보기 <i className="ph-bold ph-list-bullets" />
          </Link>
        </div>

        <div className="sh-cards">
          {data.subjects.map((s) => {
            // 시청 기준 카드 상태 — 강의 데이터가 없으면(로딩/실패/미등록) 목록 링크 + 진행 0으로 정직 표시
            const li = lect?.[s.subject] ?? null;
            const segTotal = 5; // 진행 세그먼트 해상도(디자인 그대로) — 시청 비율을 5칸에 매핑
            const segDone =
              li == null ? 0 : li.state === 'done' ? segTotal : Math.min(segTotal - 1, Math.floor(li.frac * segTotal));
            return (
              <div
                key={s.subject}
                className="sh-card"
                style={
                  {
                    '--sh-grad': s.grad,
                    '--sh-sh': s.shadow,
                    '--sh-shh': s.shadowHover,
                  } as CSSProperties
                }
              >
                <Link
                  to={li ? PATHS.STUDENT_LECTURE : PATHS.STUDENT_LECTURES}
                  state={li ? { id: li.id } : undefined}
                  aria-label={`${s.subject} 오늘의 강의`}
                  className="sh-card-link"
                />
                <div className="sh-card-deco" />
                <div className="sh-card-head">
                  <span className="sh-card-tag">{s.subject}</span>
                  <span className="sh-card-icon">
                    <i className={s.icon} />
                  </span>
                </div>
                <h3 className="sh-card-title">{s.subject}</h3>
                <p className="sh-card-desc" style={{ color: s.descColor }}>
                  {s.desc}
                </p>
                <div className="sh-card-segs">
                  {Array.from({ length: segTotal }, (_, i) => (
                    <div key={i} className={`sh-seg${i < segDone ? ' sh-on' : ''}`} />
                  ))}
                </div>
                <div className="sh-card-foot">
                  {li?.state === 'done' ? (
                    <span className="sh-status-done">
                      <i className="ph-fill ph-check-circle" />
                      오늘 강의 완료
                    </span>
                  ) : li?.state === 'watching' ? (
                    <span className="sh-status-plain">
                      <i className="ph-fill ph-play-circle" /> 강의 보는 중
                    </span>
                  ) : (
                    <span className="sh-status-plain">오늘 강의</span>
                  )}
                  <span className="sh-card-action">
                    {li?.state === 'done' ? (
                      <>
                        다시 보기 <i className="ph-bold ph-arrow-clockwise" />
                      </>
                    ) : li?.state === 'watching' ? (
                      <>
                        이어서 보기 <i className="ph-bold ph-arrow-right" />
                      </>
                    ) : (
                      <>
                        강의 보기 <i className="ph-bold ph-arrow-right" />
                      </>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ================= QUICK MENU ================= */}
      <section id="quick" className="sh-quick-sec">
        <div className="sh-quick">
          <div className="sh-quick-grid">
            {QUICK_MENU.map((q) => {
              // 오늘의 강의 배지 = 아직 다 못 본 과목 수(시청 기준). 다 봤으면 '완료' 배지.
              // 강의 데이터가 없으면(실패/미등록) 배지를 붙이지 않는다 — 가짜 카운트 금지.
              const isLect = q.to === PATHS.STUDENT_LECTURES;
              const badge = isLect
                ? lect && lectAvailable > 0
                  ? lectUndone > 0
                    ? String(lectUndone)
                    : '완료'
                  : null
                : q.badge;
              const badgeDone = isLect && !!lect && lectAvailable > 0 && lectUndone === 0;
              return (
                <Link key={q.label} to={q.to} className="sh-quick-item">
                  <span className="sh-quick-icon" style={{ background: q.bg, color: q.color }}>
                    <i className={q.icon} />
                    {badge && (
                      <span
                        className={`sh-quick-badge${q.badgeNew ? ' sh-new' : ''}${badgeDone ? ' sh-done' : ''}`}
                      >
                        {badge}
                      </span>
                    )}
                  </span>
                  <span className="sh-quick-label">{q.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= GROWTH ================= */}
      <section id="growth" className="sh-growth-sec">
        <div className="sh-sechead-left" style={{ marginBottom: 20 }}>
          <span className="sh-sechip sh-sechip-growth">
            <i className="ph-fill ph-seal-check" />
          </span>
          <div>
            <h2 className="sh-sectitle">{name}의 성장 이야기</h2>
            <p className="sh-secsub">어제보다 더 자란 나를 만나요</p>
          </div>
        </div>

        <div className="sh-growth-grid">
          {/* left: stat tiles + weekly chart */}
          <div className="sh-growth-left">
            <div className="sh-stats">
              {STAT_TILES.map((t) => (
                <div key={t.label} className="sh-stat">
                  <span className="sh-stat-icon" style={{ background: t.bg, color: t.color }}>
                    <i className={t.icon} />
                  </span>
                  <div className="sh-stat-value">
                    <CountUp value={data[t.key]} />
                    <span className="sh-stat-unit">{t.unit}</span>
                  </div>
                  <div className="sh-stat-label">{t.label}</div>
                </div>
              ))}
            </div>

            <div className="sh-chart">
              <div className="sh-chart-head">
                <h3 className="sh-chart-title">
                  이번 주 학습 시간 <span className="sh-chart-total">{data.weekTotal}</span>
                </h3>
                <span className="sh-chart-delta">{data.weekDelta}</span>
              </div>
              <div className="sh-bars">
                {data.weekBars.map((b) => (
                  <div key={b.day} className="sh-bar-col" title={`${b.day} · ${b.time}`}>
                    {/* 막대 위 시간 라벨 — 호버 없이도 요일별 학습 시간이 보인다 */}
                    <span className="sh-bar-time">{b.time}</span>
                    <div className={`sh-bar sh-bar-${b.tone}`} style={{ height: b.height }} />
                    <span className={`sh-bar-label${b.tone === 'hi' ? ' sh-hi-label' : ''}`}>
                      {b.day}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* right: 추천 — 배지·학년 랭킹·AI선생님 카드는 게임화 잔재 정리(0718)로 제거 */}
          <div className="sh-growth-right">
            <Link to={PATHS.STUDENT_RECOMMENDED} className="sh-reco">
              <div className="sh-reco-icon">
                <i className="ph-fill ph-sparkle" />
              </div>
              <div className="sh-reco-body">
                <div className="sh-reco-titlerow">
                  <span className="sh-reco-name">취약 문제 추천 AI</span>
                  <span className="sh-reco-new">NEW</span>
                </div>
                <p className="sh-reco-text">오답이 잦았던 곳만 모아 딱 맞춤 문제를 추천해요.</p>
              </div>
              <span className="sh-reco-go">
                바로가기 <i className="ph-bold ph-arrow-right" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="sh-footer">
        <div className="sh-footer-top">
          <div className="sh-footer-logo">
            <img src={mascot} alt="CatChap" className="sh-footer-img" />
            <div>
              <div className="sh-footer-name">CatChap</div>
              <div className="sh-footer-sub">영상 시청을 검증하는 강의 학습 서비스</div>
            </div>
          </div>
          <div className="sh-footer-links">
            <Link to={PATHS.SUPPORT} className="sh-footer-link">
              이용안내
            </Link>
            <Link to={PATHS.PRIVACY} className="sh-footer-link">
              개인정보 보호
            </Link>
            <Link to={PATHS.CONTACT} className="sh-footer-link">
              고객 지원
            </Link>
          </div>
        </div>
        <p className="sh-footer-copy">
          © 2026 CatChap · 카카오클라우드 AIaaS 마스터 클래스 5기. 학습자의 시청 데이터는 안전하게
          보호됩니다.
        </p>
      </footer>

      {/* 보호자 연동 알림 팝업 — 학교 발급 초대코드로 연결됐을 때 1회 안내 */}
      {linkNotice && (
        <div className="sh-linkpop-bg" onClick={closeLinkNotice}>
          <div className="sh-linkpop" onClick={(e) => e.stopPropagation()}>
            <div className="sh-linkpop-icon">
              <i className="ph-fill ph-link" />
            </div>
            <h3 className="sh-linkpop-title">{linkNotice.title}</h3>
            <p className="sh-linkpop-msg">{linkNotice.message}</p>
            <button className="sh-linkpop-ok" onClick={closeLinkNotice}>
              <i className="ph-fill ph-check-circle" />확인했어요
            </button>
          </div>
        </div>
      )}
    </StudentLayout>
  );
}
