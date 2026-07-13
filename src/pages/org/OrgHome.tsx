import { useEffect, useState, type CSSProperties } from 'react';
import CountUp from '../../components/motion/CountUp';
import DemoBadge from '../../components/common/DemoBadge';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { useAuth } from '../../hooks/useAuth';
import { orgApi } from '../../api/org';
import { dateSuffix, downloadCSV } from '../../utils/download';
import { tableToPdf } from '../../utils/pdf';
import OrgLayout from '../../layouts/OrgLayout';
import './OrgHome.css';

/** handoff `CatChap 기관.dc.html` 포팅 — 기관 요약 대시보드 */

type Period = 'week' | 'month' | 'year';

interface OhPeriodData {
  subtitle: string;
  periodLabel: string;
  lineSub: string;
  kStudents: string;
  kTeachers: string;
  kTeachersSub: string;
  kApi: string;
  kApiSub: string;
  kPass: string;
  kAvg: string;
  kFail: string;
  block: number[];
  pass: number[];
  axis: string[];
  dLow: number;
  dReview: number;
  dElevated: number;
  r: number[];
  apiCallLabel: string;
  apiCallValue: string;
}

// TODO(api): orgApi.dashboard 실패 시 원본 하드코딩 데이터 유지
const FALLBACK: Record<Period, OhPeriodData> = {
  week: {
    subtitle: '햇살초등학교 · 2026년 6월 4주차 · 실시간 집계',
    periodLabel: '이번 주',
    lineSub: '요일별 위험 신호로 step-up·restrict가 권고된 비율 (실험값)',
    kStudents: '248',
    kTeachers: '16',
    kTeachersSub: '교사 / 12 학급',
    kApi: '3,912',
    kApiSub: '오늘 API 요청',
    kPass: '94.2',
    kAvg: '11.4',
    kFail: '8.1',
    block: [97, 95, 98, 93, 96, 99, 97],
    pass: [86, 88, 84, 90, 88, 93, 91],
    axis: ['월', '화', '수', '목', '금', '토', '일'],
    dLow: 82,
    dReview: 12,
    dElevated: 6,
    r: [38, 29, 21, 12],
    apiCallLabel: '오늘 호출',
    apiCallValue: '3,912',
  },
  month: {
    subtitle: '햇살초등학교 · 2026년 6월 · 실시간 집계',
    periodLabel: '이번 달',
    lineSub: '주차별 위험 신호로 step-up·restrict가 권고된 비율 (실험값)',
    kStudents: '251',
    kTeachers: '16',
    kTeachersSub: '교사 / 12 학급',
    kApi: '86,540',
    kApiSub: '이번 달 API 요청',
    kPass: '93.1',
    kAvg: '11.8',
    kFail: '8.6',
    block: [95, 96, 97, 98, 99],
    pass: [85, 87, 89, 90, 92],
    axis: ['1주', '2주', '3주', '4주', '5주'],
    dLow: 79,
    dReview: 14,
    dElevated: 7,
    r: [41, 27, 20, 12],
    apiCallLabel: '이번 달 호출',
    apiCallValue: '86,540',
  },
  year: {
    subtitle: '햇살초등학교 · 2026년 · 실시간 집계',
    periodLabel: '올해',
    lineSub: '월별 위험 신호로 step-up·restrict가 권고된 비율 (실험값)',
    kStudents: '263',
    kTeachers: '18',
    kTeachersSub: '교사 / 13 학급',
    kApi: '1.02M',
    kApiSub: '올해 API 요청',
    kPass: '92.4',
    kAvg: '12.2',
    kFail: '9.0',
    block: [92, 93, 94, 95, 96, 95, 97, 97, 98, 98, 99, 99],
    pass: [82, 84, 85, 86, 87, 88, 89, 90, 90, 91, 92, 93],
    axis: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
    dLow: 76,
    dReview: 16,
    dElevated: 8,
    r: [40, 28, 19, 13],
    apiCallLabel: '올해 호출',
    apiCallValue: '1,024,880',
  },
};

