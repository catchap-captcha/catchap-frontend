import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { useAuth } from '../../hooks/useAuth';
import { studentApi } from '../../api/students';
import ScreenTimeReminder from '../../components/motion/ScreenTimeReminder';
import mascot from '../../assets/characters/catchap-logo.png';
import './DailyQuiz.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

type QuizStatus = 'done' | 'progress' | 'todo';

interface QuizCard {
  subject: string;
  topic: string;
  status: QuizStatus;
  reward: number;
  icon: string;
  c1: string;
  c2: string;
  stageDone?: number; // 오늘 완료한 단계 수(5단계 바용)
  stages?: number; // 총 단계(기본 5)
}

interface WeekDay {
  label: string;
  done: boolean;
  today?: boolean;
}

interface QuizData {
  coins: number;
  streakDays: number;
  quizzes: QuizCard[];
  week: WeekDay[];
}

// TODO(api): studentApi.dailyQuiz() 실패 시 원본 하드코딩 데이터 유지
// (원본의 카드 href는 존재하지 않는 개별 게임 파일 → 전부 게임화면 ?subject= 로 통일)
const FALLBACK: QuizData = {
  coins: 340,
  streakDays: 4,
  quizzes: [
    { subject: '국어', topic: '그림 보고 낱말 찾기', status: 'done', reward: 10, icon: 'ph-fill ph-book-open', c1: '#FF7A7A', c2: '#FF5A6E' },
    { subject: '영어', topic: '단어와 문장', status: 'progress', reward: 10, icon: 'ph-fill ph-translate', c1: '#FFB43C', c2: '#FF922E' },
    { subject: '수학', topic: '더하기·빼기 놀이', status: 'todo', reward: 15, icon: 'ph-fill ph-plus-minus', c1: '#33C892', c2: '#17B0A0' },
    { subject: '과학', topic: '관찰하고 골라요', status: 'todo', reward: 15, icon: 'ph-fill ph-flask', c1: '#4AA6FF', c2: '#2E7BFF' },
    { subject: '사회', topic: '옛날 이야기 속으로', status: 'todo', reward: 20, icon: 'ph-fill ph-scroll', c1: '#A98CFF', c2: '#8B6BFF' },
    { subject: '생활', topic: '안전하게 생활해요', status: 'todo', reward: 15, icon: 'ph-fill ph-house-line', c1: '#FF93BE', c2: '#FF6DA6' },
  ],
  week: [
    { label: '월', done: true },
    { label: '화', done: true },
    { label: '수', done: true },
    { label: '목', done: true },
    { label: '금', done: false, today: true },
    { label: '토', done: false },
    { label: '일', done: false },
  ],
};

/* ---- API 응답 → 화면 상태 변환 (GET /students/me/daily-quiz) ----
 * quizzes[].meta.grad("linear-gradient(...,#A,#B)") → c1/c2, meta.icon → icon */
