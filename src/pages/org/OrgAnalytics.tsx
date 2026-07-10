import { useEffect, useState } from 'react';
import CountUp from '../../components/motion/CountUp';
import DemoBadge from '../../components/common/DemoBadge';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { useAuth } from '../../hooks/useAuth';
import { orgApi } from '../../api/org';
import { dateSuffix, downloadCSV } from '../../utils/download';
import { tableToPdf } from '../../utils/pdf';
import OrgLayout from '../../layouts/OrgLayout';
import './OrgAnalytics.css';

/** handoff `CatChap 학습분석.dc.html` 포팅 — 학습 분석(초록 테마 #17B08C) */

type Period = 'week' | 'month' | 'year';

interface OaPeriodData {
  kAcc: string;
  kAccDelta: string;
  kActive: string;
  kActiveSub: string;
  kSolved: string;
  kSolvedSub: string;
  kHelp: string;
  trendSub: string;
  axis: string[];
  accPct: number[];
}

// TODO(api): orgApi.analytics 실패 시 원본 하드코딩 데이터 유지
const FALLBACK: Record<Period, OaPeriodData> = {
  week: {
    kAcc: '90.4', kAccDelta: '+2.1%p', kActive: '214', kActiveSub: '이번 주 학습 학생',
    kSolved: '12,840', kSolvedSub: '이번 주 푼 문제', kHelp: '9',
    trendSub: '요일별 기관 평균', axis: ['월', '화', '수', '목', '금', '토', '일'],
    accPct: [85, 87, 86, 90, 89, 92, 93],
  },
  month: {
    kAcc: '89.6', kAccDelta: '+3.4%p', kActive: '238', kActiveSub: '이번 달 학습 학생',
    kSolved: '52,190', kSolvedSub: '이번 달 푼 문제', kHelp: '12',
    trendSub: '주차별 기관 평균', axis: ['1주', '2주', '3주', '4주', '5주'],
    accPct: [83, 85, 87, 89, 91],
  },
  year: {
    kAcc: '88.9', kAccDelta: '+7.2%p', kActive: '259', kActiveSub: '올해 학습 학생',
    kSolved: '612K', kSolvedSub: '올해 푼 문제', kHelp: '18',
    trendSub: '월별 기관 평균', axis: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
    accPct: [80, 82, 81, 84, 85, 86, 87, 88, 89, 90, 91, 92],
  },
};

/** 빈 기관(실집계 없음)용 0/빈 분석 데이터 — 축·부제 라벨은 유지하고 수치만 0으로 */
function zeroPeriodA(p: Period): OaPeriodData {
  const f = FALLBACK[p];
  return {
    ...f,
    kAcc: '0',
    kAccDelta: '',
    kActive: '0',
    kSolved: '0',
    kHelp: '0',
    accPct: f.accPct.map(() => 0),
  };
}

const EMPTY_AI = { strength: '', warning: '', recommend: '' };

const SUBJ_LAST: Record<string, number> = { 국어: 94, 영어: 82, 수학: 71, 과학: 90, 사회: 85, 생활: 88 };

const SUBJECTS = [
  { name: '국어', icon: 'ph-fill ph-book-open', bg: '#FFE7E2', color: '#FF5A4D', pct: 94, delta: 5, total: 3200 },
  { name: '영어', icon: 'ph-fill ph-translate', bg: '#FFEDE0', color: '#FF922E', pct: 82, delta: 2, total: 2600 },
  { name: '수학', icon: 'ph-fill ph-plus-minus', bg: '#E1F5EC', color: '#17B08C', pct: 71, delta: -4, total: 2400 },
  { name: '과학', icon: 'ph-fill ph-flask', bg: '#E6F0FF', color: '#2E7BFF', pct: 90, delta: 3, total: 2900 },
  { name: '사회', icon: 'ph-fill ph-scroll', bg: '#EDE9FF', color: '#8B6BFF', pct: 85, delta: 1, total: 2100 },
  { name: '생활', icon: 'ph-fill ph-house-line', bg: '#FFE9F1', color: '#FF6DA6', pct: 88, delta: 6, total: 2500 },
];

