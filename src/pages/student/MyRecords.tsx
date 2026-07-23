import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, type NavigateFunction } from 'react-router-dom';
import StudentLayout from '../../layouts/StudentLayout';
import { useAuth } from '../../hooks/useAuth';
import { studentApi } from '../../api/students';
import { lectureApi, thumbnailSrc, type StudentCourse } from '../../api/lectures';
import { PATHS } from '../../routes/paths';
import ChapterAccuracyChart, { type SubjectStat } from '../../components/student/ChapterAccuracyChart';
import HabitTrendLine, { type HabitDay } from '../../components/student/HabitTrendLine';
import CourseCover from '../../components/course/CourseCover';
import CatMark from '../../components/brand/CatMark';
import './MyRecords.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface WeekBar {
  label: string;
  v: number;
  minutes: number;
}

interface CalendarData {
  learned: number[];
  today: number;
  month: number;
  blanks: number;
  days: number;
}

interface TopStats {
  streakDays: number;
  totalHours: number;
  totalMinutes: number;
  totalSolved: number;
  avgAccuracy: number;
}

interface MasteryItem {
  name: string;
  icon: string;
  color: string;
  bg: string;
  pct: number;
  solved: number;
  delta: number;
}

interface SubjectLine {
  key: string;
  color: string;
  data: number[];
}

interface ActivityItem {
  title: string;
  sub: string;
  icon: string;
  color: string;
  bg: string;
  result: string;
  grade: 'ok' | 'mid';
  time: string;
}

interface RecordsData {
  weeks: WeekBar[];
  calendar: CalendarData;
  mastery: MasteryItem[];
  subjects: SubjectLine[];
  activities: ActivityItem[];
  accLabels: string[];
  stats: TopStats;
}

// TODO(api): studentApi.records() 실패 시 원본 하드코딩 데이터 유지
const FALLBACK: RecordsData = {
  weeks: [
    { label: '3주 전', v: 62, minutes: 130 },
    { label: '2주 전', v: 82, minutes: 172 },
    { label: '지난주', v: 75, minutes: 158 },
    { label: '이번주', v: 100, minutes: 210 },
  ],
  // 원본: July 1st = Tuesday(index 2), 앞 빈칸 2개
  calendar: {
    learned: [1, 2, 3, 5, 6, 8, 9, 10, 12, 13, 15, 16, 17, 19, 20, 22, 23, 24, 26, 27, 29, 30],
    today: 2,
    month: 7,
    blanks: 2,
    days: 31,
  },
  stats: { streakDays: 12, totalHours: 8, totalMinutes: 20, totalSolved: 342, avgAccuracy: 89 },
  mastery: [
    { name: '국어', icon: 'ph-fill ph-text-aa', color: '#FF5A6E', bg: '#FFE3E9', pct: 88, solved: 50, delta: 2 },
    { name: '수학', icon: 'ph-fill ph-plus-minus', color: '#FF922E', bg: '#FFEDE0', pct: 76, solved: 45, delta: -4 },
    { name: '과학', icon: 'ph-fill ph-flask', color: '#2E7BFF', bg: '#E6F0FF', pct: 64, solved: 38, delta: 6 },
    { name: '영어', icon: 'ph-fill ph-translate', color: '#17B08C', bg: '#DFF6ED', pct: 95, solved: 40, delta: 3 },
    { name: '생활', icon: 'ph-fill ph-shield-check', color: '#8B6BFF', bg: '#EDE6FF', pct: 32, solved: 25, delta: 12 },
  ],
  subjects: [
    { key: '전체', color: '#17B08C', data: [72, 78, 75, 84, 88, 92] },
    { key: '국어', color: '#FF5A6E', data: [80, 84, 82, 88, 90, 93] },
    { key: '영어', color: '#FF922E', data: [60, 66, 70, 68, 74, 79] },
    { key: '수학', color: '#2E7BFF', data: [70, 74, 72, 80, 83, 86] },
    { key: '과학', color: '#8B6BFF', data: [55, 62, 60, 68, 72, 77] },
    { key: '사회', color: '#33C892', data: [64, 68, 72, 75, 79, 84] },
    { key: '생활', color: '#FF6DA6', data: [78, 80, 79, 85, 88, 91] },
  ],
  activities: [
    { title: '과학 학습', sub: '과학 · 8문제', icon: 'ph-fill ph-flask', color: '#2E7BFF', bg: '#E6F0FF', result: '정답률 86%', grade: 'ok', time: '방금 전' },
    { title: '영어 학습', sub: '영어 · 6문제', icon: 'ph-fill ph-translate', color: '#17B08C', bg: '#DFF6ED', result: '정답률 100%', grade: 'ok', time: '오늘 오후 3:10' },
    { title: '수학 학습', sub: '수학 · 10문제', icon: 'ph-fill ph-plus-minus', color: '#FF922E', bg: '#FFEDE0', result: '정답률 72%', grade: 'mid', time: '어제' },
    { title: '국어 학습', sub: '국어 · 10문제', icon: 'ph-fill ph-text-aa', color: '#FF5A6E', bg: '#FFE3E9', result: '정답률 90%', grade: 'ok', time: '2일 전' },
  ],
  accLabels: ['6회 전', '5회 전', '4회 전', '3회 전', '2회 전', '최근'],
};

