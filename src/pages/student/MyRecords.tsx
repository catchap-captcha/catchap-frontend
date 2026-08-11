import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, type NavigateFunction } from 'react-router-dom';
import StudentLayout from '../../layouts/StudentLayout';
import { useAuth } from '../../hooks/useAuth';
import { studentApi } from '../../api/students';
import { lectureApi, thumbnailSrc, type StudentCourse, type LectureItem } from '../../api/lectures';
import { PATHS } from '../../routes/paths';
import CourseCover from '../../components/course/CourseCover';
import CertificateModal from '../../components/course/CertificateModal';
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


/** 수료일 표기 — 'YYYY-MM-DD…' ISO → 'M월 D일'(파싱 실패 시 빈 문자열) */
function fmtPassedAt(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}월 ${d.getDate()}일 수료`;
}

// 칸마다 기본 노출 수 — 코스가 많아져도 스크롤에 묻히지 않게, 넘치면 '더 보기'로 펼친다.
const COMP_CAP = 4;

/** 수료 현황 카드 1장 — 상태(수료/진행/잠김)에 따라 배지·문구가 갈린다. 클릭 시 그 코스 시험으로. */
function CompCard({
  c, navigate, onCertificate,
}: {
  c: StudentCourse; navigate: NavigateFunction; onCertificate: (c: StudentCourse) => void;
}) {
  const ex = c.exam!;
  const go = () => navigate(`${PATHS.STUDENT_COURSE_EXAM}?course=${c.id}`);
  if (ex.passed) {
    const perfect = ex.perfect;
    // 수료한 코스만 '수료증' 버튼을 함께 둔다(미수료 카드에는 노출하지 않음).
    // 버튼 중첩은 불가하므로 카드를 div로 두고, 본문 영역만 별도 버튼으로 감싼다.
    return (
      <div className={`mr-comp mr-comp--done${perfect ? ' mr-comp--perfect' : ''}`}>
        <button className="mr-compmain" onClick={go}>
          <CourseCover seed={c.id} label={c.title || c.subject} imageUrl={thumbnailSrc(c.thumbnail_url)} size="sm" className="mr-compcover" />
          <span className="mr-compbody">
            <span className="mr-comptitle">{c.title}</span>
            <span className="mr-compmeta">
              {c.subject} · 문항 {ex.question_count}개
              {fmtPassedAt(ex.passed_at) && ` · ${fmtPassedAt(ex.passed_at)}`}
            </span>
          </span>
        </button>
        <span className={`mr-compbadge${perfect ? ' mr-compbadge--perfect' : ''}`}>
          {perfect ? '만점 수료' : '수료'}
        </span>
        <button className="mr-certbtn" onClick={() => onCertificate(c)}>
          <i className="ph-fill ph-certificate" /> 수료증
        </button>
      </div>
    );
  }
  if (ex.available) {
    return (
      <button className="mr-comp mr-comp--progress" onClick={go}>
        <CourseCover seed={c.id} label={c.title || c.subject} imageUrl={thumbnailSrc(c.thumbnail_url)} size="sm" className="mr-compcover" />
        <span className="mr-compbody">
          <span className="mr-comptitle">{c.title}</span>
          <span className="mr-compmeta">
            {c.subject} · 수료까지 {Math.max(0, Math.ceil(ex.question_count * 0.8) - ex.mastered_count)}문항 ({ex.mastered_count}/{ex.question_count} 정답)
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
  title, icon, items, navigate, onCertificate,
}: {
  title: string; icon: string; items: StudentCourse[]; navigate: NavigateFunction;
  onCertificate: (c: StudentCourse) => void;
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
      {shown.map((c) => <CompCard key={c.id} c={c} navigate={navigate} onCertificate={onCertificate} />)}
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
  { key: 'stats', label: '학습 통계', icon: 'ph-fill ph-chart-bar' },
  // 수료 현황은 문제 풀이 통계(요약·학습 통계)와 성격이 달라 맨 오른쪽으로(사용자 요청)
  { key: 'completion', label: '수료 현황', icon: 'ph-fill ph-seal-check' },
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
  // 강의 기반 학습 통계용(학습 통계 탭) — 전체 수강 코스 + 강의별 진행(시청/완주).
  const [allCourses, setAllCourses] = useState<StudentCourse[] | null>(null);
  const [lectures, setLectures] = useState<LectureItem[] | null>(null);
  // 수료 시험이 있는 코스 — null=조회 전. 수료 완료/진행 중/잠김으로 나눠 보여준다(재중심화 핵심).
  const [examCourses, setExamCourses] = useState<StudentCourse[] | null>(null);
  // 수료증 팝업 대상 코스 — null이면 닫힘. 수료한 카드의 '수료증' 버튼이 연다.
  const [certCourse, setCertCourse] = useState<StudentCourse | null>(null);

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
    // 강의 기반 통계·수료 현황 — 코스(수료 요약)와 강의별 진행을 함께 로드. 실패 시 빈 값.
    lectureApi.courses()
      .then((rows) => {
        if (!mounted) return;
        setExamCourses(rows.filter((c) => c.exam?.has_exam));
        setAllCourses(rows);
      })
      .catch(() => {
        if (mounted) { setExamCourses([]); setAllCourses([]); }
      });
    lectureApi.list()
      .then((ls) => { if (mounted) setLectures(Array.isArray(ls) ? ls : []); })
      .catch(() => { if (mounted) setLectures([]); });
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

  // === 강의 기반 학습 통계(학습 통계 탭) — 수강 코스의 강의별 시청/완주로 집계 ===
  const myCourses = (allCourses ?? []).filter((c) => c.enrolled);
  const enrolledIds = new Set(myCourses.map((c) => c.id));
  const myLectures = (lectures ?? []).filter(
    (l) => l.course_id != null && enrolledIds.has(l.course_id),
  );
  const lecDone = myLectures.filter((l) => l.progress?.status === 'done').length;
  const lecWatching = myLectures.filter((l) => l.progress?.status === 'watching').length;
  const lecTotal = myLectures.length;
  const lecNotStarted = Math.max(0, lecTotal - lecDone - lecWatching);
  const lecCompletionPct = lecTotal > 0 ? Math.round((lecDone / lecTotal) * 100) : 0;
  const lecReady = lecTotal > 0;
  // 코스별 진도 — 완주 강의/전체 강의(진도율 내림차순)
  const courseProgress = myCourses
    .map((c) => {
      const ls = myLectures.filter((l) => l.course_id === c.id);
      const done = ls.filter((l) => l.progress?.status === 'done').length;
      return {
        course: c,
        total: ls.length,
        done,
        pct: ls.length ? Math.round((done / ls.length) * 100) : 0,
      };
    })
    .filter((cp) => cp.total > 0)
    .sort((a, b) => b.pct - a.pct);
  // 최근 시청 강의 — 시청 중 강의를 진행률 높은 순 최대 6개
  const recentWatching = myLectures
    .filter((l) => l.progress?.status === 'watching')
    .map((l) => ({
      l,
      pct:
        l.duration_sec > 0 && l.progress
          ? Math.min(100, Math.max(0, Math.round((l.progress.watched_max_sec / l.duration_sec) * 100)))
          : 0,
    }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 6);

  // 리포트 저장 — 현재 학습 기록을 텍스트 파일로 내려받는다. 실집계된 값만 담고(데모 숫자 제외),
  // 없는 항목은 '없습니다'로 정직하게 적는다. 외부 라이브러리 없이 Blob 다운로드(윈도우용 \r\n).
  const saveReport = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    const L: string[] = [
      'CatChap 학습 리포트',
      '====================================',
      `이름: ${name}님`,
      `생성일: ${dateStr}`,
      '',
      '[요약 · 문제 풀이]',
    ];
    if (demo) {
      L.push('아직 문제 풀이 기록이 없습니다.');
    } else {
      L.push(`· 연속 학습: ${data.stats.streakDays}일`);
      L.push(`· 지금까지 푼 문제: ${data.stats.totalSolved}개`);
      L.push(`· 평균 정답률: ${data.stats.avgAccuracy}%`);
    }

    L.push('', '[학습 통계 · 강의 시청]');
    if (!lecReady) {
      L.push('아직 강의 시청 기록이 없습니다.');
    } else {
      L.push(`· 완주한 강의: ${lecDone}강 / 전체 ${lecTotal}강 (완주율 ${lecCompletionPct}%)`);
      L.push(`· 시청 중: ${lecWatching}강`);
      L.push(`· 수강 코스: ${myCourses.length}개`);
      if (courseProgress.length) {
        L.push('· 코스별 진도');
        courseProgress.forEach((cp) => {
          L.push(`    - ${cp.course.title}: ${cp.done}/${cp.total}강 (${cp.pct}%)`);
        });
      }
    }

    L.push('', '[수료 현황]');
    if (passedCourses.length === 0) {
      L.push('아직 수료한 코스가 없습니다.');
    } else {
      L.push(`· 수료한 코스: ${passedCourses.length}개${perfectCount > 0 ? ` (만점 ${perfectCount}개)` : ''}`);
      passedCourses.forEach((c) => {
        const at = fmtPassedAt(c.exam?.passed_at);
        L.push(`    - ${c.title}${c.exam?.perfect ? ' [만점]' : ''}${at ? ` · ${at}` : ''}`);
      });
    }

    L.push('', '— CatChap · 시청을 검증하는 강의 학습');

    const blob = new Blob([L.join('\r\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    a.href = url;
    a.download = `CatChap_학습리포트_${name}_${stamp}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 수료한 코스가 하나라도 있으면 '수료 현황'은 실데이터 — 데모(빈 상태)여도 탭을 살린다.
  const hasCompletion = passedCourses.length > 0;
  const emptyHero = (
    <section className="mr-section">
      <div className="mr-card mr-emptyhero">
        <i className="ph ph-chart-line-up mr-emptyhero-icon" />
        <h3 className="mr-h3">아직 학습 기록이 없어요</h3>
        <p className="mr-emptyhero-sub">
          강의를 듣고 확인 문제를 풀면 학습 통계·수료 현황이 여기에 쌓여요.
        </p>
        <button className="mr-comp-cta" onClick={() => navigate(PATHS.STUDENT_LECTURES)}>
          <i className="ph-fill ph-television" /> 강의 시작하기
        </button>
      </div>
    </section>
  );

  return (
    <StudentLayout className="mr-root">
      {/* 데모 배너 제거(0723) — 실집계 없으면 가짜 데모 대신 아래 빈 상태를 보여준다 */}
      {/* HEADER */}
      <section className="mr-section mr-header">
        <div className="mr-headrow">
          <div className="mr-headleft">
            <div>
              <h1 className="mr-title">{name}님의 학습 기록</h1>
              <p className="mr-subtitle">배운 강의·풀어 온 문제·수료한 코스를 한눈에 볼 수 있어요</p>
            </div>
          </div>
          <button type="button" className="mr-reportbtn" onClick={saveReport}>
            <i className="ph-fill ph-download-simple" />
            리포트 저장
          </button>
        </div>
      </section>

      {/* 안내 — 어떤 활동이 어떤 기록으로 쌓이는지(사용자 요청). 탭별 데이터 출처를 한 줄씩 명시. */}
      <section className="mr-section">
        <div className="mr-guide">
          <i className="ph-fill ph-info mr-guide-ic" />
          <div className="mr-guide-body">
            <b className="mr-guide-title">어떤 걸 하면 어떤 기록이 쌓이나요?</b>
            <ul className="mr-guide-list">
              <li>
                <b>요약</b> — 문제은행·오늘의 Q에서 <b>문제를 풀면</b> 푼 문제 수·정답률이 쌓여요.
              </li>
              <li>
                <b>학습 통계</b> — <b>강의를 시청하면</b> 완주 강의·코스 진도가 쌓여요.
              </li>
              <li>
                <b>수료 현황</b> — <b>수료 시험을 통과하면</b> 수료·수료증이 떠요(강의 완주 후 응시).
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 실집계가 없어 서버가 데모값을 내려주면(demo) 가짜 통계 대신 빈 상태를 보여준다.
          아동 게임 잔재(그림찾기·숫자놀이터 등)를 실학습자에게 노출하지 않는다(0723).
          단, 수료한 코스가 있으면 '수료 현황'은 실데이터이므로 탭은 살린다 — 그러지 않으면
          문제은행 기록 없이 수료 시험만 통과한 학습자가 수료증에 접근할 길이 없다. */}
      {demo && !hasCompletion ? (
        emptyHero
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

      {/* 실집계가 없는 탭(요약·통계)은 가짜 숫자 대신 빈 상태 그대로 */}
      {demo && recTab !== 'completion' && emptyHero}

      {/* ===== 요약 탭 ===== */}
      {recTab === 'summary' && !demo && (
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
              수료한 코스{perfectCount > 0 && <span className="mr-stathl"> · 만점 {perfectCount}</span>}
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
              <i className="ph ph-seal-check mr-empty-icon" />
              <p>아직 수료 시험이 있는 코스가 없어요.<br />강의를 완주하고 수료 시험에 도전해 보세요!</p>
              <button className="mr-comp-cta" onClick={() => navigate(PATHS.STUDENT_LECTURES)}>
                <i className="ph-fill ph-television" /> 강의 보러 가기
              </button>
            </div>
          ) : (
            <div className="mr-compgroups">
              {/* 행동 우선(0719): 지금 할 것(진행 중→잠김)을 위, 끝낸 것(수료 완료)을 아래 */}
              <CompGroup title="진행 중" icon="ph-fill ph-hourglass-medium" items={inProgressCourses} navigate={navigate} onCertificate={setCertCourse} />
              <CompGroup title="잠김" icon="ph-fill ph-lock-simple" items={lockedCourses} navigate={navigate} onCertificate={setCertCourse} />
              <CompGroup title="수료 완료" icon="ph-fill ph-seal-check" items={passedCourses} navigate={navigate} onCertificate={setCertCourse} />
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

      {/* ===== 학습 통계 탭 — 강의 시청 기반(완주·코스 진도·시청 현황) ===== */}
      {recTab === 'stats' && (
        !lecReady ? (
          <section className="mr-section">
            <div className="mr-card mr-lempty-card">
              <i className="ph-fill ph-monitor-play" />
              <p>아직 시청 기록이 없어요. 강의를 시청하면 완주·진도 통계가 여기 쌓여요.</p>
            </div>
          </section>
        ) : (
          <>
            {/* 강의 스탯 타일 — 완주 강의·시청 중·수강 코스·완주율 */}
            <section className="mr-section mr-stats">
              <div className="mr-statgrid">
                <div className="mr-stat">
                  <span className="mr-staticon mr-staticon-seal"><i className="ph-fill ph-seal-check" /></span>
                  <div className="mr-statval">{lecDone}<span className="mr-statunit">강</span></div>
                  <div className="mr-statlabel">완주한 강의</div>
                </div>
                <div className="mr-stat">
                  <span className="mr-staticon mr-staticon-fire"><i className="ph-fill ph-play-circle" /></span>
                  <div className="mr-statval">{lecWatching}<span className="mr-statunit">강</span></div>
                  <div className="mr-statlabel">시청 중</div>
                </div>
                <div className="mr-stat">
                  <span className="mr-staticon mr-staticon-puzzle"><i className="ph-fill ph-books" /></span>
                  <div className="mr-statval">{myCourses.length}<span className="mr-statunit">개</span></div>
                  <div className="mr-statlabel">수강 코스</div>
                </div>
                <div className="mr-stat">
                  <span className="mr-staticon mr-staticon-target"><i className="ph-fill ph-target" /></span>
                  <div className="mr-statval">{lecCompletionPct}<span className="mr-statunit">%</span></div>
                  <div className="mr-statlabel">강의 완주율</div>
                </div>
              </div>
            </section>

            {/* 코스별 강의 진도 — 완주 강의/전체 강의 */}
            {courseProgress.length > 0 && (
              <section className="mr-section">
                <div className="mr-card">
                  <div className="mr-mhead">
                    <div>
                      <h3 className="mr-h3">코스별 강의 진도</h3>
                      <p className="mr-mcap">완주한 강의 / 전체 강의</p>
                    </div>
                  </div>
                  <div className="mr-mlist">
                    {courseProgress.map((cp) => (
                      <div key={cp.course.id}>
                        <div className="mr-mrow">
                          <span className="mr-mname">{cp.course.title}</span>
                          <span className="mr-mpct" style={{ color: 'var(--brand)' }}>{cp.pct}%</span>
                        </div>
                        <div className="mr-mbar">
                          <div className="mr-mfill" style={{ width: cp.pct + '%', background: 'var(--brand)' }} />
                        </div>
                        <div className="mr-msolved">전체 {cp.total}강 중 {cp.done}강 완주</div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* 강의 시청 현황 + 최근 시청 강의 */}
            <section className="mr-section mr-twoaxis">
              <div className="mr-card">
                <h3 className="mr-h3">강의 시청 현황</h3>
                <div className="mr-lseg-bar">
                  <div className="mr-lseg-done" style={{ width: (lecTotal ? (lecDone / lecTotal) * 100 : 0) + '%' }} />
                  <div className="mr-lseg-watch" style={{ width: (lecTotal ? (lecWatching / lecTotal) * 100 : 0) + '%' }} />
                </div>
                <div className="mr-lseg-legend">
                  <span className="mr-lseg-lg"><i className="ph-fill ph-circle mr-lseg-c-done" /> 완주 {lecDone}</span>
                  <span className="mr-lseg-lg"><i className="ph-fill ph-circle mr-lseg-c-watch" /> 시청 중 {lecWatching}</span>
                  <span className="mr-lseg-lg"><i className="ph-fill ph-circle mr-lseg-c-none" /> 미시작 {lecNotStarted}</span>
                </div>
              </div>
              <div className="mr-card">
                <h3 className="mr-h3">최근 시청 강의</h3>
                {recentWatching.length > 0 ? (
                  <ul className="mr-llist">
                    {recentWatching.map(({ l, pct }) => (
                      <li key={l.id} className="mr-lrow">
                        <span className="mr-lrow-title">{l.title}</span>
                        <div className="mr-mbar mr-lrow-bar">
                          <div className="mr-mfill" style={{ width: pct + '%', background: 'var(--ok)' }} />
                        </div>
                        <span className="mr-lrow-pct">{pct}%</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mr-lempty">시청 중인 강의가 없어요. 완주까지 이어서 학습해 보세요.</p>
                )}
              </div>
            </section>
          </>
        )
      )}

      {/* ===== 요약 탭: 최근 학습 기록 ===== */}
      {recTab === 'summary' && !demo && (
      <section className="mr-section mr-recent">
        <div className="mr-card">
          <div className="mr-rhead">
            <div>
              <h3 className="mr-h3">최근 문제 풀이</h3>
              <p className="mr-rcap">문제은행·오늘의 Q에서 푼 기록이에요 (강의 시청과 별개)</p>
            </div>
          </div>
          <div className="mr-alist">
            {data.activities.map((a) => {
              /* 서버가 title='과학 학습', sub='과학 · 63문제'로 내려줘 과목명이 한 줄에 두 번
                 나온다. 제목에서 과목을 뽑아 부제 앞의 중복만 걷어낸다(형식이 다르면 원문 유지). */
              const subj = a.title.replace(/\s*학습$/, '').trim();
              const dupe = `${subj} · `;
              const sub = subj && a.sub.startsWith(dupe) ? a.sub.slice(dupe.length) : a.sub;
              return (
                <div key={a.title} className="mr-act">
                  <span className="mr-acticon" style={{ background: a.bg, color: a.color }}>
                    <i className={a.icon} />
                  </span>
                  <div className="mr-actbody">
                    <div className="mr-acttitle">{subj ? `${subj} 문제 풀이` : a.title}</div>
                    <div className="mr-actsub">{sub}</div>
                  </div>
                  <span className={`mr-actbadge ${a.grade === 'ok' ? 'mr-actok' : 'mr-actmid'}`}>{a.result}</span>
                  <span className="mr-acttime">{a.time}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      )}
      </>
      )}

      {/* 수료증 팝업 — 수료한 코스에서만 열린다(발급 자격은 서버가 최종 판정) */}
      {certCourse && (
        <CertificateModal
          courseId={certCourse.id}
          autoTitle={certCourse.title}
          onClose={() => setCertCourse(null)}
        />
      )}
    </StudentLayout>
  );
}