const GRADES = [
  { label: '1학년', short: '1', color: '#FFB43C', bg: '#FFF3D6', pct: 88, delta: 4, students: 62 },
  { label: '2학년', short: '2', color: '#33C892', bg: '#E1F5EC', pct: 90, delta: 2, students: 58 },
  { label: '3학년', short: '3', color: '#2E7BFF', bg: '#E6F0FF', pct: 89, delta: 5, students: 55 },
  { label: '4학년', short: '4', color: '#8B6BFF', bg: '#EDE9FF', pct: 91, delta: 1, students: 44 },
  { label: '5학년', short: '5', color: '#17B08C', bg: '#E1F5EC', pct: 93, delta: 2, students: 39 },
];

// TODO(api): orgApi.analytics(reasons) 실패 시 원본 하드코딩 분포 유지
const REASONS = [
  { label: '개념 오답 추정', pct: 38, color: '#FF5A6E' },
  { label: '조작 실수 추정', pct: 29, color: '#2E7BFF' },
  { label: '선택지 혼동 추정', pct: 21, color: '#8B6BFF' },
  { label: 'UI 문제 후보', pct: 12, color: '#FF922E' },
];

// TODO(api): orgApi.analytics(ai_summary) 실패 시 원본 하드코딩 문구 유지
const AI_SUMMARY = {
  strength: '국어·과학 정답률이 안정적으로 높아요. 이미지 선택형 문제 성취가 특히 우수해요.',
  warning: '수학에서 개념 오답이 늘고 있어요. 1-3반·2-3반에 집중 지도가 필요해요.',
  recommend: '저학년에 숫자 연산형 난이도를 낮추고, 사과 세기 같은 시각 활동을 배정해 보세요.',
};

const CLASSES = [
  { name: '1-2반', teacher: '이수진', acc: '90%', accColor: '#17B08C', sessions: '118회', weak: '수학', trend: '상승', trendIcon: 'ph-fill ph-trend-up' },
  { name: '2-1반', teacher: '박민호', acc: '92%', accColor: '#17B08C', sessions: '126회', weak: '영어', trend: '상승', trendIcon: 'ph-fill ph-trend-up' },
  { name: '1-3반', teacher: '최유나', acc: '84%', accColor: '#F0A400', sessions: '98회', weak: '수학', trend: '하락', trendIcon: 'ph-fill ph-trend-down' },
  { name: '3-2반', teacher: '정하늘', acc: '95%', accColor: '#17B08C', sessions: '131회', weak: '사회', trend: '유지', trendIcon: 'ph-fill ph-minus' },
  { name: '2-3반', teacher: '강도현', acc: '81%', accColor: '#F0A400', sessions: '88회', weak: '수학', trend: '하락', trendIcon: 'ph-fill ph-trend-down' },
];