const GRID_LINES = [50, 60, 70, 80, 90, 100];

/** 수료일 표기 — 'YYYY-MM-DD…' ISO → 'M월 D일'(파싱 실패 시 빈 문자열) */
function fmtPassedAt(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}월 ${d.getDate()}일 수료`;
}

// 칸마다 기본 노출 수 — 코스가 많아져도 스크롤에 묻히지 않게, 넘치면 '더 보기'로 펼친다.
const COMP_CAP = 4;

/** 수료 현황 카드 1장 — 상태(수료/진행/잠김)에 따라 배지·문구가 갈린다. 클릭 시 그 코스 시험으로. */
function CompCard({ c, navigate }: { c: StudentCourse; navigate: NavigateFunction }) {
  const ex = c.exam!;
  const go = () => navigate(`${PATHS.STUDENT_COURSE_EXAM}?course=${c.id}`);
  if (ex.passed) {
    const perfect = ex.perfect;
    return (
      <button className={`mr-comp${perfect ? ' mr-comp--perfect' : ''}`} onClick={go}>
        <CourseCover seed={c.id} label={c.title || c.subject} imageUrl={thumbnailSrc(c.thumbnail_url)} size="sm" className="mr-compcover" />
        <span className="mr-compbody">
          <span className="mr-comptitle">{c.title}</span>
          <span className="mr-compmeta">
            {c.subject} · 문항 {ex.question_count}개
            {fmtPassedAt(ex.passed_at) && ` · ${fmtPassedAt(ex.passed_at)}`}
          </span>
        </span>
        <span className={`mr-compbadge${perfect ? ' mr-compbadge--perfect' : ''}`}>
          {perfect ? '완벽 통과' : '수료'}
        </span>
      </button>
    );
  }
  if (ex.available) {
    return (
      <button className="mr-comp mr-comp--progress" onClick={go}>
        <CourseCover seed={c.id} label={c.title || c.subject} imageUrl={thumbnailSrc(c.thumbnail_url)} size="sm" className="mr-compcover" />
        <span className="mr-compbody">
          <span className="mr-comptitle">{c.title}</span>
          <span className="mr-compmeta">
            {c.subject} · 수료까지 {Math.max(0, ex.question_count - ex.mastered_count)}문항 ({ex.mastered_count}/{ex.question_count} 정복)
          </span>
        </span>
        <span className="mr-compbadge mr-compbadge--progress">응시 가능</span>
      </button>
    );
  }
  return (
    <button className="mr-comp mr-comp--locked" onClick={go}>
      <CourseCover seed={c.id} label={c.title || c.subject} imageUrl={thumbnailSrc(c.thumbnail_url)} size="sm" className="mr-compcover mr-compcover--locked" />
      <span className="mr-compbody">
        <span className="mr-comptitle">{c.title}</span>
        <span className="mr-compmeta">
          {c.subject} · 강의 {ex.lectures_done}/{ex.lectures_total} 완주 시 열려요
        </span>
      </span>
      <span className="mr-compbadge mr-compbadge--locked">잠김</span>
    </button>
  );
}

/** 수료 현황 한 칸(수료 완료/진행 중/잠김) — 기본 COMP_CAP개만 보이고 넘치면 접었다 편다. */
function CompGroup({
  title, icon, items, navigate,
}: {
  title: string; icon: string; items: StudentCourse[]; navigate: NavigateFunction;
}) {
  const [showAll, setShowAll] = useState(false);
  if (!items.length) return null;
  const shown = showAll ? items : items.slice(0, COMP_CAP);
  const hidden = items.length - shown.length;
  return (
    <div className="mr-compgroup">
      <div className="mr-compgrouphead">
        <i className={icon} /> {title}
        <span className="mr-compgroupn">{items.length}</span>
      </div>
      {shown.map((c) => <CompCard key={c.id} c={c} navigate={navigate} />)}
      {hidden > 0 && (
        <button className="mr-compmore" onClick={() => setShowAll(true)}>
          <i className="ph-bold ph-caret-down" /> {hidden}개 더 보기
        </button>
      )}
      {showAll && items.length > COMP_CAP && (
        <button className="mr-compmore" onClick={() => setShowAll(false)}>
          <i className="ph-bold ph-caret-up" /> 접기
        </button>
      )}
    </div>
  );
}

/** 정답률 흐름 탭 순서 — 디자인 순서(전체 → 과목들) 유지용 */
const SUBJECT_ORDER = ['전체', '국어', '영어', '수학', '과학', '사회', '생활'];

/**
 * GET /students/me/records 응답 → RecordsData 매핑.
 * 실제 응답 형태:
 *  - weeks[{label,minutes,pct}]            → weeks[{label, v:pct}] (막대 높이·분 표시는 v 기반)
 *  - calendar{days,year,month,today,blanks,learned[]} → calendar{learned, today}
 *  - mastery[{bg,pct,icon,name,color,delta,solved,correct}] → 동일 키 사용
 *  - accuracy_series{과목명:{color,data[]}}  → subjects[{key,color,data}] (디자인 탭 순서로 정렬)
 *  - accuracy_labels[]                      → accLabels
 *  - activities[{bg,sub,icon,time,color,title,result}] → grade는 result의 정답률로 파생(80% 이상 ok)
 */
function mapRecords(d: any, prev: RecordsData): Partial<RecordsData> {
  const out: Partial<RecordsData> = {};

  if (Array.isArray(d.weeks) && d.weeks.length) {
    out.weeks = d.weeks.map((w: any, i: number): WeekBar => {
      const v =
        typeof w?.pct === 'number' ? w.pct : typeof w?.v === 'number' ? w.v : (prev.weeks[i]?.v ?? 0);
      return {
        label: typeof w?.label === 'string' ? w.label : (prev.weeks[i]?.label ?? ''),
        v,
        // 분 표시: API minutes(solve_time_ms 실집계) 우선, 없으면 기존 디자인 계산식
        minutes: typeof w?.minutes === 'number' ? w.minutes : Math.round((v / 100) * 210),
      };
    });
  }

  if (d.calendar && Array.isArray(d.calendar.learned) && typeof d.calendar.today === 'number') {
    out.calendar = {
      learned: d.calendar.learned,
      today: d.calendar.today,
      month: typeof d.calendar.month === 'number' ? d.calendar.month : prev.calendar.month,
      blanks: typeof d.calendar.blanks === 'number' ? d.calendar.blanks : prev.calendar.blanks,
      days: typeof d.calendar.days === 'number' ? d.calendar.days : prev.calendar.days,
    };
  }

  // 상단 통계 4종: 전체 기간 실집계 (streak/총 시간/푼 문제/평균 정답률)
  const st = d.stats;
  if (st && typeof st === 'object') {
    out.stats = {
      streakDays: typeof st.streak_days === 'number' ? st.streak_days : prev.stats.streakDays,
      totalHours: typeof st.total_hours === 'number' ? st.total_hours : prev.stats.totalHours,
      totalMinutes:
        typeof st.total_minutes === 'number' ? st.total_minutes : prev.stats.totalMinutes,
      totalSolved: typeof st.total_solved === 'number' ? st.total_solved : prev.stats.totalSolved,
      avgAccuracy:
        typeof st.avg_accuracy === 'number' ? st.avg_accuracy : prev.stats.avgAccuracy,
    };
  }

  if (Array.isArray(d.mastery) && d.mastery.length) {
    const valid = d.mastery.filter(
      (m: any) => m && typeof m.name === 'string' && typeof m.pct === 'number' && typeof m.solved === 'number',
    );
    if (valid.length) {
      out.mastery = valid.map((m: any): MasteryItem => ({
        name: m.name,
        icon: m.icon ?? '',
        color: m.color ?? '#17B08C',
        bg: m.bg ?? '#F3EDE4',
        pct: m.pct,
        solved: m.solved,
        delta: typeof m.delta === 'number' ? m.delta : 0,
      }));
    }
  }

  // accuracy_series: { '국어': {color,data[]}, ... } — 객체 → 배열, 디자인 탭 순서 우선
  const series = d.accuracy_series;
  if (series && typeof series === 'object' && !Array.isArray(series)) {
    const keys = Object.keys(series).filter(
      (k) => series[k] && Array.isArray(series[k].data) && series[k].data.length >= 2,
    );
    if (keys.length) {
      const ordered = [
        ...SUBJECT_ORDER.filter((k) => keys.includes(k)),
        ...keys.filter((k) => !SUBJECT_ORDER.includes(k)),
      ];
      out.subjects = ordered.map((k): SubjectLine => ({
        key: k,
        color: series[k].color ?? '#17B08C',
        data: series[k].data,
      }));
    }
  }

  if (Array.isArray(d.accuracy_labels) && d.accuracy_labels.length) {
    out.accLabels = d.accuracy_labels;
  }

  if (Array.isArray(d.activities) && d.activities.length) {
    const valid = d.activities.filter((a: any) => a && typeof a.title === 'string');
    if (valid.length) {
      out.activities = valid.map((a: any): ActivityItem => {
        const pct = parseInt(String(a.result ?? '').replace(/[^0-9]/g, ''), 10);
        return {
          title: a.title,
          sub: a.sub ?? '',
          icon: a.icon ?? '',
          color: a.color ?? '#17B08C',
          bg: a.bg ?? '#F3EDE4',
          result: a.result ?? '',
          grade: Number.isFinite(pct) && pct < 80 ? 'mid' : 'ok',
          time: a.time ?? '',
        };
      });
    }
  }

  return out;
}

// 나의 기록 상단 탭 — 긴 스크롤을 요약/수료/통계로 분할(0723). ?tab= 쿼리로 링크·뒤로가기 친화.
type RecTab = 'summary' | 'completion' | 'stats';
const REC_TABS: { key: RecTab; label: string; icon: string }[] = [
  { key: 'summary', label: '요약', icon: 'ph-fill ph-gauge' },
  { key: 'completion', label: '수료 현황', icon: 'ph-fill ph-seal-check' },
  { key: 'stats', label: '학습 통계', icon: 'ph-fill ph-chart-bar' },
];

export default function MyRecords() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const recTabRaw = searchParams.get('tab') as RecTab | null;
  const recTab: RecTab = REC_TABS.some((t) => t.key === recTabRaw) ? (recTabRaw as RecTab) : 'summary';
  const setRecTab = (t: RecTab) =>
    setSearchParams(t === 'summary' ? {} : { tab: t }, { replace: false });
  const [data, setData] = useState<RecordsData>(FALLBACK);
  const [demo, setDemo] = useState(false); // 시도 기록이 없어 전부 데모값이면 true
  const [subject, setSubject] = useState('전체');
  const [chapStats, setChapStats] = useState<SubjectStat[]>([]);
  const [habit, setHabit] = useState<{ days: HabitDay[]; streak: number } | null>(null);
  // 수료 시험이 있는 코스 — null=조회 전. 수료 완료/진행 중/잠김으로 나눠 보여준다(재중심화 핵심).
  const [examCourses, setExamCourses] = useState<StudentCourse[] | null>(null);

  useEffect(() => {
    let mounted = true;
    studentApi
      .records()
      .then((d: any) => {
        if (!mounted || !d) return;
        setDemo(!!d.demo);
        setData((prev) => ({ ...prev, ...mapRecords(d, prev) }));
      })
      .catch(() => {
        // TODO(api): 백엔드 미구현/실패 시 FALLBACK 유지
      });
    // 두 축 실집계 — 실패 시 빈 값(섹션 미노출, 가짜 진행 없음)
    studentApi.chapterStats()
      .then((d: any) => { if (mounted && Array.isArray(d?.subjects)) setChapStats(d.subjects); })
      .catch(() => {});
    studentApi.habitStats(4)
      .then((d: any) => { if (mounted && Array.isArray(d?.days)) setHabit({ days: d.days, streak: d.streak ?? 0 }); })
      .catch(() => {});
    lectureApi.courses()
      .then((rows) => { if (mounted) setExamCourses(rows.filter((c) => c.exam?.has_exam)); })
      .catch(() => { if (mounted) setExamCourses([]); });
    return () => {
      mounted = false;
    };
  }, []);

  const name = (me?.name ?? '하은').trim() || '하은';
  // 수료 시험 코스를 상태별로 나눈다 — 진행 중(응시 가능) / 잠김(강의 미완주) / 수료 완료.
  // 실무 표준 '행동 우선' 정렬(사용자 결정 0719): 지금 할 것을 위, 끝낸 것을 아래. 각 칸은
  // 최신순 — 진행 중=마지막 시험 활동 최신(안 본 코스는 뒤), 잠김=완주에 가까운 순(다음 할 것),
  // 수료 완료=수료일 최신. desc 비교는 문자열 ISO 그대로(사전식=시간순), null은 뒤로.
  const descNulls = (a: string | null, b: string | null) => (b ?? '').localeCompare(a ?? '');
  const inProgressCourses = (examCourses ?? [])
    .filter((c) => !c.exam?.passed && c.exam?.available)
    .sort((a, b) => descNulls(a.exam?.last_activity_at ?? null, b.exam?.last_activity_at ?? null));
  const lockedCourses = (examCourses ?? [])
    .filter((c) => !c.exam?.passed && !c.exam?.available)
    .sort((a, b) => {
      const ra = (a.exam?.lectures_done ?? 0) / Math.max(1, a.exam?.lectures_total ?? 1);
      const rb = (b.exam?.lectures_done ?? 0) / Math.max(1, b.exam?.lectures_total ?? 1);
      return rb - ra; // 완주에 가까운(열리기 직전) 코스가 위
    });
  const passedCourses = (examCourses ?? [])
    .filter((c) => c.exam?.passed)
    .sort((a, b) => descNulls(a.exam?.passed_at ?? null, b.exam?.passed_at ?? null));
  const perfectCount = passedCourses.filter((c) => c.exam?.perfect).length;

  const learned = new Set(data.calendar.learned);
  const today = data.calendar.today;

  /* === 정답률 흐름 라인 차트 — 원본 DCLogic 좌표 계산식 그대로 === */
  const S = data.subjects.find((x) => x.key === subject) || data.subjects[0];
  const ACC_LABELS = data.accLabels;
  const acc = S.data;
  const clr = S.color;
  const CW = 520;
  const CH = 220;
  const padL = 40;
  const padR = 18;
  const padT = 22;
  const padB = 30;
  const yMin = 50;
  const yMax = 100;
  const plotW = CW - padL - padR;
  const plotH = CH - padT - padB;
  const X = (i: number) => padL + plotW * (i / (acc.length - 1));
  // 값을 y축 범위로 클램프 — 범위 밖 값이 플롯 밖으로 그려지지 않게
  const Y = (v: number) => padT + plotH * (1 - (Math.min(yMax, Math.max(yMin, v)) - yMin) / (yMax - yMin));
  const baseY = Y(yMin);
  const lastI = acc.length - 1;
  const accAvg = Math.round(acc.reduce((a, b) => a + b, 0) / acc.length);
  const accAvgY = Y(accAvg);
  const accPoly = acc.map((v, i) => X(i) + ',' + Y(v)).join(' ');
  let accArea = 'M ' + X(0) + ' ' + baseY;
  acc.forEach((v, i) => {
    accArea += ' L ' + X(i) + ' ' + Y(v);
  });
  accArea += ' L ' + X(lastI) + ' ' + baseY + ' Z';

  const firstV = acc[0];
  const lastV = acc[lastI];
  const prevV = acc[lastI - 1];
  const diffPrev = lastV - prevV;
  const up = lastV >= firstV;
  const accTrendWord = up ? '상승세' : '하락세';
  const accChipIcon = up ? 'ph-fill ph-trend-up' : 'ph-fill ph-trend-down';
  const accSubLabel = subject === '전체' ? '전체 과목 · 최근 6회 정답률' : subject + ' · 최근 6회 정답률';
  const diffText = (diffPrev >= 0 ? '+' + diffPrev : String(diffPrev)) + '%p';
  const accDesc =
    (subject === '전체' ? '전체 과목' : subject) +
    '의 최근 6회 평균 정답률은 ' +
    accAvg +
    '%예요. 이번 학습은 ' +
    lastV +
    '%로, 지난 회차보다 ' +
    diffText +
    ' ' +
    (diffPrev >= 0 ? '올랐어요' : '내렸어요') +
    '. ' +
    (up ? '꾸준히 오르고 있어요! 🎉' : '조금씩 다시 올려볼까요? 💪');

  return (
    <StudentLayout className="mr-root">
      {/* 데모 배너 제거(0723) — 실집계 없으면 가짜 데모 대신 아래 빈 상태를 보여준다 */}
      {/* HEADER */}
      <section className="mr-section mr-header">
        <div className="mr-headrow">
          <div className="mr-headleft">
            <span className="mr-headicon">
              <i className="ph-fill ph-chart-line-up" />
            </span>
            <div>
              <h1 className="mr-title">{name}님의 학습 기록</h1>
              <p className="mr-subtitle">배운 강의·풀어 온 문제·수료한 코스를 한눈에 볼 수 있어요</p>
            </div>
          </div>
          <button className="mr-reportbtn">
            <i className="ph-fill ph-download-simple" />
            리포트 저장
          </button>
        </div>
      </section>

      {/* 실집계가 없어 서버가 데모값을 내려주면(demo) 가짜 통계 대신 빈 상태를 보여준다.
          아동 게임 잔재(그림찾기·숫자놀이터 등)를 실학습자에게 노출하지 않는다(0723). */}
      {demo ? (
        <section className="mr-section">
          <div className="mr-card mr-emptyhero">
            <CatMark size={64} variant="line" whiskers className="mr-emptyhero-cat" />
            <h3 className="mr-h3">아직 학습 기록이 없어요</h3>
            <p className="mr-emptyhero-sub">
              강의를 듣고 확인 문제를 풀면 학습 통계·수료 현황이 여기에 쌓여요.
            </p>
            <button className="mr-comp-cta" onClick={() => navigate(PATHS.STUDENT_LECTURES)}>
              <i className="ph-fill ph-television" /> 강의 시작하기
            </button>
          </div>
        </section>
      ) : (
      <>
      {/* 상단 탭 — 긴 스크롤을 요약/수료/통계로 분할 */}
      <div className="mr-rectabs">
        {REC_TABS.map((t) => (
          <button
            key={t.key}
            className={`mr-rectab${recTab === t.key ? ' mr-rectab-on' : ''}`}
            onClick={() => setRecTab(t.key)}
          >
            <i className={t.icon} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ===== 요약 탭 ===== */}
      {recTab === 'summary' && (
      <section className="mr-section mr-stats">
        <div className="mr-statgrid">
          <div className="mr-stat">
            <span className="mr-staticon mr-staticon-fire">
              <i className="ph-fill ph-fire" />
            </span>
            <div className="mr-statval">
              {data.stats.streakDays}
              <span className="mr-statunit">일</span>
            </div>
            <div className="mr-statlabel">
              연속 학습 <span className="mr-stathl">최고 기록!</span>
            </div>
          </div>
          <div className="mr-stat">
            <span className="mr-staticon mr-staticon-seal">
              <i className="ph-fill ph-seal-check" />
            </span>
            <div className="mr-statval">
              {passedCourses.length}
              <span className="mr-statunit">개</span>
            </div>
            <div className="mr-statlabel">
              수료한 코스{perfectCount > 0 && <span className="mr-stathl"> · 완벽 {perfectCount}</span>}
            </div>
          </div>
          <div className="mr-stat">
            <span className="mr-staticon mr-staticon-puzzle">
              <i className="ph-fill ph-puzzle-piece" />
            </span>
            <div className="mr-statval">
              {data.stats.totalSolved}
              <span className="mr-statunit">개</span>
            </div>
            <div className="mr-statlabel">지금까지 푼 문제</div>
          </div>
          <div className="mr-stat">
            <span className="mr-staticon mr-staticon-target">
              <i className="ph-fill ph-target" />
            </span>
            <div className="mr-statval">
              {data.stats.avgAccuracy}
              <span className="mr-statunit">%</span>
            </div>
            <div className="mr-statlabel">평균 정답률</div>
          </div>
        </div>
      </section>

      )}

      {/* ===== 수료 현황 탭 ===== */}
      {/* 코스 수료 현황 + 학습 달력 ROW — 재중심화: 워치볼륨 막대 대신 '해낸 것 + 남은 것'을
          수료 완료/진행 중/잠김 칸으로 나눠 한눈에(사용자 결정 0719). 칸마다 기본 4개 +
          '더 보기'라 코스가 많아도 스크롤에 묻히지 않는다. --start = 펼쳐도 달력과 안 어긋남 */}
      {recTab === 'completion' && (
      <section className="mr-section mr-row2 mr-row2--start">
        <div className="mr-card">
          <div className="mr-weekhead">
            <h3 className="mr-h3">코스 수료 현황</h3>
            {examCourses && examCourses.length > 0 && (
              <span className="mr-weekchip">{passedCourses.length}/{examCourses.length} 수료 🎓</span>
            )}
          </div>
          {examCourses === null ? (
            <div className="mr-comp-empty">불러오는 중…</div>
          ) : examCourses.length === 0 ? (
            <div className="mr-comp-empty">
              <CatMark size={52} variant="line" whiskers className="mr-empty-cat" />
              <p>아직 수료 시험이 있는 코스가 없어요.<br />강의를 완주하고 수료 시험에 도전해 보세요!</p>
              <button className="mr-comp-cta" onClick={() => navigate(PATHS.STUDENT_LECTURES)}>
                <i className="ph-fill ph-television" /> 강의 보러 가기
              </button>
            </div>
          ) : (
            <div className="mr-compgroups">
              {/* 행동 우선(0719): 지금 할 것(진행 중→잠김)을 위, 끝낸 것(수료 완료)을 아래 */}
              <CompGroup title="진행 중" icon="ph-fill ph-hourglass-medium" items={inProgressCourses} navigate={navigate} />
              <CompGroup title="잠김" icon="ph-fill ph-lock-simple" items={lockedCourses} navigate={navigate} />
              <CompGroup title="수료 완료" icon="ph-fill ph-seal-check" items={passedCourses} navigate={navigate} />
            </div>
          )}
        </div>
        {/* streak calendar */}
        <div className="mr-card">
          <div className="mr-calhead">
            <h3 className="mr-h3">{data.calendar.month}월 학습 달력</h3>
            <span className="mr-calcount">{learned.size}일 학습 🐾</span>
          </div>
          <div className="mr-dowgrid">
            {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
              <span key={d} className="mr-dow">
                {d}
              </span>
            ))}
          </div>
          <div className="mr-calgrid">
            {Array.from({ length: data.calendar.blanks }, (_, b) => (
              <div key={'b' + b} className="mr-dayblank" />
            ))}
            {Array.from({ length: data.calendar.days }, (_, idx) => idx + 1).map((n) => (
              <div
                key={n}
                className={`mr-day ${n === today ? 'mr-day-today' : learned.has(n) ? 'mr-day-on' : 'mr-day-off'}`}
              >
                {n}
              </div>
            ))}
          </div>
          <div className="mr-legend">
            <span className="mr-legenditem">
              <span className="mr-sw mr-sw-on" />
              학습함
            </span>
            <span className="mr-legenditem">
              <span className="mr-sw mr-sw-off" />안 함
            </span>
            <span className="mr-legenditem">
              <span className="mr-sw mr-sw-today" />
              오늘
            </span>
          </div>
        </div>
      </section>

      )}

      {/* ===== 학습 통계 탭 ===== */}
      {recTab === 'stats' && (
        <>
      {/* CATEGORY MASTERY + ACCURACY */}
      <section className="mr-section mr-row2">
        <div className="mr-card">
          <div className="mr-mhead">
            <h3 className="mr-h3">과목별 실력</h3>
            <span className="mr-goal">
              <span className="mr-goaltick" />
              목표 80%
            </span>
          </div>
          <div className="mr-mlist">
            {data.mastery.map((m) => {
              const correct = Math.round((m.pct / 100) * m.solved);
              const mUp = m.delta >= 0;
              return (
                <div key={m.name}>
                  <div className="mr-mrow">
                    <span className="mr-micon" style={{ background: m.bg, color: m.color }}>
                      <i className={m.icon} />
                    </span>
                    <span className="mr-mname">{m.name}</span>
                    <span className={`mr-trend ${mUp ? 'mr-trend-up' : 'mr-trend-down'}`}>
                      <i className={mUp ? 'ph-fill ph-trend-up' : 'ph-fill ph-trend-down'} />
                      {Math.abs(m.delta)}%p
                    </span>
                    <span className="mr-mpct" style={{ color: m.color }}>
                      {m.pct}%
                    </span>
                  </div>
                  <div className="mr-mbar">
                    <div className="mr-mfill" style={{ width: m.pct + '%', background: m.color }} />
                    <div className="mr-mmark" />
                  </div>
                  <div className="mr-msolved">
                    최근 {m.solved}문제 중 {correct}개 정답
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="mr-card mr-acccard">
          <div className="mr-acchead">
            <div>
              <h3 className="mr-h3">정답률 흐름</h3>
              <p className="mr-accsub">{accSubLabel}</p>
            </div>
            <span className={`mr-accchip ${up ? 'mr-accchip-up' : 'mr-accchip-down'}`}>
              <i className={accChipIcon} />
              평균 {accAvg}% · {accTrendWord}
            </span>
          </div>
          <div className="mr-tabs">
            {data.subjects.map((x) => {
              const active = x.key === subject;
              return (
                <button
                  key={x.key}
                  onClick={() => setSubject(x.key)}
                  className={active ? 'mr-tab mr-tab-on' : 'mr-tab'}
                  style={active ? { background: x.color } : undefined}
                >
                  {x.key}
                </button>
              );
            })}
          </div>
          <div className="mr-chartwrap">
            <svg viewBox={`0 0 ${CW} ${CH}`} className="mr-accsvg">
              <defs>
                <linearGradient id="mrAccGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={clr} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={clr} stopOpacity={0} />
                </linearGradient>
              </defs>
              {GRID_LINES.map((g) => (
                <g key={g}>
                  <line x1={padL} y1={Y(g)} x2={CW - padR} y2={Y(g)} stroke="var(--line)" strokeWidth={1} />
                  <text x={padL - 7} y={Y(g) + 3} textAnchor="end" fontSize={10} fontWeight={700} fill="var(--ink-3)">
                    {g}
                  </text>
                </g>
              ))}
              <line
                x1={padL}
                y1={accAvgY}
                x2={CW - padR}
                y2={accAvgY}
                stroke="var(--warn)"
                strokeWidth={1.5}
                strokeDasharray="5 4"
              />
              {/* 평균 수치는 상단 칩(평균 XX% · 추세)에 표시 — 차트 안 텍스트는 점 라벨과 겹쳐 제거 */}
              <path d={accArea} fill="url(#mrAccGrad)" />
              <polyline
                points={accPoly}
                fill="none"
                stroke={clr}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {acc.map((v, i) => {
                const last = i === lastI;
                return (
                  <g key={i}>
                    <text
                      x={X(i)}
                      y={Math.max(Y(v) - 11, 11)}
                      textAnchor="middle"
                      fontSize={11}
                      fontWeight={800}
                      fill={last ? 'var(--brand)' : clr}
                    >
                      {v}%
                    </text>
                    <circle cx={X(i)} cy={Y(v)} r={last ? 6 : 4.5} fill={last ? 'var(--brand)' : clr} stroke="var(--surface)" strokeWidth={2} />
                    <text
                      x={X(i)}
                      y={CH - 8}
                      textAnchor="middle"
                      fontSize={10.5}
                      fontWeight={700}
                      fill={last ? 'var(--brand)' : 'var(--ink-3)'}
                    >
                      {ACC_LABELS[i]}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="mr-sessions">
            {acc.map((v, i) => (
              <div key={i} className="mr-sess">
                <div className="mr-sesslabel">{ACC_LABELS[i]}</div>
                <div className="mr-sessval" style={{ color: i === lastI ? 'var(--brand)' : clr }}>
                  {v}%
                </div>
              </div>
            ))}
          </div>
          <div className="mr-accdesc">
            <i className="ph-fill ph-chart-line-up mr-accdescicon" />
            <p className="mr-accdesctext">{accDesc}</p>
          </div>
        </div>
      </section>

      {/* 두 축 — 습관 추세 + 숙련(챕터별 정답률) */}
      {(habit?.days.some((d) => d.accuracy != null) ||
        chapStats.some((s) => s.chapters?.some((c) => c.total > 0))) && (
        <section className="mr-section mr-twoaxis">
          {habit?.days.some((d) => d.accuracy != null) && (
            <div className="mr-card">
              <h3 className="mr-h3">오늘의 Q · 학습 추세</h3>
              <HabitTrendLine days={habit.days} streak={habit.streak} />
            </div>
          )}
          {chapStats.some((s) => s.chapters?.some((c) => c.total > 0)) && (
            <div className="mr-card">
              <h3 className="mr-h3">문제은행 · 챕터별 정답률</h3>
              <ChapterAccuracyChart subjects={chapStats} />
            </div>
          )}
        </section>
      )}
        </>
      )}

      {/* ===== 요약 탭: 최근 학습 기록 ===== */}
      {recTab === 'summary' && (
      <section className="mr-section mr-recent">
        <div className="mr-card">
          <div className="mr-rhead">
            <h3 className="mr-h3">최근 학습 기록</h3>
            {/* 배지 페이지 은퇴(0718) — 링크 제거 */}
          </div>
          <div className="mr-alist">
            {data.activities.map((a) => (
              <div key={a.title} className="mr-act">
                <span className="mr-acticon" style={{ background: a.bg, color: a.color }}>
                  <i className={a.icon} />
                </span>
                <div className="mr-actbody">
                  <div className="mr-acttitle">{a.title}</div>
                  <div className="mr-actsub">{a.sub}</div>
                </div>
                <span className={`mr-actbadge ${a.grade === 'ok' ? 'mr-actok' : 'mr-actmid'}`}>{a.result}</span>
                <span className="mr-acttime">{a.time}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}
      </>
      )}
    </StudentLayout>
  );
}