/** 빈 기관(실집계 없음)용 0/빈 대시보드 — 라벨(축·부제)은 유지하고 수치만 0으로 */
function zeroPeriod(p: Period): OhPeriodData {
  const f = FALLBACK[p];
  return {
    ...f,
    subtitle: '',
    kStudents: '0',
    kTeachers: '0',
    kTeachersSub: '교사 / 0 학급',
    kApi: '0',
    kPass: '0',
    kAvg: '0',
    kFail: '0',
    block: f.block.map(() => 0),
    pass: f.pass.map(() => 0),
    dLow: 0,
    dReview: 0,
    dElevated: 0,
    r: f.r.map(() => 0),
    apiCallValue: '0',
  };
}

const GRADES = [
  { name: '초등학교 1학년', count: '42명', acc: '86%', wrong: '22%', time: '13.2초', c: '#FFB43C', bg: '#FFF3D6' },
  { name: '초등학교 2학년', count: '40명', acc: '89%', wrong: '19%', time: '12.4초', c: '#FF6DA6', bg: '#FFE9F1' },
  { name: '초등학교 3학년', count: '44명', acc: '91%', wrong: '16%', time: '11.6초', c: '#2E7BFF', bg: '#E6F0FF' },
  { name: '초등학교 4학년', count: '41명', acc: '93%', wrong: '13%', time: '10.8초', c: '#17B08C', bg: '#E1F5EC' },
  { name: '초등학교 5학년', count: '39명', acc: '94%', wrong: '11%', time: '10.2초', c: '#8B6BFF', bg: '#EDE9FF' },
  { name: '초등학교 6학년', count: '42명', acc: '95%', wrong: '9%', time: '9.6초', c: '#0EA5B5', bg: '#E0F5F8' },
];

const BARS = [
  { label: '1학년', pass: 88, fail: 7, block: 5 },
  { label: '2학년', pass: 90, fail: 6, block: 4 },
  { label: '3학년', pass: 91, fail: 5, block: 4 },
  { label: '4학년', pass: 92, fail: 5, block: 3 },
  { label: '5학년', pass: 93, fail: 4, block: 3 },
  { label: '6학년', pass: 94, fail: 4, block: 2 },
];

// TODO(api): orgApi.dashboard(classes) 실패 시 원본 하드코딩 목록 유지
const CLASS_ROWS = [
  { name: '1-2반', teacher: '이수진', count: 26, acc: '90%', accColor: '#17B08C', fail: '7%', risk: '낮음' },
  { name: '2-1반', teacher: '박민호', count: 24, acc: '92%', accColor: '#17B08C', fail: '5%', risk: '낮음' },
  { name: '1-3반', teacher: '최유나', count: 25, acc: '84%', accColor: '#F0A400', fail: '11%', risk: '주의' },
  { name: '3-2반', teacher: '정하늘', count: 27, acc: '95%', accColor: '#17B08C', fail: '4%', risk: '낮음' },
  { name: '2-3반', teacher: '강도현', count: 23, acc: '81%', accColor: '#F0A400', fail: '13%', risk: '주의' },
];

// 빈 기관 기본값 — 사이트 키/도메인/지표는 실제 연동 전까지 빈 값(가짜 도메인·키 노출 금지)
const FALLBACK_SITE = {
  message: '모든 서비스 정상 작동 중',
  siteKey: '',
  domain: '',
  errorRate: '',
  avgResponse: '',
  activeKeys: 0,
  subjectUsage: {} as Record<string, number>,
};

type OhGrade = (typeof GRADES)[number];
type OhBar = (typeof BARS)[number];
type OhClassRow = (typeof CLASS_ROWS)[number];

/** 학년 카드 강조색 → 배경색 (디자인 시드와 동일 매핑) */
const GRADE_BG: Record<string, string> = {
  '#FFB43C': '#FFF3D6',
  '#FF6DA6': '#FFE9F1',
  '#2E7BFF': '#E6F0FF',
  '#17B08C': '#E1F5EC',
  '#8B6BFF': '#EDE9FF',
  '#0EA5B5': '#E0F5F8',
};

