/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import CountUp from '../../components/motion/CountUp';
import DemoBadge from '../../components/common/DemoBadge';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { teacherApi } from '../../api/teacher';
import { dateSuffix, downloadCSV } from '../../utils/download';
import { tableToPdf } from '../../utils/pdf';
import TeacherLayout from '../../layouts/TeacherLayout';
import './TeacherAnalytics.css';

/** handoff `CatChap 선생님 학습분석.dc.html` 포팅 — 1-2반 학습 분석 */

type Period = 'week' | 'month' | 'term';

interface TaPeriodData {
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

// TODO(api): teacherApi.analytics 실패/로딩 시 원본 하드코딩 데이터 유지
const FALLBACK: Record<Period, TaPeriodData> = {
  week: {
    kAcc: '89', kAccDelta: '+3%p', kActive: '18 / 22명', kActiveSub: '이번 주 학습 학생',
    kSolved: '1,240', kSolvedSub: '이번 주 푼 문제', kHelp: '3',
    trendSub: '요일별 반 평균', axis: ['월', '화', '수', '목', '금', '토', '일'],
    accPct: [83, 85, 84, 88, 89, 91, 92],
  },
  month: {
    kAcc: '87', kAccDelta: '+4%p', kActive: '22 / 22명', kActiveSub: '이번 달 학습 학생',
    kSolved: '5,180', kSolvedSub: '이번 달 푼 문제', kHelp: '4',
    trendSub: '주차별 반 평균', axis: ['1주', '2주', '3주', '4주', '5주'],
    accPct: [80, 83, 85, 87, 89],
  },
  term: {
    kAcc: '86', kAccDelta: '+9%p', kActive: '22 / 22명', kActiveSub: '학기 중 학습 학생',
    kSolved: '38,600', kSolvedSub: '학기 중 푼 문제', kHelp: '5',
    trendSub: '월별 반 평균', axis: ['3월', '4월', '5월', '6월', '7월'],
    accPct: [78, 82, 85, 88, 90],
  },
};

// 원본 클라이언트 계산 로직 — FALLBACK 경로에서 과목별 시리즈 보정에 사용
const SUBJ_LAST: Record<string, number> = { 국어: 94, 영어: 82, 수학: 71, 과학: 90, 사회: 85, 생활: 88 };

const SUBJ_TARGET = '80%';

const SUBJECTS_RAW = [
  { name: '한글 낱말', icon: 'ph-fill ph-book-open', bg: '#EDE9FF', color: '#8B6BFF', pct: 94, delta: 3, total: 320 },
  { name: '그림 찾기', icon: 'ph-fill ph-image', bg: '#FFE9F1', color: '#FF6DA6', pct: 92, delta: 5, total: 280 },
  { name: '숫자 놀이터', icon: 'ph-fill ph-plus-minus', bg: '#E1F5EC', color: '#17B08C', pct: 72, delta: -4, total: 300 },
  { name: '끌어놓기', icon: 'ph-fill ph-hand-grabbing', bg: '#FFEDE0', color: '#FF922E', pct: 78, delta: 2, total: 240 },
  { name: '안전 지킴이', icon: 'ph-fill ph-shield-check', bg: '#E6F0FF', color: '#2E7BFF', pct: 88, delta: 6, total: 200 },
];

/** 원본 SUBJECTS 파생 로직 그대로 — API 매핑에서도 재사용 */
function buildSubject(s: {
  name: string; icon: string; bg: string; color: string;
  pct: number; delta: number; total: number; correct?: number;
}) {
  const c = s.correct ?? Math.round((s.total * s.pct) / 100);
  const up = s.delta >= 0;
  return {
    name: s.name,
    icon: s.icon,
    bg: s.bg,
    color: s.color,
    pct: s.pct + '%',
    caption: '최근 ' + s.total.toLocaleString() + '문제 중 ' + c.toLocaleString() + '개 정답',
    up,
    delta: (up ? '+' : '') + s.delta + '%p',
    deltaIcon: up ? 'ph-fill ph-trend-up' : 'ph-fill ph-trend-down',
  };
}

const SUBJECTS = SUBJECTS_RAW.map(buildSubject);

const REASONS = [
  { label: '개념 오답 추정', pct: '41%', color: '#FF5A6E' },
  { label: '조작 실수 추정', pct: '27%', color: '#2E7BFF' },
  { label: '선택지 혼동 추정', pct: '20%', color: '#8B6BFF' },
  { label: 'UI 문제 후보', pct: '12%', color: '#FF922E' },
];

const ATTENTION = [
  { name: '박도현', initial: '도', avatarBg: 'linear-gradient(135deg,#4AA6FF,#2E7BFF)', note: '숫자 놀이터 정답률 58%', tag: '개념 보강', tagColor: '#E0475E', tagBg: '#FFE3E9' },
  { name: '이서아', initial: '서', avatarBg: 'linear-gradient(135deg,#FF9Fc0,#FF6DA6)', note: '최근 5일 학습 없음', tag: '학습 뜸함', tagColor: '#B5720B', tagBg: '#FFF3D6' },
  { name: '김준우', initial: '준', avatarBg: 'linear-gradient(135deg,#FFC24B,#FF8A5B)', note: '끌어놓기 조작 실수 잦음', tag: '조작 연습', tagColor: '#2168D8', tagBg: '#E6F0FF' },
];

const STUDENTS = [
  { name: '강하은', acc: '96%', accColor: '#17B08C', sessions: '14회', weak: '숫자 놀이터', trend: '상승', trendIcon: 'ph-fill ph-trend-up' },
  { name: '박도현', acc: '58%', accColor: '#E0475E', sessions: '6회', weak: '숫자 놀이터', trend: '하락', trendIcon: 'ph-fill ph-trend-down' },
  { name: '이서아', acc: '74%', accColor: '#F0A400', sessions: '3회', weak: '끌어놓기', trend: '하락', trendIcon: 'ph-fill ph-trend-down' },
  { name: '정민지', acc: '91%', accColor: '#17B08C', sessions: '12회', weak: '안전 지킴이', trend: '유지', trendIcon: 'ph-fill ph-minus' },
  { name: '최유준', acc: '88%', accColor: '#17B08C', sessions: '11회', weak: '끌어놓기', trend: '상승', trendIcon: 'ph-fill ph-trend-up' },
  { name: '김준우', acc: '69%', accColor: '#F0A400', sessions: '7회', weak: '끌어놓기', trend: '하락', trendIcon: 'ph-fill ph-trend-down' },
];

/** 원본 DCLogic buildChart 좌표 계산 그대로 재현 */
function buildChart(acc: number[], axis: string[], period: Period) {
  const theme = '#8B6BFF';
  const hot = '#FF5A4D';
  const owner = '우리 반';
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
    return { cx, cy, r: isLast ? 6 : 5, stroke: isLast ? hot : theme, fill: isLast ? hot : theme, label: v + '%', lx, ly: Math.max(cy - 13, 12) };
  });
  const linePts = acc.map((v, i) => xAt(i) + ',' + mapY(v)).join(' ');
  const areaPts = linePts + ' ' + xAt(last) + ',210 ' + xAt(0) + ',210';
  const avgY = mapY(avg);
  const valueRow = acc.map((v, i) => ({ label: axis[i], pct: v + '%', color: i === last ? hot : theme }));
  const first = acc[0];
  const lastV = acc[last];
  const prev = n > 1 ? acc[last - 1] : lastV;
  const trend = lastV > first ? '상승세' : lastV < first ? '하락세' : '유지';
  const delta = lastV - prev;
  const deltaStr = (delta >= 0 ? '+' : '') + delta + '%p';
  const scope = ({ week: '최근 한 주', month: '최근 한 달', year: '올해', term: '이번 학기' } as Record<string, string>)[period] || '최근';
  const insight =
    owner + '의 ' + scope + ' 평균 정답률은 ' + avg + '%예요. 가장 최근 회차는 ' + lastV + '%로, 지난 회차보다 ' + deltaStr + ' ' +
    (delta >= 0 ? '올랐어요' : '내렸어요') + '. ' +
    (trend === '상승세' ? '꾸준히 오르고 있어요! 🎉' : trend === '하락세' ? '다음 주 학습을 조금 더 도와줘볼까요?' : '안정적으로 유지되고 있어요.');
  return {
    yticks,
    points,
    linePts,
    areaPts,
    avgY,
    avgLabelY: avgY - 6,
    avgLabel: '평균 ' + avg + '%',
    axis,
    valueRow,
    pointCount: n,
    insight,
    trendBadge: '평균 ' + avg + '% · ' + trend,
    trendBadgeIcon: trend === '하락세' ? 'ph-fill ph-trend-down' : 'ph-fill ph-trend-up',
    trendDown: trend === '하락세',
  };
}