/** 원본 buildChart 그대로 (theme #17B08C · 마지막 점 강조 #FF5A4D) */
function buildChart(acc: number[], axis: string[], period: Period) {
  const theme = '#17B08C';
  const hot = '#FF5A4D';
  const owner = '기관 전체';
  const n = acc.length;
  const last = n - 1;
  // 좌표는 플롯 영역(24~210) 안으로 클램프 — 범위 밖 값이 카드 밖으로 그려지지 않게
  const mapY = (v: number) => Math.max(24, Math.min(210, Math.round(210 - (v - 50) * 3.72)));
  const xAt = (i: number) => (n === 1 ? 335 : Math.round(44 + i * (582 / (n - 1))));
  const avg = Math.round(acc.reduce((a, b) => a + b, 0) / n);
  const yticks = [100, 90, 80, 70, 60, 50].map((v) => {
    const y = mapY(v);
    return { y, ty: y + 4, label: String(v) };
  });
  const points = acc.map((v, i) => {
    const isLast = i === last;
    const cx = xAt(i);
    const cy = mapY(v);
    const lx = Math.min(Math.max(cx, 24), 612);
    return { cx, cy, r: isLast ? 6 : 5, stroke: isLast ? hot : theme, fill: isLast ? hot : theme, label: `${v}%`, lx, ly: Math.max(cy - 13, 12) };
  });
  const linePts = acc.map((v, i) => `${xAt(i)},${mapY(v)}`).join(' ');
  const areaPts = `${linePts} ${xAt(last)},210 ${xAt(0)},210`;
  const avgY = mapY(avg);
  const valueRow = acc.map((v, i) => ({ label: axis[i], pct: `${v}%`, color: i === last ? hot : theme }));
  const first = acc[0];
  const lastV = acc[last];
  const prev = n > 1 ? acc[last - 1] : lastV;
  const trend = lastV > first ? '상승세' : lastV < first ? '하락세' : '유지';
  const delta = lastV - prev;
  const deltaStr = `${delta >= 0 ? '+' : ''}${delta}%p`;
  const scope = ({ week: '최근 한 주', month: '최근 한 달', year: '올해' } as Record<string, string>)[period] || '최근';
  const insight = `${owner}의 ${scope} 평균 정답률은 ${avg}%예요. 가장 최근 회차는 ${lastV}%로, 지난 회차보다 ${deltaStr} ${
    delta >= 0 ? '올랐어요' : '내렸어요'
  }. ${trend === '상승세' ? '꾸준히 오르고 있어요! 🎉' : trend === '하락세' ? '담당 선생님과 집중 지도를 맞춰보세요.' : '안정적으로 유지되고 있어요.'}`;
  return {
    yticks,
    points,
    linePts,
    areaPts,
    avgY,
    avgLabelY: avgY - 6,
    avgLabel: `평균 ${avg}%`,
    valueRow,
    pointCount: n,
    insight,
    trendBadge: `평균 ${avg}% · ${trend}`,
    trendBadgeIcon: trend === '하락세' ? 'ph-fill ph-trend-down' : 'ph-fill ph-trend-up',
    trendDown: trend === '하락세',
  };
}

const SUBJ_TARGET = '85%';
const GRADE_TARGET = '85%';

type OaSubject = (typeof SUBJECTS)[number];
type OaGrade = (typeof GRADES)[number];
type OaClassRow = (typeof CLASSES)[number];
type OaReason = (typeof REASONS)[number];
type OaAiSummary = typeof AI_SUMMARY;

/* eslint-disable @typescript-eslint/no-explicit-any */
/** GET /orgs/{id}/analytics → OaPeriodData (API의 accSeries → 화면 accPct) */
function mapAnalytics(api: any): Partial<OaPeriodData> {
  const d: Partial<OaPeriodData> = {};
  const strKeys = ['kAcc', 'kAccDelta', 'kActive', 'kActiveSub', 'kSolved', 'kSolvedSub', 'kHelp', 'trendSub'] as const;
  for (const k of strKeys) if (api[k] != null) d[k] = String(api[k]);
  if (Array.isArray(api.axis) && api.axis.length > 0) d.axis = api.axis.map(String);
  const series = Array.isArray(api.accPct) ? api.accPct : api.accSeries;
  if (Array.isArray(series) && series.length > 0) d.accPct = series.map(Number);
  return d;
}

function trendIconOf(trend: string) {
  return trend === '상승' ? 'ph-fill ph-trend-up' : trend === '하락' ? 'ph-fill ph-trend-down' : 'ph-fill ph-minus';
}

/** analytics.subjects (meta.soft/color) → 과목별 정답률 바 */
function mapSubjects(list: any): OaSubject[] | null {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list.map((s: any, i: number): OaSubject => {
    const fb = SUBJECTS[i % SUBJECTS.length];
    return {
      name: String(s.name ?? ''),
      icon: s.icon ?? s.meta?.icon ?? fb.icon,
      bg: s.meta?.soft ?? s.bg ?? fb.bg,
      color: s.meta?.color ?? s.color ?? fb.color,
      pct: Number(s.pct ?? 0),
      delta: Number(s.delta ?? 0),
      total: Number(s.total ?? 0),
    };
  });
}