/* eslint-disable @typescript-eslint/no-explicit-any */
/** GET /orgs/{id}/dashboard → OhPeriodData (API가 준 필드만 덮어씀) */
function mapDashboard(api: any): Partial<OhPeriodData> {
  const d: Partial<OhPeriodData> = {};
  const strKeys = [
    'subtitle', 'periodLabel', 'lineSub', 'kStudents', 'kTeachers', 'kTeachersSub',
    'kApi', 'kApiSub', 'kPass', 'kAvg', 'kFail', 'apiCallLabel', 'apiCallValue',
  ] as const;
  for (const k of strKeys) if (api[k] != null) d[k] = String(api[k]);
  const numArr = (v: any): number[] | undefined =>
    Array.isArray(v) && v.length > 0 ? v.map(Number) : undefined;
  const block = numArr(api.block);
  if (block) d.block = block;
  const pass = numArr(api.pass);
  if (pass) d.pass = pass;
  if (Array.isArray(api.axis) && api.axis.length > 0) d.axis = api.axis.map(String);
  if (typeof api.dLow === 'number') d.dLow = api.dLow;
  if (typeof api.dReview === 'number') d.dReview = api.dReview;
  if (typeof api.dElevated === 'number') d.dElevated = api.dElevated;
  const r = numArr(api.r);
  if (r) d.r = r;
  return d;
}

/** dashboard.grades (문자열 필드 "86%"·"42명"·"13.2초") → 학년 카드 */
function mapDashGrades(api: any): OhGrade[] | null {
  if (!Array.isArray(api?.grades) || api.grades.length === 0) return null;
  return api.grades.map((g: any, i: number): OhGrade => {
    const c = String(g.color ?? g.c ?? GRADES[i % GRADES.length].c);
    return {
      name: String(g.name ?? ''),
      count: String(g.count ?? ''),
      acc: String(g.acc ?? ''),
      wrong: String(g.wrong ?? ''),
      time: String(g.time ?? ''),
      c,
      bg: g.bg ?? GRADE_BG[c] ?? GRADES[i % GRADES.length].bg,
    };
  });
}

/** dashboard.gradeBars (숫자 pass/fail/block) → 통과·실패 구성 스택바 */
function mapDashBars(api: any): OhBar[] | null {
  if (!Array.isArray(api?.gradeBars) || api.gradeBars.length === 0) return null;
  return api.gradeBars.map((b: any): OhBar => ({
    label: String(b.label ?? ''),
    pass: Number(b.pass ?? 0),
    fail: Number(b.fail ?? 0),
    block: Number(b.block ?? 0),
  }));
}

/**
 * dashboard.classes → 학급별 요약 표.
 * API 형태: {name, teacher, acc:number, sessions, weak, trend} (D fallback도 동일 키) —
 * count/fail/risk는 응답에 없으므로 학급명이 일치하는 CLASS_ROWS 값으로 채움 (없으면 acc로 risk 파생).
 */
