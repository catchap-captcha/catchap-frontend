import { useEffect, useRef, useState, type CSSProperties } from 'react';
import CountUp from '../../components/motion/CountUp';
import DemoBadge from '../../components/common/DemoBadge';
import { Link } from 'react-router-dom';
import StudentLayout from '../../layouts/StudentLayout';
import { PATHS } from '../../routes/paths';
import { useAuth } from '../../hooks/useAuth';
import { studentApi } from '../../api/students';
import { notificationApi } from '../../api/notifications';
import { RANKING_ENABLED } from '../../config/features';
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
      desc: '낱말·문장·글의 속뜻을 익히는 오늘의 국어 한 판',
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
      desc: '단어·문장·문법으로 배우는 영어 한 판',
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
      desc: '수·연산·도형·측정을 배우는 수학 한 판',
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
      desc: '그림을 관찰하고 탐구하는 과학 한 판',
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
      desc: '지도·지역·공공기관을 알아가는 사회 한 판',
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
      desc: '생활 속 안전과 지혜를 배우는 생활 한 판',
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
  { label: '오늘의 퀴즈', to: PATHS.STUDENT_DAILY_QUIZ, bg: '#FFEDE0', color: '#FF922E', icon: 'ph-fill ph-lightning', badge: '3', badgeNew: false },
  { label: '오답 노트', to: PATHS.STUDENT_WRONG_NOTES, bg: '#FFE3E9', color: '#FF5A6E', icon: 'ph-fill ph-notebook', badge: null, badgeNew: false },
  { label: '획득 배지', to: PATHS.STUDENT_BADGES, bg: '#FFF3D6', color: '#F0A400', icon: 'ph-fill ph-medal', badge: null, badgeNew: false },
  { label: 'AI 선생님', to: PATHS.STUDENT_AI_TEACHER, bg: '#E6F0FF', color: '#2E7BFF', icon: 'ph-fill ph-robot', badge: 'NEW', badgeNew: true },
  { label: '추천 문제', to: PATHS.STUDENT_RECOMMENDED, bg: '#EDE6FF', color: '#8B6BFF', icon: 'ph-fill ph-sparkle', badge: null, badgeNew: false },
  { label: '성장 리포트', to: PATHS.STUDENT_RECORDS, bg: '#DFF6ED', color: '#17B08C', icon: 'ph-fill ph-chart-line-up', badge: null, badgeNew: false },
  { label: '마이페이지', to: PATHS.STUDENT_PROFILE, bg: '#FFE9F1', color: '#FF6DA6', icon: 'ph-fill ph-cat', badge: null, badgeNew: false },
];

const STAT_TILES = [
  { icon: 'ph-fill ph-fire', bg: '#FFEDE0', color: '#FF922E', unit: '일', label: '연속 학습', key: 'streakDays' as const },
  { icon: 'ph-fill ph-puzzle-piece', bg: '#E6F0FF', color: '#2E7BFF', unit: '개', label: '이번 주 푼 문제', key: 'weekSolved' as const },
  { icon: 'ph-fill ph-target', bg: '#E1F5EC', color: '#17B08C', unit: '%', label: '평균 정답률', key: 'accuracy' as const },
];

const BADGE_ICONS = [
  { icon: 'ph-fill ph-star', color: '#FF922E' },
  { icon: 'ph-fill ph-heart', color: '#FF5A6E' },
  { icon: 'ph-fill ph-lightning', color: '#2E7BFF' },
  { icon: 'ph-fill ph-crown-simple', color: '#17B08C' },
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
  // time_delta: '+18%' → 화면 문구 '지난주보다 +18%'
  if (typeof g.time_delta === 'string' && g.time_delta) out.weekDelta = `지난주보다 ${g.time_delta}`;
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

  // subjects: 과목명 기준 매칭, done/total/desc만 덮어씀 (색·아이콘 테마는 디자인 값 유지)
  if (Array.isArray(d.subjects) && d.subjects.length) {
    out.subjects = prev.subjects.map((s) => {
      const m = d.subjects.find((x: any) => x?.subject === s.subject);
      if (!m) return s;
      return {
        ...s,
        done: typeof m.done === 'number' ? m.done : s.done,
        total: typeof m.total === 'number' ? m.total : s.total,
        desc: typeof m.desc === 'string' && m.desc ? m.desc : s.desc,
      };
    });
  }

  return out;
}