/** analytics.grades → 학년별 정답률 바 (색상은 디자인 팔레트 유지) */
function mapGradeRows(list: any): OaGrade[] | null {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list.map((g: any, i: number): OaGrade => {
    const fb = GRADES[i % GRADES.length];
    const label = String(g.label ?? '');
    return {
      label,
      short: g.short ?? ([...label][0] ?? ''),
      color: g.color ?? fb.color,
      bg: g.bg ?? fb.bg,
      pct: Number(g.pct ?? 0),
      delta: Number(g.delta ?? 0),
      students: Number(g.students ?? 0),
    };
  });
}

/** analytics.reasons (pct "38%" 문자열 또는 숫자 → 숫자 정규화) → 오답 원인 분포 바 */
function mapReasons(list: any): OaReason[] | null {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list.map((r: any, i: number): OaReason => {
    const fb = REASONS[i % REASONS.length];
    const pct = typeof r.pct === 'number' ? r.pct : parseFloat(String(r.pct ?? '')) || 0;
    return {
      label: String(r.label ?? fb.label),
      pct,
      color: r.color ?? fb.color,
    };
  });
}

/** analytics.ai_summary {strength, warning, recommend} → AI 분석 요약 (빠진 필드는 원본 문구 유지) */
function mapAiSummary(api: any): OaAiSummary | null {
  if (!api || typeof api !== 'object') return null;
  return {
    strength: typeof api.strength === 'string' && api.strength ? api.strength : AI_SUMMARY.strength,
    warning: typeof api.warning === 'string' && api.warning ? api.warning : AI_SUMMARY.warning,
    recommend: typeof api.recommend === 'string' && api.recommend ? api.recommend : AI_SUMMARY.recommend,
  };
}