function mapDashClasses(api: any): OhClassRow[] | null {
  if (!Array.isArray(api?.classes) || api.classes.length === 0) return null;
  return api.classes.map((c: any): OhClassRow => {
    const seed = CLASS_ROWS.find((r) => r.name === c.name);
    const accNum = typeof c.acc === 'number' ? c.acc : parseInt(String(c.acc ?? ''), 10) || 0;
    return {
      name: String(c.name ?? ''),
      teacher: String(c.teacher ?? ''),
      count: typeof c.count === 'number' ? c.count : seed?.count ?? 0,
      acc: typeof c.acc === 'string' ? c.acc : `${accNum}%`,
      accColor: accNum >= 85 ? '#17B08C' : '#F0A400',
      fail: String(c.fail ?? seed?.fail ?? '-'),
      risk: String(c.risk ?? seed?.risk ?? (accNum >= 85 ? '낮음' : '주의')),
    };
  });
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** 원본 buildBot 좌표 재현 — y축은 0~100 전체 범위(차단율·통과율을 한 축에 담음), 좌표는 viewBox 안으로 클램프 */
function buildBot(block: number[], pass: number[]) {
  const n = block.length;
  const last = n - 1;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const mapY = (v: number) => Math.round(200 - clamp(v, 0, 100) * 1.8);
  const xAt = (i: number) => (n === 1 ? 335 : Math.round(44 + i * (582 / (n - 1))));
  const lxAt = (i: number) => clamp(xAt(i), 24, 616);
  const botTicks = [100, 75, 50, 25, 0].map((v) => {
    const y = mapY(v);
    return { y, ty: y + 4, label: String(v) };
  });
  const line = (arr: number[]) => arr.map((v, i) => `${xAt(i)},${mapY(v)}`).join(' ');
  const botBlockLine = line(block);
  const botPassLine = line(pass);
  const botPassArea = `${botPassLine} ${xAt(last)},200 ${xAt(0)},200`;
  const botBlockPts = block.map((v, i) => ({ cx: xAt(i), cy: mapY(v), label: `${v}%`, lx: lxAt(i), ly: Math.max(mapY(v) - 12, 10) }));
  const botPassPts = pass.map((v, i) => ({ cx: xAt(i), cy: mapY(v), label: `${v}%`, lx: lxAt(i), ly: Math.min(mapY(v) + 20, 224) }));
  const avg = (a: number[]) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
  return {
    botTicks,
    botBlockLine,
    botPassLine,
    botPassArea,
    botBlockPts,
    botPassPts,
    avgBlock: `${avg(block)}%`,
    avgPass: `${avg(pass)}%`,
    maxBlock: `${Math.max(...block)}%`,
  };
}

const REASONS = [
  { label: '개념 오답 추정', color: '#FF5A6E' },
  { label: '조작 실수 추정', color: '#2E7BFF' },
  { label: '선택지 혼동 추정', color: '#8B6BFF' },
  { label: 'UI 문제 후보', color: '#FF922E' },
];

const KPI_ICONS = [
  { icon: 'ph-fill ph-student', bg: '#FFF0EE', color: '#FF5A4D' },
  { icon: 'ph-fill ph-chalkboard-teacher', bg: '#EDE9FF', color: '#8B6BFF' },
  { icon: 'ph-fill ph-lightning', bg: '#E6F0FF', color: '#2E7BFF' },
  { icon: 'ph-fill ph-check-circle', bg: '#E1F5EC', color: '#17B08C' },
  { icon: 'ph-fill ph-timer', bg: '#FFF3D6', color: '#F0A400' },
  { icon: 'ph-fill ph-hand-tap', bg: '#FFE9F1', color: '#FF6DA6' },
];

export default function OrgHome() {
  const { me } = useAuth();
  const orgId = me?.organization_id ?? null;
  const [period, setPeriod] = useState<Period>('week');
  const [showMore, setShowMore] = useState(false);
  const [barPage, setBarPage] = useState(0);
  const [remote, setRemote] = useState<Partial<Record<Period, Partial<OhPeriodData>>>>({});
  const [demo, setDemo] = useState(false); // 학습 실집계 없어 정답률·학급표가 데모값이면 true
  const [grades, setGrades] = useState<OhGrade[]>([]);
  const [bars, setBars] = useState<OhBar[]>([]);
  const [classRows, setClassRows] = useState<OhClassRow[]>([]);
  const [site, setSite] = useState(FALLBACK_SITE);

  useEffect(() => {
    if (!orgId) return;
    let on = true;
    orgApi
      .dashboard(orgId, period)
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      .then((res: any) => {
        if (!on || !res || typeof res !== 'object') return;
        const blob = res[period] ?? res;
        // demo=true → 실집계 없음. 데모 수치 대신 0/빈으로 렌더(디자인 데모 금지).
        if (blob.demo) {
          setDemo(true);
          setGrades([]);
          setBars([]);
          setClassRows([]);
          setRemote((r) => ({ ...r, [period]: undefined }));
          return;
        }
        setDemo(false);
        const mapped = mapDashboard(blob);
        if (mapped.kStudents) setRemote((r) => ({ ...r, [period]: mapped }));
        const g = mapDashGrades(blob);
        setGrades(g ?? []);
        const b = mapDashBars(blob);
        setBars(b ?? []);
        const cls = mapDashClasses(blob);
        setClassRows(cls ?? []);
      })
      .catch(() => {
        // TODO(api): 실패 시 FALLBACK 유지
      });
    return () => {
      on = false;
    };
  }, [orgId, period]);

  useEffect(() => {
    if (!orgId) return;
    let on = true;
    orgApi
      .siteStatus(orgId)
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      .then((res: any) => {
        if (!on || !res) return;
        setSite({
          message: res.message ?? FALLBACK_SITE.message,
          siteKey: res.site_key ?? FALLBACK_SITE.siteKey,
          domain: res.domain ?? res.allowed_domain ?? FALLBACK_SITE.domain,
          errorRate: res.error_rate ?? FALLBACK_SITE.errorRate,
          avgResponse:
            typeof res.avg_latency_ms === 'number'
              ? `${res.avg_latency_ms}ms`
              : res.avg_response ?? FALLBACK_SITE.avgResponse,
          activeKeys: typeof res.active_keys === 'number' ? res.active_keys : FALLBACK_SITE.activeKeys,
          subjectUsage: res.subject_usage ?? FALLBACK_SITE.subjectUsage,
        });
      })
      .catch(() => {
        // TODO(api): 실패 시 FALLBACK_SITE 유지
      });
    return () => {
      on = false;
    };
  }, [orgId]);

  // 실집계가 확인된 경우에만 FALLBACK 라벨 위에 실데이터를 덮어씀. 그 전(로딩)·demo면 0/빈 상태.
  const hasReal = !demo && !!remote[period];
  const remoteD = remote[period] as Partial<OhPeriodData> | null;
  const d: OhPeriodData = hasReal
    ? { ...FALLBACK[period], ...remoteD }
    : zeroPeriod(period);
  // 통과/차단 요일 그래프는 행동데이터 축 — 학습 실집계(hasReal)와 소스가 달라,
  // 행동 실측이 빠졌으면 데모 곡선이 실측인 척 남는다. 그 경우 0 시리즈로 비운다.
  if (hasReal && !remoteD?.block) {
    const z = zeroPeriod(period);
    d.block = z.block;
    d.pass = z.pass;
  }
  const subtitle = me?.organization_name
    ? `${me.organization_name}${hasReal ? ' · 실시간 집계' : ''}`
    : '';

  const bot = buildBot(d.block, d.pass);
  const g1 = (d.dLow / 100).toFixed(4);
  const g2 = ((d.dLow + d.dReview) / 100).toFixed(4);
  const donutGradient = `conic-gradient(#17B08C 0turn ${g1}turn, #FFB43C ${g1}turn ${g2}turn, #FF5A4D ${g2}turn 1turn)`;

  const gradeCards = showMore ? grades : grades.slice(0, 3);
  const barPages = [bars.slice(0, 3), bars.slice(3, 6)];

  const kpis = [
    { value: d.kStudents, unit: null, label: '등록 학생' },
    { value: d.kTeachers, unit: null, label: d.kTeachersSub },
    { value: d.kApi, unit: null, label: d.kApiSub },
    { value: d.kPass, unit: '%', label: '인증 통과율' },
    { value: d.kAvg, unit: '초', label: '평균 풀이 시간' },
    { value: d.kFail, unit: '%', label: '조작 실패율' },
  ];

  return (
    <OrgLayout active="home" widget="pro">
      <DemoBadge show={demo} variant="banner" />
      {/* HEADER */}
      <div className="oh-header">
        <div>
          <h1 className="oh-title">기관 요약 대시보드</h1>
          <p className="oh-subtitle">{subtitle}</p>
        </div>
        <div className="oh-headerRight">
          <div className="oh-periodBox">
            <button className={`oh-periodBtn${period === 'week' ? ' oh-on' : ''}`} onClick={() => setPeriod('week')}>주</button>
            <button className={`oh-periodBtn${period === 'month' ? ' oh-on' : ''}`} onClick={() => setPeriod('month')}>월</button>
            <button className={`oh-periodBtn${period === 'year' ? ' oh-on' : ''}`} onClick={() => setPeriod('year')}>년</button>
          </div>
          {(() => {
            // 대시보드 KPI + 학급별 요약 (현재 기간 기준 — CSV/PDF 공용)
            const exportRows = [
              ['[요약 지표]', `기간: ${period === 'week' ? '주' : period === 'month' ? '월' : '년'}`],
              ['지표', '값'],
              ...kpis.map((k) => [k.label, `${k.value}${k.unit ?? ''}`]),
              [],
              ['[학급별 요약]'],
              ['반', '담임', '학생 수', '정답률', '조작 실패', '위험'],
              ...classRows.map((c) => [c.name, c.teacher, c.count, c.acc, c.fail, c.risk]),
            ];
            return (
              <>
                <button className="oh-exportBtn" onClick={() => downloadCSV(`기관리포트_${period}_${dateSuffix()}.csv`, exportRows)}>
                  <i className="ph-fill ph-export" />CSV
                </button>
                <button className="oh-exportBtn" onClick={() => tableToPdf(`기관리포트_${period}_${dateSuffix()}.pdf`, '기관 요약 리포트', exportRows).catch((e) => console.error('PDF 저장 실패', e))}>
                  <i className="ph-fill ph-file-pdf" />PDF
                </button>
              </>
            );
          })()}
        </div>
      </div>

      {/* KPI ROW */}
      <div className="oh-kpiRow">
        {kpis.map((k, i) => (
          <div className="oh-kpiCard" key={KPI_ICONS[i].icon}>
            <span className="oh-kpiIcon" style={{ background: KPI_ICONS[i].bg, color: KPI_ICONS[i].color }}>
              <i className={KPI_ICONS[i].icon} />
            </span>
            <div className="oh-kpiValue">
              <CountUp value={k.value} />
              {k.unit && <span className="oh-kpiUnit">{k.unit}</span>}
            </div>
            <div className="oh-kpiLabel">{k.label}</div>
          </div>
        ))}
      </div>

      {/* CHARTS ROW 1 */}
      <div className="oh-row1">
        {/* line chart */}
        <div className="oh-card">
          <div className="oh-lineHead">
            <div>
              <h3 className="oh-cardTitle">봇 차단율 추이</h3>
              <p className="oh-lineSub">{d.lineSub}</p>
            </div>
            <div className="oh-legend">
              <span className="oh-legendItem">
                <span className="oh-legendDot" style={{ background: '#FF5A4D' }} />차단율
              </span>
              <span className="oh-legendItem">
                <span className="oh-legendDot" style={{ background: '#2E7BFF' }} />통과율
              </span>
            </div>
          </div>
          <svg viewBox="0 0 640 232" className="oh-lineSvg">
            {bot.botTicks.map((t) => (
              <g key={t.label}>
                <line x1={44} y1={t.y} x2={626} y2={t.y} stroke="#F0F1F6" strokeWidth={1} />
                <text x={32} y={t.ty} textAnchor="end" fontSize={11} fontWeight={700} fill="#B7BBCB">
                  {t.label}
                </text>
              </g>
            ))}
            <polygon points={bot.botPassArea} fill="#2E7BFF" opacity={0.08} />
            <polyline points={bot.botBlockLine} fill="none" stroke="#FF5A4D" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={bot.botPassLine} fill="none" stroke="#2E7BFF" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
            {bot.botBlockPts.map((p, i) => (
              <g key={`b${i}`}>
                <circle cx={p.cx} cy={p.cy} r={4.5} fill="#fff" stroke="#FF5A4D" strokeWidth={3} />
                <text x={p.lx} y={p.ly} textAnchor="middle" fontSize={11} fontWeight={800} fill="#E0475E">
                  {p.label}
                </text>
              </g>
            ))}
            {bot.botPassPts.map((p, i) => (
              <g key={`p${i}`}>
                <circle cx={p.cx} cy={p.cy} r={4.5} fill="#fff" stroke="#2E7BFF" strokeWidth={3} />
                <text x={p.lx} y={p.ly} textAnchor="middle" fontSize={11} fontWeight={800} fill="#2168D8">
                  {p.label}
                </text>
              </g>
            ))}
          </svg>
          <div className="oh-axisRow">
            {d.axis.map((a) => (
              <span className="oh-axisItem" key={a}>{a}</span>
            ))}
          </div>
          <div className="oh-lineStats">
            <div className="oh-lineStat">
              <div className="oh-lineStatLabel">평균 차단율</div>
              <div className="oh-lineStatValue" style={{ color: '#FF5A4D' }}>{bot.avgBlock}</div>
            </div>
            <div className="oh-lineStat">
              <div className="oh-lineStatLabel">평균 통과율</div>
              <div className="oh-lineStatValue" style={{ color: '#2E7BFF' }}>{bot.avgPass}</div>
            </div>
            <div className="oh-lineStat">
              <div className="oh-lineStatLabel">최고 차단율</div>
              <div className="oh-lineStatValue" style={{ color: '#2E3040' }}>{bot.maxBlock}</div>
            </div>
          </div>
        </div>
        {/* donut */}
        <div className="oh-card">
          <h3 className="oh-donutTitle">위험 신호 분포</h3>
          <p className="oh-donutSub">low / review / elevated</p>
          <div className="oh-donutBody">
            <div className="oh-donut" style={{ background: donutGradient }}>
              <div className="oh-donutHole">
                <span className="oh-donutValue">{d.dElevated}%</span>
                <span className="oh-donutLabel">주의 이상</span>
              </div>
            </div>
            <div className="oh-donutList">
              <div className="oh-donutRow">
                <span className="oh-donutKey"><span className="oh-donutDot" style={{ background: '#17B08C' }} />low</span>
                <span>{d.dLow}%</span>
              </div>
              <div className="oh-donutRow">
                <span className="oh-donutKey"><span className="oh-donutDot" style={{ background: '#FFB43C' }} />review</span>
                <span>{d.dReview}%</span>
              </div>
              <div className="oh-donutRow">
                <span className="oh-donutKey"><span className="oh-donutDot" style={{ background: '#FF5A4D' }} />elevated</span>
                <span>{d.dElevated}%</span>
              </div>
            </div>
          </div>
          <p className="oh-donutNote">어린이 조작 미숙은 위험 신호와 분리해 집계합니다.</p>
        </div>
      </div>

      {/* CHARTS ROW 2 */}
      <div className="oh-row2">
        {/* stacked pass/fail */}
        <div className="oh-card">
          <div className="oh-barHead">
            <div>
              <h3 className="oh-barTitle">통과 · 실패 구성</h3>
              <p className="oh-barSub">정답 통과 · 조작 실패 · 위험 차단 분리</p>
            </div>
            <button className="oh-barToggle" onClick={() => setBarPage((p) => (p === 0 ? 1 : 0))}>
              {barPage === 0 ? '4-6학년' : '1-3학년'}
              <i className={barPage === 0 ? 'ph-bold ph-caret-right' : 'ph-bold ph-caret-left'} />
            </button>
          </div>
          <div className="oh-barViewport">
            <div className="oh-barTrack" style={{ transform: `translateX(${barPage === 0 ? '0%' : '-100%'})` }}>
              {barPages.map((pg, pi) => (
                <div className="oh-barPage" key={pi}>
                  {pg.map((b) => (
                    <div className="oh-barCol" key={b.label}>
                      <div className="oh-barStack">
                        <div className="oh-barBlock" style={{ height: `${b.block}%` }} />
                        <div className="oh-barFail" style={{ height: `${b.fail}%` }} />
                        <div className="oh-barPass" style={{ height: `${b.pass}%` }} />
                      </div>
                      <span className="oh-barLabel">{b.label}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="oh-barLegend">
            <span className="oh-barLegendItem"><span className="oh-barLegendDot" style={{ background: '#17B08C' }} />정답 통과</span>
            <span className="oh-barLegendItem"><span className="oh-barLegendDot" style={{ background: '#FFB43C' }} />조작 실패</span>
            <span className="oh-barLegendItem"><span className="oh-barLegendDot" style={{ background: '#FF5A4D' }} />위험 차단</span>
          </div>
        </div>
        {/* reason bars */}
        <div className="oh-card">
          <h3 className="oh-barTitle">오답 원인 분포 (추정)</h3>
          <p className="oh-barSub" style={{ margin: '0 0 20px' }}>{d.periodLabel} estimated_reason 비율</p>
          <div className="oh-reasonList">
            {REASONS.map((r, i) => (
              <div key={r.label}>
                <div className="oh-reasonHead">
                  <span>{r.label}</span>
                  <span style={{ color: r.color }}>{d.r[i]}%</span>
                </div>
                <div className="oh-reasonTrack">
                  <div className="oh-reasonFill" style={{ width: `${d.r[i]}%`, background: r.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AGE CARDS */}
      <div className="oh-ageHead">
        <h2 className="oh-ageTitle">학년별 대시보드</h2>
        <button className="oh-moreBtn" onClick={() => setShowMore((s) => !s)}>
          <i className={showMore ? 'ph-bold ph-caret-up' : 'ph-bold ph-caret-down'} />
          {showMore ? '접기' : '4·5·6학년 더보기'}
        </button>
      </div>
      <div className="oh-gradeGrid">
        {gradeCards.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '28px 16px', textAlign: 'center', color: '#9AA0B0', fontSize: 14 }}>
            아직 학년별 학습 데이터가 없어요. 학생이 문제를 풀면 채워져요.
          </div>
        )}
        {gradeCards.map((g) => (
          <div className="oh-gradeCard" key={g.name} style={{ '--oh-grade-c': g.c } as CSSProperties}>
            <div className="oh-gradeHead">
              <span className="oh-gradeIcon" style={{ background: g.bg, color: g.c }}>
                <i className="ph-fill ph-graduation-cap" />
              </span>
              <div>
                <div className="oh-gradeName">{g.name}</div>
                <div className="oh-gradeCount">{g.count}</div>
              </div>
            </div>
            <div className="oh-gradeStats">
              <div className="oh-gradeStat"><span>정답률</span><b>{g.acc}</b></div>
              <div className="oh-gradeStat"><span>개념 오답 추정</span><b className="oh-wrong">{g.wrong}</b></div>
              <div className="oh-gradeStat"><span>평균 풀이 시간</span><b>{g.time}</b></div>
            </div>
          </div>
        ))}
      </div>

      {/* STUDENT TABLE + API */}
      <div className="oh-bottomGrid">
        <div className="oh-card">
          <div className="oh-tableHead">
            <h3 className="oh-cardTitle">학급별 요약</h3>
            <Link to={PATHS.ORG_CLASSES} className="oh-tableLink">전체 보기</Link>
          </div>
          <table className="oh-table">
            <thead>
              <tr>
                <th>학급 / 담당</th>
                <th>학생</th>
                <th>정답률</th>
                <th>조작 실패</th>
                <th>위험 신호</th>
              </tr>
            </thead>
            <tbody>
              {classRows.map((c) => (
                <tr key={c.name}>
                  <td>
                    <b>{c.name}</b> · {c.teacher}
                  </td>
                  <td>{c.count}</td>
                  <td>
                    <span className="oh-acc" style={{ color: c.accColor }}>{c.acc}</span>
                  </td>
                  <td>{c.fail}</td>
                  <td>
                    <span className={`oh-riskBadge ${c.risk === '낮음' ? 'oh-riskLow' : 'oh-riskWarn'}`}>{c.risk}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {classRows.length === 0 && (
            <div style={{ padding: '28px 16px', textAlign: 'center', color: '#9AA0B0', fontSize: 14 }}>
              아직 학급별 데이터가 없어요.
            </div>
          )}
        </div>
        <div className="oh-card">
          <h3 className="oh-apiTitle">API · 사이트 상태</h3>
          <div className="oh-apiStatus">
            <span className="oh-apiStatusDot" />
            <span className="oh-apiStatusText">{site.message}</span>
          </div>
          <div className="oh-apiList">
            <div className="oh-apiRow">
              <span className="oh-apiKey">사이트 키</span>
              <span className="oh-apiValMono">{site.siteKey}</span>
            </div>
            <div className="oh-apiRow">
              <span className="oh-apiKey">허용 도메인</span>
              <span className="oh-apiValDomain">{site.domain}</span>
            </div>
            <div className="oh-apiRow">
              <span className="oh-apiKey">{d.apiCallLabel}</span>
              <span className="oh-apiVal">{d.apiCallValue}</span>
            </div>
            <div className="oh-apiRow">
              <span className="oh-apiKey">오류율</span>
              <span className="oh-apiValGood">{site.errorRate}</span>
            </div>
            <div className="oh-apiRow">
              <span className="oh-apiKey">평균 응답 시간</span>
              <span className="oh-apiVal">{site.avgResponse}</span>
            </div>
            <div className="oh-apiRow">
              <span className="oh-apiKey">활성 API 키</span>
              <span className="oh-apiVal">{site.activeKeys}개</span>
            </div>
            {Object.keys(site.subjectUsage).length > 0 && (
              <div className="oh-apiRow">
                <span className="oh-apiKey">과목별 호출(이번 달)</span>
                <span className="oh-apiVal">
                  {Object.entries(site.subjectUsage)
                    .sort((a, b) => b[1] - a[1])
                    .map(([s, n]) => `${s} ${n.toLocaleString('ko-KR')}`)
                    .join(' · ')}
                </span>
              </div>
            )}
          </div>
          <Link className="oh-apiManageBtn" to={PATHS.ORG_API_KEYS}>
            <i className="ph-fill ph-gear" />API 키 관리
          </Link>
        </div>
      </div>
    </OrgLayout>
  );
}