/** API가 목록(과목/오답원인/관심학생/학생표)을 함께 주면 화면 모델로 변환해 담는다 */
interface TaRemote extends Partial<TaPeriodData> {
  subjects?: typeof SUBJECTS;
  reasons?: typeof REASONS;
  attention?: typeof ATTENTION;
  students?: typeof STUDENTS;
  subjTarget?: string;
}

/** 원본 STUDENTS 색상 규칙 재현: 96/91/88→초록, 74/69→노랑, 58→빨강 */
function studentAccColor(a: number) {
  return a >= 85 ? '#17B08C' : a >= 60 ? '#F0A400' : '#E0475E';
}

/**
 * API 응답을 기간 데이터로 매핑 (accSeries/accPct 시리즈가 있어야 채택).
 * GET /teacher/analytics: { axis[], accSeries[], kAcc, kAccDelta, kActive, kActiveSub,
 * kSolved, kSolvedSub, kHelp, trendSub, subjects[{pct,icon,name,delta,total,correct}],
 * reasons[{pct:'41%',color,label}], attention[{tag,name,note}],
 * students[{acc:number,name,weak,trend,sessions}], subjTarget }
 */
function mapAnalytics(res: any): TaRemote | null {
  if (!res || typeof res !== 'object') return null;
  const src = res.data ?? res;
  const accPct = Array.isArray(src.accPct)
    ? src.accPct
    : Array.isArray(src.acc_pct)
      ? src.acc_pct
      : Array.isArray(src.accSeries)
        ? src.accSeries
        : null;
  if (!accPct || !accPct.length) return null;
  const out: TaRemote = { accPct: accPct.map(Number) };
  if (Array.isArray(src.axis)) out.axis = src.axis.map(String);
  (['kAcc', 'kAccDelta', 'kActive', 'kActiveSub', 'kSolved', 'kSolvedSub', 'kHelp', 'trendSub'] as const).forEach((k) => {
    if (src[k] != null) out[k] = String(src[k]);
  });

  if (Array.isArray(src.subjects) && src.subjects.length) {
    out.subjects = src.subjects.map((s: any, i: number) => {
      // API에는 bg/color가 없어 이름 일치 → 없으면 순환으로 FALLBACK 팔레트 재사용
      const style = SUBJECTS_RAW.find((r) => r.name === s.name) ?? SUBJECTS_RAW[i % SUBJECTS_RAW.length];
      return buildSubject({
        name: String(s.name ?? ''),
        icon: String(s.icon ?? style.icon),
        bg: style.bg,
        color: style.color,
        pct: Number(s.pct ?? 0),
        delta: Number(s.delta ?? 0),
        total: Number(s.total ?? 0),
        correct: s.correct != null ? Number(s.correct) : undefined,
      });
    });
  }

  if (Array.isArray(src.reasons) && src.reasons.length) {
    out.reasons = src.reasons.map((r: any, i: number) => ({
      label: String(r.label ?? ''),
      pct: typeof r.pct === 'number' ? r.pct + '%' : String(r.pct ?? ''),
      color: String(r.color ?? REASONS[i % REASONS.length].color),
    }));
  }

  if (Array.isArray(src.attention) && src.attention.length) {
    out.attention = src.attention.map((a: any, i: number) => {
      const name = String(a.name ?? '');
      const chars = [...name];
      // 색상은 태그 일치 우선, 아니면 순환으로 FALLBACK 팔레트 재사용
      const pal = ATTENTION.find((f) => f.tag === a.tag) ?? ATTENTION[i % ATTENTION.length];
      return {
        name,
        initial: chars[1] ?? chars[0] ?? '냥', // 원본은 이름 두 번째 글자(도/서/준)
        avatarBg: pal.avatarBg,
        note: String(a.note ?? ''),
        tag: String(a.tag ?? ''),
        tagColor: pal.tagColor,
        tagBg: pal.tagBg,
      };
    });
  }

  if (Array.isArray(src.students) && src.students.length) {
    out.students = src.students.map((s: any) => {
      const acc = Number(s.acc ?? 0);
      const trend = String(s.trend ?? '유지');
      return {
        name: String(s.name ?? ''),
        acc: acc + '%',
        accColor: studentAccColor(acc),
        sessions: String(s.sessions ?? ''),
        weak: String(s.weak ?? ''),
        trend,
        trendIcon:
          trend === '상승' ? 'ph-fill ph-trend-up' : trend === '하락' ? 'ph-fill ph-trend-down' : 'ph-fill ph-minus',
      };
    });
  }

  if (src.subjTarget != null) {
    out.subjTarget = typeof src.subjTarget === 'number' ? src.subjTarget + '%' : String(src.subjTarget);
  }

  return out;
}