/** analytics.classes (acc 숫자 → "90%" 문자열, trend → 아이콘 파생) */
function mapClassRows(list: any): OaClassRow[] | null {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list.map((c: any): OaClassRow => {
    const accNum = typeof c.acc === 'number' ? c.acc : parseInt(String(c.acc ?? ''), 10) || 0;
    const trend = String(c.trend ?? '유지');
    return {
      name: String(c.name ?? ''),
      teacher: String(c.teacher ?? ''),
      acc: typeof c.acc === 'string' ? c.acc : `${accNum}%`,
      accColor: accNum >= 90 ? '#17B08C' : '#F0A400',
      sessions: String(c.sessions ?? ''),
      weak: String(c.weak ?? ''),
      trend,
      trendIcon: trendIconOf(trend),
    };
  });
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function OrgAnalytics() {
  const { me } = useAuth();
  const orgId = me?.organization_id ?? null;
  const [period, setPeriod] = useState<Period>('week');
  const [trendSubject, setTrendSubject] = useState('all');
  const [remote, setRemote] = useState<{ key: string; data: Partial<OaPeriodData> } | null>(null);
  const [demo, setDemo] = useState(false); // 학습 실집계 없어 그래프·표가 데모값이면 true
  const [subjects, setSubjects] = useState<OaSubject[]>([]);
  const [grades, setGrades] = useState<OaGrade[]>([]);
  const [classes, setClasses] = useState<OaClassRow[]>([]);
  const [reasons, setReasons] = useState<OaReason[]>([]);
  const [aiSummary, setAiSummary] = useState<OaAiSummary>(EMPTY_AI);
  const [subjTarget, setSubjTarget] = useState(SUBJ_TARGET);
  const [gradeTarget, setGradeTarget] = useState(GRADE_TARGET);

  const remoteKey = `${period}|${trendSubject}`;

  useEffect(() => {
    if (!orgId) return;
    let on = true;
    orgApi
      .analytics(orgId, period, trendSubject === 'all' ? undefined : trendSubject)
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      .then((res: any) => {
        if (!on || !res || typeof res !== 'object') return;
        const blob = res[period] ?? res;
        // demo=true → 실집계 없음. 데모 수치 대신 0/빈으로 렌더(디자인 데모 금지).
        if (blob.demo) {
          setDemo(true);
          setSubjects([]);
          setGrades([]);
          setClasses([]);
          setReasons([]);
          setAiSummary(EMPTY_AI);
          setRemote(null);
          return;
        }
        setDemo(false);
        const mapped = mapAnalytics(blob);
        if (mapped.kAcc || Array.isArray(mapped.accPct)) setRemote({ key: `${period}|${trendSubject}`, data: mapped });
        setSubjects(mapSubjects(blob.subjects) ?? []);
        setGrades(mapGradeRows(blob.grades) ?? []);
        setClasses(mapClassRows(blob.classes) ?? []);
        setReasons(mapReasons(blob.reasons) ?? []);
        const ai = mapAiSummary(blob.ai_summary);
        if (ai) setAiSummary(ai);
        if (typeof blob.subjTarget === 'string' && blob.subjTarget) setSubjTarget(blob.subjTarget);
        if (typeof blob.gradeTarget === 'string' && blob.gradeTarget) setGradeTarget(blob.gradeTarget);
      })
      .catch(() => {
        // TODO(api): 실패 시 FALLBACK 유지
      });
    return () => {
      on = false;
    };
  }, [orgId, period, trendSubject]);

  // 실집계가 확인된 경우에만 FALLBACK 라벨 위에 실데이터를 덮어씀. 그 전(로딩)·demo면 0/빈 상태.
  const hasReal = !demo && !!remote && remote.key === remoteKey;
  const d: OaPeriodData = hasReal
    ? { ...FALLBACK[period], ...(remote as { data: Partial<OaPeriodData> }).data }
    : zeroPeriodA(period);

  // 과목 선택 시 시리즈 이동 (원본 로직) — 실데이터일 때만, API가 accPct를 안 준 경우에 합성
  let accSeries = d.accPct;
  if (hasReal && trendSubject !== 'all' && !Array.isArray(remote?.data.accPct)) {
    const shift = SUBJ_LAST[trendSubject] - d.accPct[d.accPct.length - 1];
    accSeries = d.accPct.map((v) => Math.max(45, Math.min(99, v + shift)));
  }

  const chart = buildChart(accSeries, d.axis, period);

  return (
    <OrgLayout active="analytics" widget="insight">
      <DemoBadge show={demo} variant="banner" />
      {/* HEADER */}
      <div className="oa-header">
        <div>
          <div className="oa-breadcrumb">
            <Link to={PATHS.ORG_HOME}>기관 콘솔</Link>
            <i className="ph-bold ph-caret-right" />
            <span>학습 분석</span>
          </div>
          <h1 className="oa-title">학습 분석</h1>
          <p className="oa-subtitle">{me?.organization_name ? `${me.organization_name} · ` : ''}과목별·학급별 학습 성취와 오답 패턴을 살펴봐요.</p>
        </div>
        <div className="oa-headerRight">
          <div className="oa-periodBox">
            <button className={`oa-periodBtn${period === 'week' ? ' oa-on' : ''}`} onClick={() => setPeriod('week')}>주</button>
            <button className={`oa-periodBtn${period === 'month' ? ' oa-on' : ''}`} onClick={() => setPeriod('month')}>월</button>
            <button className={`oa-periodBtn${period === 'year' ? ' oa-on' : ''}`} onClick={() => setPeriod('year')}>년</button>
          </div>
          {(() => {
            // 학습 분석 — 요약 KPI + 과목별 정답률 (현재 기간, CSV/PDF 공용)
            const exportRows = [
              ['[요약]', `기간: ${period === 'week' ? '주' : period === 'month' ? '월' : '년'}`],
              ['평균 정답률(%)', d.kAcc],
              ['학습 학생', d.kActive],
              ['푼 문제', d.kSolved],
              ['도움 필요 학생', d.kHelp],
              [],
              ['[과목별 정답률]'],
              ['과목', '정답률(%)', '증감(%p)', '푼 문제'],
              ...subjects.map((s) => [s.name, s.pct, s.delta, s.total]),
            ];
            return (
              <>
                <button className="oa-exportBtn" onClick={() => downloadCSV(`학습분석_${period}_${dateSuffix()}.csv`, exportRows)}>
                  <i className="ph-fill ph-export" />CSV
                </button>
                <button className="oa-exportBtn" onClick={() => tableToPdf(`학습분석_${period}_${dateSuffix()}.pdf`, '학습 분석', exportRows).catch((e) => console.error('PDF 저장 실패', e))}>
                  <i className="ph-fill ph-file-pdf" />PDF
                </button>
              </>
            );
          })()}
        </div>
      </div>

      {/* KPI ROW */}
      <div className="oa-kpiRow">
        <div className="oa-kpiCard">
          <div className="oa-kpiHead">
            <span className="oa-kpiIcon" style={{ background: '#E1F5EC', color: '#17B08C' }}>
              <i className="ph-fill ph-target" />
            </span>
            <span className="oa-kpiDelta">{d.kAccDelta}</span>
          </div>
          <div className="oa-kpiValue">
            <CountUp value={d.kAcc} />
            <span className="oa-kpiUnit">%</span>
          </div>
          <div className="oa-kpiLabel">기관 평균 정답률</div>
        </div>
        <div className="oa-kpiCard">
          <div className="oa-kpiHead">
            <span className="oa-kpiIcon" style={{ background: '#E6F0FF', color: '#2E7BFF' }}>
              <i className="ph-fill ph-fire" />
            </span>
          </div>
          <div className="oa-kpiValue">
            <CountUp value={d.kActive} />
            <span className="oa-kpiUnit">명</span>
          </div>
          <div className="oa-kpiLabel">{d.kActiveSub}</div>
        </div>
        <div className="oa-kpiCard">
          <div className="oa-kpiHead">
            <span className="oa-kpiIcon" style={{ background: '#FFF3D6', color: '#F0A400' }}>
              <i className="ph-fill ph-books" />
            </span>
          </div>
          <div className="oa-kpiValue"><CountUp value={d.kSolved} /></div>
          <div className="oa-kpiLabel">{d.kSolvedSub}</div>
        </div>
        <div className="oa-kpiCard">
          <div className="oa-kpiHead">
            <span className="oa-kpiIcon" style={{ background: '#FFE9F1', color: '#FF6DA6' }}>
              <i className="ph-fill ph-hand-heart" />
            </span>
          </div>
          <div className="oa-kpiValue">
            <CountUp value={d.kHelp} />
            <span className="oa-kpiUnit">명</span>
          </div>
          <div className="oa-kpiLabel">도움 필요 학생</div>
        </div>
      </div>

      {/* SUBJECT + GRADE */}
      <div className="oa-grid2">
        <div className="oa-card">
          <div className="oa-cardHead">
            <div>
              <h3 className="oa-cardTitle">과목별 정답률</h3>
              <p className="oa-cardSub">낮은 과목은 담당 선생님과 공유돼요</p>
            </div>
            <span className="oa-targetBadge">
              <span className="oa-targetTick" />목표 {subjTarget}
            </span>
          </div>
          <div className="oa-barList">
            {subjects.length === 0 && (
              <div style={{ padding: '20px 4px', textAlign: 'center', color: '#9AA0B0', fontSize: 14 }}>
                아직 과목별 학습 데이터가 없어요.
              </div>
            )}
            {subjects.map((s) => {
              const c = Math.round((s.total * s.pct) / 100);
              const up = s.delta >= 0;
              return (
                <div key={s.name}>
                  <div className="oa-barRow">
                    <span className="oa-barIcon" style={{ background: s.bg, color: s.color }}>
                      <i className={s.icon} />
                    </span>
                    <span className="oa-barName">{s.name}</span>
                    <span className={up ? 'oa-delta oa-deltaUp' : 'oa-delta oa-deltaDown'}>
                      <i className={up ? 'ph-fill ph-trend-up' : 'ph-fill ph-trend-down'} />
                      {up ? '+' : ''}{s.delta}%p
                    </span>
                    <span className="oa-barPct" style={{ color: s.color }}>{s.pct}%</span>
                  </div>
                  <div className="oa-barTrackWrap">
                    <div className="oa-barTrack">
                      <div className="oa-barFill" style={{ width: `${s.pct}%`, background: s.color }} />
                    </div>
                    <div className="oa-barTargetMark" title={`목표 ${subjTarget}`} style={{ left: subjTarget }} />
                  </div>
                  <div className="oa-barCaption">최근 {s.total.toLocaleString()}문제 중 {c.toLocaleString()}개 정답</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="oa-card">
          <div className="oa-cardHead">
            <div>
              <h3 className="oa-cardTitle">학년별 정답률</h3>
              <p className="oa-cardSub">학년이 오를수록 정답률이 안정돼요</p>
            </div>
            <span className="oa-targetBadge">
              <span className="oa-targetTick" />목표 {gradeTarget}
            </span>
          </div>
          <div className="oa-barList oa-barListGrade">
            {grades.length === 0 && (
              <div style={{ padding: '20px 4px', textAlign: 'center', color: '#9AA0B0', fontSize: 14 }}>
                아직 학년별 학습 데이터가 없어요.
              </div>
            )}
            {grades.map((g) => {
              const up = g.delta >= 0;
              return (
                <div key={g.label}>
                  <div className="oa-barRow">
                    <span className="oa-barIcon oa-barIconNum" style={{ background: g.bg, color: g.color }}>{g.short}</span>
                    <span className="oa-barName">{g.label}</span>
                    <span className={up ? 'oa-delta oa-deltaUp' : 'oa-delta oa-deltaDown'}>
                      <i className={up ? 'ph-fill ph-trend-up' : 'ph-fill ph-trend-down'} />
                      {up ? '+' : ''}{g.delta}%p
                    </span>
                    <span className="oa-barPct" style={{ color: g.color }}>{g.pct}%</span>
                  </div>
                  <div className="oa-barTrackWrap">
                    <div className="oa-barTrack">
                      <div className="oa-barFill" style={{ width: `${g.pct}%`, background: g.color }} />
                    </div>
                    <div className="oa-barTargetMark" title={`목표 ${gradeTarget}`} style={{ left: gradeTarget }} />
                  </div>
                  <div className="oa-barCaption">학생 {g.students}명 · 평균 정답률</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ERROR REASONS + TREND */}
      <div className="oa-grid2">
        <div className="oa-card">
          <h3 className="oa-reasonTitle">오답 원인 분포 (추정)</h3>
          <p className="oa-reasonSub">estimated_reason 기반 · 조작 미숙은 별도 집계</p>
          <div className="oa-reasonList">
            {reasons.length === 0 && (
              <div style={{ padding: '20px 4px', textAlign: 'center', color: '#9AA0B0', fontSize: 14 }}>
                아직 오답 데이터가 없어요.
              </div>
            )}
            {reasons.map((r) => (
              <div key={r.label}>
                <div className="oa-reasonHead">
                  <span>{r.label}</span>
                  <span style={{ color: r.color }}>{r.pct}%</span>
                </div>
                <div className="oa-barTrack">
                  <div className="oa-barFill" style={{ width: `${r.pct}%`, background: r.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* trend line */}
        <div className="oa-card">
          <div className="oa-trendHead">
            <div>
              <h3 className="oa-trendTitle">정답률 추이</h3>
              <p className="oa-trendSub">{d.trendSub} · 최근 {chart.pointCount}회 정답률</p>
            </div>
            <div className="oa-trendRight">
              <select className="oa-trendSelect" value={trendSubject} onChange={(e) => setTrendSubject(e.target.value)}>
                <option value="all">전체 과목</option>
                <option value="국어">국어</option>
                <option value="영어">영어</option>
                <option value="수학">수학</option>
                <option value="과학">과학</option>
                <option value="사회">사회</option>
                <option value="생활">생활</option>
              </select>
              <span className={chart.trendDown ? 'oa-trendBadge oa-trendBadgeDown' : 'oa-trendBadge oa-trendBadgeUp'}>
                <i className={chart.trendBadgeIcon} />
                {chart.trendBadge}
              </span>
            </div>
          </div>
          <svg viewBox="0 0 640 232" className="oa-trendSvg">
            {chart.yticks.map((t) => (
              <g key={t.label}>
                <line x1={44} y1={t.y} x2={626} y2={t.y} stroke="#F0F1F6" strokeWidth={1} />
                <text x={32} y={t.ty} textAnchor="end" fontSize={11} fontWeight={700} fill="#B7BBCB">
                  {t.label}
                </text>
              </g>
            ))}
            <polygon points={chart.areaPts} fill="#17B08C" opacity={0.1} />
            <line x1={44} y1={chart.avgY} x2={626} y2={chart.avgY} stroke="#FFB43C" strokeWidth={2} strokeDasharray="7 6" />
            {/* 평균 수치는 상단 배지(trendBadge)에 표시 — 차트 안 텍스트는 마지막 점 라벨과 겹쳐 제거 */}
            <polyline points={chart.linePts} fill="none" stroke="#17B08C" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
            {chart.points.map((p, i) => (
              <g key={i}>
                <circle cx={p.cx} cy={p.cy} r={p.r} fill="#fff" stroke={p.stroke} strokeWidth={3} />
                <text x={p.lx} y={p.ly} textAnchor="middle" fontSize={12.5} fontWeight={800} fill={p.fill}>
                  {p.label}
                </text>
              </g>
            ))}
          </svg>
          <div className="oa-axisRow">
            {d.axis.map((a) => (
              <span className="oa-axisItem" key={a}>{a}</span>
            ))}
          </div>
          <div className="oa-valueRow">
            {chart.valueRow.map((v) => (
              <div className="oa-valueItem" key={v.label}>
                <div className="oa-valueLabel">{v.label}</div>
                <div className="oa-valuePct" style={{ color: v.color }}>{v.pct}</div>
              </div>
            ))}
          </div>
          <div className="oa-insight">
            <span className="oa-insightIcon">
              <i className="ph-fill ph-chart-line-up" />
            </span>
            <p className="oa-insightText">{chart.insight}</p>
          </div>
        </div>
      </div>

      {/* CLASS TABLE */}
      <div className="oa-tableCard">
        <div className="oa-tableHead">
          <h3 className="oa-trendTitle">학급별 학습 성취</h3>
          <Link to={PATHS.ORG_CLASSES} className="oa-tableLink">학급 관리</Link>
        </div>
        <table className="oa-table">
          <thead>
            <tr>
              <th>학급 / 담당</th>
              <th>정답률</th>
              <th>주간 학습</th>
              <th>최다 오답 과목</th>
              <th>추세</th>
            </tr>
          </thead>
          <tbody>
            {classes.map((c) => (
              <tr key={c.name}>
                <td>
                  <b>{c.name}</b> · {c.teacher}
                </td>
                <td>
                  <span className="oa-acc" style={{ color: c.accColor }}>{c.acc}</span>
                </td>
                <td>{c.sessions}</td>
                <td>
                  <span className="oa-weakBadge">{c.weak}</span>
                </td>
                <td>
                  <span
                    className={
                      c.trend === '상승'
                        ? 'oa-trendTag oa-trendTagUp'
                        : c.trend === '하락'
                          ? 'oa-trendTag oa-trendTagDown'
                          : 'oa-trendTag oa-trendTagFlat'
                    }
                  >
                    <i className={c.trendIcon} />
                    {c.trend}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {classes.length === 0 && (
          <div style={{ padding: '28px 16px', textAlign: 'center', color: '#9AA0B0', fontSize: 14 }}>
            아직 학급별 학습 데이터가 없어요.
          </div>
        )}
      </div>

      {/* AI INSIGHT */}
      <div className="oa-ai">
        <div className="oa-aiHead">
          <span className="oa-aiIcon">
            <i className="ph-fill ph-robot" />
          </span>
          <h3 className="oa-aiTitle">AI 분석 요약</h3>
        </div>
        <div className="oa-aiGrid">
          <div className="oa-aiCard">
            <div className="oa-aiCardTitle">📈 강점</div>
            <p className="oa-aiCardText">{aiSummary.strength || '아직 분석할 학습 데이터가 없어요.'}</p>
          </div>
          <div className="oa-aiCard">
            <div className="oa-aiCardTitle">⚠️ 주의</div>
            <p className="oa-aiCardText">{aiSummary.warning || '아직 분석할 학습 데이터가 없어요.'}</p>
          </div>
          <div className="oa-aiCard">
            <div className="oa-aiCardTitle">💡 추천</div>
            <p className="oa-aiCardText">{aiSummary.recommend || '아직 분석할 학습 데이터가 없어요.'}</p>
          </div>
        </div>
      </div>
    </OrgLayout>
  );
}