export default function StudentHome() {
  const { me } = useAuth();
  const name = (me?.name ?? '하은').trim() || '하은';

  const [data, setData] = useState<HomeData>(FALLBACK);
  const [demo, setDemo] = useState(false); // 성장 그래프가 데모값(시도 없음)이면 true
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
        // TODO(api): 백엔드 미구현/실패 시 FALLBACK 유지
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

  const total = Math.max(1, data.todayTotal);
  const done = Math.min(total, Math.max(0, data.todayDone));
  const barWidth = Math.round((done / total) * 100) + '%';
  // 오늘의 퀴즈에서 다음에 풀 과목(첫 미완료) — 다 끝냈으면 null
  const nextQuizSubject = data.subjects.find((sub) => sub.done < sub.total)?.subject ?? null;

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
              오늘의 퀴즈
            </span>
            <h1 className="sh-hero-title">
              안녕, {name}! <br />
              오늘도 만나서 반가워 🐾
            </h1>
            <p className="sh-hero-desc">
              고양이 친구와 함께 그림을 고르고, 끌어놓고, 낱말을 맞추며 재미있게 배워요.
            </p>

            <div className="sh-progress">
              <div className="sh-progress-head">
                <span className="sh-progress-label">오늘의 퀴즈 진행</span>
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
              {/* 메인은 '오늘의 퀴즈'로 통일 — 첫 미완료 과목의 퀴즈 세션으로 바로 진입.
                  (생활 일일 과제·주간 챕터는 각각 오늘의퀴즈 페이지·전체 학습에서) */}
              <Link
                to={
                  nextQuizSubject
                    ? `${PATHS.STUDENT_GAME}?subject=${encodeURIComponent(nextQuizSubject)}`
                    : PATHS.STUDENT_DAILY_QUIZ
                }
                className="sh-cta-primary"
              >
                <i className="ph-fill ph-play-circle" />
                {nextQuizSubject
                  ? done > 0
                    ? '오늘의 퀴즈 이어서 풀기'
                    : '오늘의 퀴즈 시작하기'
                  : '오늘의 퀴즈 다시 보기'}
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
              <h2 className="sh-sectitle">오늘의 퀴즈</h2>
              <p className="sh-secsub">여섯 과목을 매일 5문제씩 — 오늘의 퀴즈로 하루 습관을 만들어요</p>
            </div>
          </div>
          <Link to={PATHS.STUDENT_CONCEPTS} className="sh-seclink">
            개념 먼저 보기 <i className="ph-bold ph-book-bookmark" />
          </Link>
        </div>

        <div className="sh-cards">
          {data.subjects.map((s) => (
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
                to={`${PATHS.STUDENT_GAME}?subject=${encodeURIComponent(s.subject)}${
                  s.done >= s.total ? '&replay=1' : ''
                }`}
                aria-label={`${s.subject} 오늘의 퀴즈`}
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
                {Array.from({ length: s.total }, (_, i) => (
                  <div key={i} className={`sh-seg${i < s.done ? ' sh-on' : ''}`} />
                ))}
              </div>
              <div className="sh-card-foot">
                {s.done >= s.total ? (
                  <span className="sh-status-done">
                    <i className="ph-fill ph-check-circle" />
                    {s.total}문제 중 {s.done}개 완료
                  </span>
                ) : (
                  <span className="sh-status-plain">
                    {s.total}문제 중 {s.done}개 완료
                  </span>
                )}
                <span className="sh-card-action">
                  {s.done >= s.total ? (
                    <>
                      다시 하기 <i className="ph-bold ph-arrow-clockwise" />
                    </>
                  ) : s.done > 0 ? (
                    <>
                      이어서 하기 <i className="ph-bold ph-arrow-right" />
                    </>
                  ) : (
                    <>
                      시작하기 <i className="ph-bold ph-arrow-right" />
                    </>
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ================= QUICK MENU ================= */}
      <section id="quick" className="sh-quick-sec">
        <div className="sh-quick">
          <div className="sh-quick-grid">
            {QUICK_MENU.map((q) => (
              <Link key={q.label} to={q.to} className="sh-quick-item">
                <span className="sh-quick-icon" style={{ background: q.bg, color: q.color }}>
                  <i className={q.icon} />
                  {q.badge && (
                    <span className={`sh-quick-badge${q.badgeNew ? ' sh-new' : ''}`}>{q.badge}</span>
                  )}
                </span>
                <span className="sh-quick-label">{q.label}</span>
              </Link>
            ))}
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
                <h3 className="sh-chart-title" title={`이번 주 총 학습 시간 · ${data.weekTotal}`}>
                  이번 주 학습 시간
                </h3>
                <span className="sh-chart-delta">{data.weekDelta}</span>
              </div>
              <div className="sh-bars" title={`이번 주 총 학습 시간 · ${data.weekTotal}`}>
                {data.weekBars.map((b) => (
                  <div key={b.day} className="sh-bar-col" title={`${b.day} · ${b.time}`}>
                    <div className={`sh-bar sh-bar-${b.tone}`} style={{ height: b.height }} />
                    <span className={`sh-bar-label${b.tone === 'hi' ? ' sh-hi-label' : ''}`}>
                      {b.day}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* right: badges + rank */}
          <div className="sh-growth-right">
            <div className="sh-badges">
              <div className="sh-badges-head">
                <h3 className="sh-badges-title">내가 모은 배지</h3>
                <span className="sh-badges-count">{data.badgeCount}개 획득</span>
              </div>
              <div className="sh-badges-row">
                {BADGE_ICONS.map((b) => (
                  <div key={b.icon} className="sh-badge" style={{ color: b.color }}>
                    <i className={b.icon} />
                  </div>
                ))}
                <div className="sh-badge-locked">
                  <i className="ph-bold ph-lock-simple" />
                  <span className="sh-badge-next">다음</span>
                </div>
              </div>
            </div>

            {!RANKING_ENABLED ? (
              <div className="sh-rank">
                <div className="sh-rank-head">
                  <span className="sh-rank-chip">
                    <i className="ph-fill ph-trophy" />
                  </span>
                  <h3 className="sh-rank-title">우리 학년에서 나의 위치</h3>
                </div>
                <p className="sh-rank-text">
                  학년 랭킹은 <span className="sh-rank-pct">준비중</span>이에요.
                  <br />
                  곧 만나요 🐾
                </p>
              </div>
            ) : (
              data.showRank && (
                <div className="sh-rank">
                  <div className="sh-rank-head">
                    <span className="sh-rank-chip">
                      <i className="ph-fill ph-trophy" />
                    </span>
                    <h3 className="sh-rank-title">우리 학년에서 나의 위치</h3>
                  </div>
                  <p className="sh-rank-text">
                    우리 학년 <span className="sh-rank-pct">{data.rankLabel}</span> 구간이에요.
                    <br />
                    친구 이름·점수는 보이지 않아요 🙂
                  </p>
                </div>
              )
            )}

            <div className="sh-ai">
              <div className="sh-ai-avatar">
                <i className="ph-fill ph-robot" />
              </div>
              <div className="sh-ai-body">
                <div className="sh-ai-name">AI 선생님 냥냥이</div>
                <p className="sh-ai-text">{data.aiComment}</p>
              </div>
            </div>

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
              <div className="sh-footer-sub">놀면서 배우는 어린이 캡챠 학습 서비스</div>
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
          © 2026 CatChap · 카카오클라우드 AIaaS 마스터 클래스 5기. 어린이의 학습 데이터는 안전하게
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