// TODO(api): teacherApi.analytics 실패/로딩 시 원본 하드코딩 문구 유지
const FALLBACK_AI = {
  strength: '한글 낱말·그림 찾기 정답률이 높아요. 이미지 선택형에서 특히 강해요.',
  warning: '숫자 놀이터에서 개념 오답이 늘고 있어요. 3명은 최근 학습이 뜸해요.',
  recommend: '숫자 연산 난이도를 한 단계 낮추고, 사과 세기 같은 시각 활동을 배정해 보세요.',
};

const FALLBACK_INSIGHT = '한글 정답률이 지난주 대비 +5%p 올랐어요.';

const KPI_ICONS = [
  { icon: 'ph-fill ph-target', bg: '#E1F5EC', color: '#17B08C' },
  { icon: 'ph-fill ph-fire', bg: '#EDE9FF', color: '#8B6BFF' },
  { icon: 'ph-fill ph-books', bg: '#E6F0FF', color: '#2E7BFF' },
  { icon: 'ph-fill ph-hand-heart', bg: '#FFE9F1', color: '#FF6DA6' },
];

export default function TeacherAnalytics() {
  const [period, setPeriod] = useState<Period>('week');
  const [trendSubject, setTrendSubject] = useState('all');
  const [remote, setRemote] = useState<Record<string, TaRemote>>({});
  const [className, setClassName] = useState('1-2반');
  const [aiSummary, setAiSummary] = useState(FALLBACK_AI);
  const [insight, setInsight] = useState(FALLBACK_INSIGHT);
  const [demo, setDemo] = useState(false); // 실집계 없어 시리즈·수치가 데모값이면 true

  const remoteKey = `${period}:${trendSubject}`;

  useEffect(() => {
    let on = true;
    teacherApi
      .analytics(period, trendSubject === 'all' ? undefined : trendSubject)
      .then((res: any) => {
        if (!on) return;
        // class_name / ai_summary / insight — 시리즈 유무와 무관하게 반영
        const src = res?.data ?? res;
        setDemo(!!src?.demo);
        if (src && typeof src === 'object') {
          if (src.class_name) setClassName(String(src.class_name));
          const ai = src.ai_summary;
          if (ai && typeof ai === 'object') {
            setAiSummary((a) => ({
              strength: ai.strength != null ? String(ai.strength) : a.strength,
              warning: ai.warning != null ? String(ai.warning) : a.warning,
              recommend: ai.recommend != null ? String(ai.recommend) : a.recommend,
            }));
          }
          if (src.insight) setInsight(String(src.insight));
        }
        const mapped = mapAnalytics(res);
        if (mapped) setRemote((r) => ({ ...r, [`${period}:${trendSubject}`]: mapped }));
      })
      .catch(() => {
        // TODO(api): 실패 시 FALLBACK 유지
      });
    return () => {
      on = false;
    };
  }, [period, trendSubject]);

  const base = FALLBACK[period];
  const rem = remote[remoteKey];
  const d: TaPeriodData = { ...base, ...(rem ?? {}) };

  // API가 준 목록이 있으면 사용, 없으면 원본 하드코딩 유지
  const subjects = rem?.subjects ?? SUBJECTS;
  const reasons = rem?.reasons ?? REASONS;
  const attention = rem?.attention ?? ATTENTION;
  const studentRows = rem?.students ?? STUDENTS;
  const subjTarget = rem?.subjTarget ?? SUBJ_TARGET;

  // 원본 클라이언트 계산: 과목 선택 시 시리즈 보정 (API 미응답 FALLBACK 경로)
  let accSeries = d.accPct;
  if (!rem && trendSubject !== 'all') {
    const shift = SUBJ_LAST[trendSubject] - base.accPct[base.accPct.length - 1];
    accSeries = base.accPct.map((v) => Math.max(45, Math.min(99, v + shift)));
  }

  const chart = buildChart(accSeries, d.axis, period);

  const kpis = [
    { value: d.kAcc, unit: '%', label: '반 평균 정답률', badge: d.kAccDelta },
    { value: d.kActive, unit: null, label: d.kActiveSub, badge: null },
    { value: d.kSolved, unit: null, label: d.kSolvedSub, badge: null },
    { value: d.kHelp, unit: '명', label: '도움이 필요한 학생', badge: null },
  ];

  return (
    <TeacherLayout
      bottomCard={
        <>
          <div className="tl-task-title">이번 주 인사이트</div>
          <div className="tl-task-desc">{insight}</div>
        </>
      }
    >
      <main className="ta-main">
        <DemoBadge show={demo} variant="banner" />
        {/* HEADER */}
        <div className="ta-header">
          <div>
            <div className="ta-crumbs">
              <Link to={PATHS.TEACHER_HOME} className="ta-crumbLink">선생님 콘솔</Link>
              <i className="ph-bold ph-caret-right" />
              <span>학습 분석</span>
            </div>
            <h1 className="ta-title">{className} 학습 분석</h1>
            <p className="ta-lead">우리 반 학생들의 성취와 오답 패턴을 살펴봐요. <b>개인정보는 담임에게만 보여요.</b></p>
          </div>
          <div className="ta-headActions">
            <div className="ta-segBox">
              <button onClick={() => setPeriod('week')} className={`ta-segBtn${period === 'week' ? ' ta-on' : ''}`}>주</button>
              <button onClick={() => setPeriod('month')} className={`ta-segBtn${period === 'month' ? ' ta-on' : ''}`}>월</button>
              <button onClick={() => setPeriod('term')} className={`ta-segBtn${period === 'term' ? ' ta-on' : ''}`}>학기</button>
            </div>
            {(() => {
              // 학급 학습분석 — KPI + 과목별 + 학생별 (현재 기간, CSV/PDF 공용)
              const exportRows = [
                ['[요약]', className, `기간: ${period === 'week' ? '주' : period === 'month' ? '월' : '학기'}`],
                ['반 평균 정답률(%)', d.kAcc],
                ['학습 학생', d.kActive],
                ['푼 문제', d.kSolved],
                ['도움 필요', d.kHelp],
                [],
                ['[과목별 정답률]'],
                ['과목', '정답률(%)', '증감(%p)'],
                ...subjects.map((s: any) => [s.name, s.pct, s.delta]),
                [],
                ['[학생별]'],
                ['이름', '정답률(%)', '상태'],
                ...studentRows.map((st: any) => [st.name, st.acc ?? st.pct ?? '', st.status ?? st.state ?? '']),
              ];
              return (
                <>
                  <button className="ta-exportBtn" onClick={() => downloadCSV(`${className}_학습분석_${period}_${dateSuffix()}.csv`, exportRows)}>
                    <i className="ph-fill ph-export" />CSV
                  </button>
                  <button className="ta-exportBtn" onClick={() => tableToPdf(`${className}_학습분석_${period}_${dateSuffix()}.pdf`, `${className} 학습 분석`, exportRows).catch((e) => console.error('PDF 저장 실패', e))}>
                    <i className="ph-fill ph-file-pdf" />PDF
                  </button>
                </>
              );
            })()}
          </div>
        </div>

        {/* KPI ROW */}
        <div className="ta-kpiRow">
          {kpis.map((k, i) => (
            <div className="ta-kpi" key={KPI_ICONS[i].icon}>
              <div className="ta-kpiHead">
                <span className="ta-kpiIcon" style={{ background: KPI_ICONS[i].bg, color: KPI_ICONS[i].color }}>
                  <i className={KPI_ICONS[i].icon} />
                </span>
                {k.badge && <span className="ta-kpiDelta">{k.badge}</span>}
              </div>
              <div className="ta-kpiVal">
                <CountUp value={k.value} />
                {k.unit && <span className="ta-kpiUnit">{k.unit}</span>}
              </div>
              <div className="ta-kpiLabel">{k.label}</div>
            </div>
          ))}
        </div>

        {/* SUBJECT + TREND */}
        <div className="ta-row1">
          <div className="ta-card">
            <div className="ta-subjHead">
              <div>
                <h3 className="ta-cardTitle">영역별 정답률</h3>
                <p className="ta-cardSub">우리 반 학생 평균 기준</p>
              </div>
              <span className="ta-targetChip"><span className="ta-targetTick" />목표 {subjTarget}</span>
            </div>
            <div className="ta-subjList">
              {subjects.map((s) => (
                <div key={s.name}>
                  <div className="ta-subjItemHead">
                    <span className="ta-subjIcon" style={{ background: s.bg, color: s.color }}>
                      <i className={s.icon} />
                    </span>
                    <span className="ta-subjName">{s.name}</span>
                    <span className={`ta-delta ${s.up ? 'ta-delta-up' : 'ta-delta-down'}`}>
                      <i className={s.deltaIcon} />{s.delta}
                    </span>
                    <span className="ta-subjPct" style={{ color: s.color }}>{s.pct}</span>
                  </div>
                  <div className="ta-subjBarWrap">
                    <div className="ta-subjTrack">
                      <div className="ta-subjFill" style={{ width: s.pct, background: s.color }} />
                    </div>
                    <div title={`목표 ${subjTarget}`} className="ta-subjTarget" style={{ left: subjTarget }} />
                  </div>
                  <div className="ta-subjCaption">{s.caption}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="ta-card">
            <div className="ta-trendHead">
              <div>
                <h3 className="ta-trendTitle">정답률 추이</h3>
                <p className="ta-trendSub">
                  {trendSubject === 'all' ? d.trendSub : d.trendSub + ' · ' + trendSubject} · 최근 {chart.pointCount}회
                </p>
              </div>
              <div className="ta-trendRight">
                <select value={trendSubject} onChange={(e) => setTrendSubject(e.target.value)} className="ta-select">
                  <option value="all">전체 과목</option>
                  <option value="국어">국어</option>
                  <option value="영어">영어</option>
                  <option value="수학">수학</option>
                  <option value="과학">과학</option>
                  <option value="사회">사회</option>
                  <option value="생활">생활</option>
                </select>
                <span className={`ta-trendBadge ${chart.trendDown ? 'ta-badge-down' : 'ta-badge-up'}`}>
                  <i className={chart.trendBadgeIcon} />{chart.trendBadge}
                </span>
              </div>
            </div>
            <svg viewBox="0 0 640 232" className="ta-chart">
              {chart.yticks.map((t) => (
                <g key={t.label}>
                  <line x1={44} y1={t.y} x2={626} y2={t.y} stroke="#F1F0F7" strokeWidth={1} />
                  <text x={32} y={t.ty} textAnchor="end" fontSize={11} fontWeight={700} fill="#B7B4C8">{t.label}</text>
                </g>
              ))}
              <polygon points={chart.areaPts} fill="#8B6BFF" opacity={0.10} />
              <line x1={44} y1={chart.avgY} x2={626} y2={chart.avgY} stroke="#FFB43C" strokeWidth={2} strokeDasharray="7 6" />
              {/* 평균 수치는 상단 배지(trendBadge)에 표시 — 차트 안 텍스트는 마지막 점 라벨과 겹쳐 제거 */}
              <polyline points={chart.linePts} fill="none" stroke="#8B6BFF" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
              {chart.points.map((p, i) => (
                <g key={i}>
                  <circle cx={p.cx} cy={p.cy} r={p.r} fill="#fff" stroke={p.stroke} strokeWidth={3} />
                  <text x={p.lx} y={p.ly} textAnchor="middle" fontSize={12.5} fontWeight={800} fill={p.fill}>{p.label}</text>
                </g>
              ))}
            </svg>
            <div className="ta-axisRow">
              {chart.axis.map((a) => (
                <span className="ta-axisItem" key={a}>{a}</span>
              ))}
            </div>
            <div className="ta-valueRow">
              {chart.valueRow.map((v) => (
                <div className="ta-value" key={v.label}>
                  <div className="ta-valueLabel">{v.label}</div>
                  <div className="ta-valueNum" style={{ color: v.color }}>{v.pct}</div>
                </div>
              ))}
            </div>
            <div className="ta-insight">
              <span className="ta-insightIcon"><i className="ph-fill ph-chart-line-up" /></span>
              <p className="ta-insightText">{chart.insight}</p>
            </div>
          </div>
        </div>

        {/* ERROR REASONS + ATTENTION */}
        <div className="ta-row2">
          <div className="ta-card">
            <h3 className="ta-cardTitle">오답 원인 분포 (추정)</h3>
            <p className="ta-cardSub ta-reasonSub">조작 미숙은 오답과 분리해 집계돼요</p>
            <div className="ta-reasonList">
              {reasons.map((r) => (
                <div key={r.label}>
                  <div className="ta-reasonHead">
                    <span>{r.label}</span>
                    <span style={{ color: r.color }}>{r.pct}</span>
                  </div>
                  <div className="ta-reasonTrack">
                    <div className="ta-reasonFill" style={{ width: r.pct, background: r.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="ta-card">
            <h3 className="ta-cardTitle">관심이 필요한 학생</h3>
            <p className="ta-cardSub ta-attnSub">정답률이 낮거나 최근 학습이 뜸한 학생</p>
            <div className="ta-attnList">
              {attention.map((a) => (
                <div className="ta-attnItem" key={a.name}>
                  <span className="ta-attnAvatar" style={{ background: a.avatarBg }}>{a.initial}</span>
                  <div className="ta-attnInfo">
                    <div className="ta-attnName">{a.name}</div>
                    <div className="ta-attnNote">{a.note}</div>
                  </div>
                  <span className="ta-attnTag" style={{ background: a.tagBg, color: a.tagColor }}>{a.tag}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* STUDENT TABLE */}
        <div className="ta-card ta-tableCard">
          <div className="ta-tableHead">
            <h3 className="ta-cardTitle ta-tableTitle">학생별 학습 현황</h3>
            <Link to={PATHS.TEACHER_CLASS} className="ta-tableLink">우리반 학생 전체 보기</Link>
          </div>
          <table className="ta-table">
            <thead>
              <tr>
                <th>학생</th>
                <th>정답률</th>
                <th>주간 학습</th>
                <th>최다 오답 영역</th>
                <th>추세</th>
              </tr>
            </thead>
            <tbody>
              {studentRows.map((s) => (
                <tr key={s.name}>
                  <td className="ta-tdName"><b>{s.name}</b></td>
                  <td><span className="ta-tdAcc" style={{ color: s.accColor }}>{s.acc}</span></td>
                  <td>{s.sessions}</td>
                  <td><span className="ta-weakChip">{s.weak}</span></td>
                  <td>
                    <span className={`ta-trendTag ${s.trend === '상승' ? 'ta-up' : s.trend === '하락' ? 'ta-down' : 'ta-flat'}`}>
                      <i className={s.trendIcon} />{s.trend}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* AI INSIGHT */}
        <div className="ta-aiCard">
          <div className="ta-aiHead">
            <span className="ta-aiIcon"><i className="ph-fill ph-robot" /></span>
            <h3 className="ta-aiTitle">AI 분석 요약</h3>
          </div>
          <div className="ta-aiGrid">
            <div className="ta-aiBox">
              <div className="ta-aiBoxTitle">📈 강점</div>
              <p className="ta-aiText">{aiSummary.strength}</p>
            </div>
            <div className="ta-aiBox">
              <div className="ta-aiBoxTitle">⚠️ 주의</div>
              <p className="ta-aiText">{aiSummary.warning}</p>
            </div>
            <div className="ta-aiBox">
              <div className="ta-aiBoxTitle">💡 추천</div>
              <p className="ta-aiText">{aiSummary.recommend}</p>
            </div>
          </div>
        </div>
      </main>
    </TeacherLayout>
  );
}