function parseGrad(grad: unknown): [string, string] | null {
  if (typeof grad !== 'string') return null;
  const m = grad.match(/#[0-9A-Fa-f]{3,8}/g);
  return m && m.length >= 2 ? [m[0], m[m.length - 1]] : null;
}

function mapApiQuizzes(list: any, prev: QuizCard[]): QuizCard[] {
  if (!Array.isArray(list)) return prev;
  const mapped = list
    .map((q: any): QuizCard | null => {
      if (!q || typeof q.subject !== 'string') return null;
      const base = prev.find((p) => p.subject === q.subject);
      const grad = parseGrad(q.meta?.grad);
      const metaColor = typeof q.meta?.color === 'string' ? q.meta.color : undefined;
      return {
        subject: q.subject,
        topic: typeof q.topic === 'string' ? q.topic : base?.topic ?? '',
        status:
          q.status === 'done' || q.status === 'progress' || q.status === 'todo'
            ? q.status
            : base?.status ?? 'todo',
        reward: typeof q.reward === 'number' ? q.reward : base?.reward ?? 10,
        icon: typeof q.meta?.icon === 'string' ? q.meta.icon : base?.icon ?? 'ph-fill ph-star',
        c1: grad?.[0] ?? metaColor ?? base?.c1 ?? '#FF7A7A',
        c2: grad?.[1] ?? metaColor ?? base?.c2 ?? '#FF5A6E',
        stageDone: typeof q.stage_done === 'number' ? q.stage_done : q.status === 'done' ? 5 : 0,
        stages: typeof q.stages === 'number' ? q.stages : 5,
      };
    })
    .filter((q: QuizCard | null): q is QuizCard => q !== null);
  return mapped.length ? mapped : prev;
}

function mapApiWeek(list: any, prev: WeekDay[]): WeekDay[] {
  if (!Array.isArray(list)) return prev;
  const mapped = list
    .map((w: any): WeekDay | null =>
      w && typeof w.label === 'string' ? { label: w.label, done: !!w.done, today: !!w.today } : null,
    )
    .filter((w: WeekDay | null): w is WeekDay => w !== null);
  return mapped.length ? mapped : prev;
}

/* API streak_days(실집계) 우선 — 없을 때만 week에서 파생.
   오늘(오늘 아직이면 어제)부터 역방향으로 연속 완료일을 센다. 월요일부터 정방향으로 세면
   월요일을 안 한 주엔 화·수·목 다 해도 0으로 끊긴다. */
function streakFromWeek(week: WeekDay[]): number {
  let ti = week.findIndex((w) => w.today);
  if (ti < 0) ti = week.length - 1; // today 표시 없으면 마지막 요일 기준
  let i = week[ti]?.done ? ti : ti - 1;
  let n = 0;
  while (i >= 0 && week[i]?.done) {
    n += 1;
    i -= 1;
  }
  return n;
}

/* 원본 badge() 그대로 */
function badge(st: QuizStatus) {
  if (st === 'done') return { cls: 'dq-badge-done', icon: 'ph-fill ph-check-circle', text: '완료' };
  if (st === 'progress')
    return { cls: 'dq-badge-progress', icon: 'ph-fill ph-hourglass-medium', text: '진행 중' };
  return { cls: 'dq-badge-todo', icon: 'ph-fill ph-star', text: '도전!' };
}

export default function DailyQuiz() {
  const { me } = useAuth();
  const name = (me?.name ?? '하은').trim() || '하은';

  const [data, setData] = useState<QuizData>(FALLBACK);
  // 생활 교육과정 (일일 주제 순환 — 지난날 복습·오늘 과제·다음날 잠금)
  const [curr, setCurr] = useState<{ today_day: number; days: any[] } | null>(null);

  useEffect(() => {
    studentApi
      .curriculum('생활', 6, 4)
      .then((d: any) => {
        if (d?.available && Array.isArray(d.days)) setCurr({ today_day: d.today_day, days: d.days });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let mounted = true;
    studentApi
      .dailyQuiz()
      .then((d: any) => {
        if (!mounted || !d) return;
        setData((prev) => {
          const quizzes = mapApiQuizzes(d.quizzes, prev.quizzes);
          const week = mapApiWeek(d.week, prev.week);
          return {
            coins: typeof d.coins === 'number' ? d.coins : prev.coins,
            streakDays:
              typeof d.streak_days === 'number'
                ? d.streak_days
                : Array.isArray(d.week)
                  ? streakFromWeek(week)
                  : prev.streakDays,
            quizzes,
            week,
          };
        });
      })
      .catch(() => {
        // TODO(api): 백엔드 미구현/실패 시 FALLBACK 유지
      });
    return () => {
      mounted = false;
    };
  }, []);

  const doneCount = data.quizzes.filter((q) => q.status === 'done').length;
  const total = data.quizzes.length;
  const pct = `${Math.round((doneCount / total) * 100)}%`;
  const remain = total - doneCount;
  const remainLabel = remain === 0 ? '모두 완료! 🎉' : `남은 과목 ${remain}개`;

  return (
    <div className="dq-root">
      {/* NAV — 원본 오늘의퀴즈 NAV 그대로(학습 홈 NAV와 다른 구조라 자체 구현) */}
      <div className="dq-nav">
        <div className="dq-navinner">
          <Link to={PATHS.STUDENT_HOME} className="dq-logo">
            <img src={mascot} alt="CatChap" className="dq-logoimg" />
            <div className="dq-logotext">
              <span className="dq-logotitle">CatChap</span>
              <span className="dq-logosub">놀면서 배우는 캡챠 학습</span>
            </div>
          </Link>
          <nav className="dq-menu">
            <Link to={PATHS.STUDENT_HOME} className="dq-navlink">
              홈
            </Link>
            <Link to={PATHS.STUDENT_ALL_LEARNING} className="dq-navlink">
              전체 학습
            </Link>
            <Link to={PATHS.STUDENT_CONCEPTS} className="dq-navlink">
              개념 설명
            </Link>
            <Link to={PATHS.STUDENT_AI_TEACHER} className="dq-navlink">
              AI 선생님
            </Link>
            <Link to={PATHS.STUDENT_RECORDS} className="dq-navlink">
              나의 기록
            </Link>
          </nav>
          <div className="dq-navright">
            <Link to={PATHS.STUDENT_SEARCH} title="검색" className="dq-searchbtn">
              <i className="ph-bold ph-magnifying-glass" />
            </Link>
            <div className="dq-coins">
              <i className="ph-fill ph-coins" />
              <span>{data.coins}</span>
            </div>
            <Link to={PATHS.STUDENT_PROFILE} title="마이페이지" className="dq-profile">
              <div className="dq-avatar">{name.charAt(0)}</div>
              <span className="dq-profilename">{name}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* HERO */}
      <section className="dq-sec-hero">
        <div className="dq-herocard">
          <div className="dq-hero-deco1" />
          <div className="dq-hero-deco2" />
          <div className="dq-heromascot">
            <img src={mascot} alt="마스코트" />
          </div>
          <div className="dq-herobody">
            <div className="dq-herochip">
              <i className="ph-fill ph-lightning" />
              오늘의 퀴즈
            </div>
            <h1 className="dq-herotitle">오늘은 여섯 과목, 하나씩 도전! 🎯</h1>
            <p className="dq-herodesc">
              국어·영어·수학·과학·사회·생활을 매일 한 판씩 풀어요. 다 풀면 <b>보너스 냥코인</b>이
              팡!
            </p>
          </div>
          <div className="dq-herocount">
            <div className="dq-herocount-num">
              {doneCount}
              <span>/{total}</span>
            </div>
            <div className="dq-herocount-label">과목 완료</div>
          </div>
        </div>
      </section>

      {/* PROGRESS BAR */}
      <section className="dq-sec-progress">
        <div className="dq-quota">
          <div className="dq-quota-head">
            <span className="dq-quota-title">오늘의 할당량</span>
            <span className="dq-quota-meta">
              {pct} 완료 · {remainLabel}
            </span>
          </div>
          <div className="dq-quota-track">
            <div className="dq-quota-fill" style={{ width: pct }} />
          </div>
          <div className="dq-quota-bonus">
            <i className="ph-fill ph-gift" />
            <span>
              여섯 과목을 모두 끝내면 <b>보너스 +50 냥코인</b>을 받아요!
            </span>
          </div>
        </div>
      </section>

      {/* QUIZ CARDS */}
      <section className="dq-sec-cards">
        <div className="dq-grid">
          {data.quizzes.map((q) => {
            const b = badge(q.status);
            const done = q.status === 'done';
            return (
              <Link
                key={q.subject}
                to={`${PATHS.STUDENT_GAME}?subject=${encodeURIComponent(q.subject)}${done ? '&replay=1' : ''}`}
                className={`dq-card${done ? ' dq-card-done' : ''}`}
                style={{
                  background: `linear-gradient(160deg,${q.c1},${q.c2})`,
                  boxShadow: `0 16px 30px -20px ${q.c2}cc`,
                }}
              >
                <div className="dq-card-deco" />
                <div className="dq-card-top">
                  <span className="dq-card-icon">
                    <i className={q.icon} />
                  </span>
                  <span className={`dq-badge ${b.cls}`}>
                    <i className={b.icon} />
                    {b.text}
                  </span>
                </div>
                <div className="dq-card-subject">{q.subject}</div>
                <div className="dq-card-topic">{q.topic}</div>
                {/* 5단계 진행 바 (홈처럼 단계별로 나눔) */}
                <div className="dq-card-segs">
                  {Array.from({ length: q.stages ?? 5 }, (_, i) => (
                    <div key={i} className={`dq-seg${i < (q.stageDone ?? 0) ? ' dq-seg-on' : ''}`} />
                  ))}
                </div>
                <div className="dq-card-bottom">
                  <span className="dq-card-reward">
                    <i className="ph-fill ph-coins" />+{q.reward}
                  </span>
                  <span className="dq-card-cta">
                    {done ? '다시 풀기' : q.status === 'progress' ? '이어서' : '시작하기'}{' '}
                    <i className={done ? 'ph-bold ph-arrow-clockwise' : 'ph-bold ph-arrow-right'} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* STREAK / REWARD ROW */}
      <section className="dq-sec-streak">
        <div className="dq-bottomgrid">
          <div className="dq-streakcard">
            <div className="dq-streakhead">
              <span className="dq-streakhead-icon">
                <i className="ph-fill ph-fire" />
              </span>
              <h3 className="dq-streakhead-title">이번 주 연속 도전</h3>
            </div>
            <div className="dq-week">
              {(() => {
                const todayIdx = data.week.findIndex((w) => w.today);
                return data.week.map((d, i) => {
                  // 일일 잠금 규칙: 미래 날짜는 미리 풀 수 없음(자물쇠), 지난 날은 다시 풀기(복습) 가능
                  const isFuture = todayIdx >= 0 && i > todayIdx;
                  const isPast = todayIdx >= 0 && i < todayIdx;
                  const dot = (
                    <div
                      className={`dq-daydot ${
                        d.done ? 'dq-daydot-done' : d.today ? 'dq-daydot-today' : 'dq-daydot-off'
                      }`}
                      title={isFuture ? '아직 열리지 않았어요 — 내일 만나요!' : isPast ? `${d.label}요일 문제 다시 풀기` : undefined}
                    >
                      {d.done ? <i className="ph-bold ph-check" /> : isFuture ? <i className="ph-fill ph-lock-simple" /> : null}
                    </div>
                  );
                  // 지난 요일 복습: 생활 커리큘럼 일차로 역산해 그 날 주제를 다시 푼다 (커리큘럼 없으면 무작위 연습)
                  const pastDay = curr && todayIdx >= 0 ? curr.today_day - (todayIdx - i) : null;
                  const replayHref =
                    pastDay && pastDay >= 1
                      ? `${PATHS.STUDENT_GAME}?subject=생활&day=${pastDay}&replay=1`
                      : `${PATHS.STUDENT_GAME}?subject=생활&replay=1`;
                  return (
                    <div key={d.label} className="dq-day">
                      {isPast ? (
                        <Link to={replayHref} className="dq-dayreplay" title={`${d.label}요일 문제 다시 풀기 (복습 — 코인 없음)`}>
                          {dot}
                        </Link>
                      ) : (
                        dot
                      )}
                      <span
                        className="dq-daylabel"
                        style={{ color: d.today ? '#FF5A4D' : d.done ? '#5A5248' : '#B0A79B' }}
                      >
                        {d.label}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
            <div className="dq-streaknote">
              <i className="ph-fill ph-sparkle" />
              <span>
                <b>{data.streakDays}일 연속</b> 도전 중이에요! 오늘도 완료하면 {data.streakDays + 1}
                일째예요.
              </span>
            </div>
          </div>
          <div className="dq-rewardcard">
            <div className="dq-rewardhead">
              <span className="dq-rewardhead-icon">
                <i className="ph-fill ph-trophy" />
              </span>
              <h3 className="dq-rewardhead-title">오늘의 보상</h3>
            </div>
            <div className="dq-rewardlist">
              <div className="dq-rewarditem">
                <i className="ph-fill ph-check-circle dq-ri-check" />
                과목마다 기본 +10~20 냥코인
              </div>
              <div className="dq-rewarditem">
                <i className="ph-fill ph-gift dq-ri-gift" />
                여섯 과목 모두 완료 +50 보너스
              </div>
              <div className="dq-rewarditem">
                <i className="ph-fill ph-medal dq-ri-medal" />
                7일 연속 도전 시 특별 배지
              </div>
            </div>
            <Link to={PATHS.STUDENT_PROFILE} className="dq-rewardcta">
              모은 코인으로 꾸미기
            </Link>
          </div>
        </div>
      </section>

      <ScreenTimeReminder />
    </div>
  );
}
