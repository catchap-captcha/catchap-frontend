import { useEffect, useState } from 'react';
import ParentLayout, { ParentBellLink } from '../../layouts/ParentLayout';
import DemoBadge from '../../components/common/DemoBadge';
import { parentApi } from '../../api/parents';
import { useToast } from '../../hooks/useToast';
import { dateSuffix, downloadCanvasPng } from '../../utils/download';
import { canvasToPdf } from '../../utils/pdf';
import { drawWeeklyReport } from '../../utils/reportImage';
import './ParentReports.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface SwItem {
  name: string;
  pct: string;
}

interface BarItem {
  label: string;
  v: string;
}

interface ChildData {
  id: string;
  name: string;
  initial: string;
  code: string;
  age: number;
  avatar: string;
  grade: string;
  percentile: string;
  strengths: SwItem[];
  weaknesses: SwItem[];
  strengthNote: string;
  weaknessNote: string;
  bars: BarItem[];
  trendDelta: string;
}

// TODO(api): parentApi.children()/childReport() 실패·로딩 시 원본 DCLogic CHILDREN 하드코딩 데이터 유지
const FALLBACK = {
  하은: {
    id: '하은',
    name: '하은',
    initial: '하',
    code: 'CAT-4823',
    age: 7,
    avatar: 'linear-gradient(135deg,#FFC24B,#FF8A5B)',
    grade: 'A',
    percentile: '12%',
    strengths: [
      { name: '국어', pct: '96%' },
      { name: '과학', pct: '92%' },
      { name: '생활', pct: '88%' },
    ],
    weaknesses: [
      { name: '수학', pct: '72%' },
      { name: '영어', pct: '78%' },
      { name: '사회', pct: '75%' },
    ],
    strengthNote: '국어·과학에서 꾸준히 높은 정답률을 유지하고 있어요. 새로운 도전 문제도 잘 소화해요.',
    weaknessNote: '수학에서 개념 오답이 반복돼요. 사과 세기처럼 눈으로 보는 활동이 도움돼요.',
    bars: [
      { label: '3주전', v: '80%' },
      { label: '2주전', v: '83%' },
      { label: '지난주', v: '85%' },
      { label: '이번주', v: '89%' },
    ],
    trendDelta: '+4%p 상승',
  } as ChildData,
  도윤: {
    id: '도윤',
    name: '도윤',
    initial: '도',
    code: 'CAT-5119',
    age: 5,
    avatar: 'linear-gradient(135deg,#8B6BFF,#B08AFF)',
    grade: 'B+',
    percentile: '28%',
    strengths: [
      { name: '생활', pct: '90%' },
      { name: '국어', pct: '84%' },
      { name: '과학', pct: '82%' },
    ],
    weaknesses: [
      { name: '수학', pct: '64%' },
      { name: '끌어놓기', pct: '70%' },
      { name: '영어', pct: '73%' },
    ],
    strengthNote: '생활·국어 그림 문제에 흥미가 높아요. 좋아하는 주제부터 시작하면 몰입도가 좋아요.',
    weaknessNote: '드래그 조작에서 목표 근처 실패가 잦아요. 큰 카드 모드로 연습하면 나아져요.',
    bars: [
      { label: '3주전', v: '70%' },
      { label: '2주전', v: '72%' },
      { label: '지난주', v: '74%' },
      { label: '이번주', v: '78%' },
    ],
    trendDelta: '+4%p 상승',
  } as ChildData,
};

const FALLBACK_LIST: ChildData[] = Object.values(FALLBACK);

const PERIODS = [
  { k: 'week', l: '주간' },
  { k: 'month', l: '월간' },
  { k: 'year', l: '연간' },
] as const;

const PERIOD_LABELS: Record<string, string> = {
  week: '6월 넷째 주 (6.22~6.28)',
  month: '2026년 6월',
  year: '2026년',
};

const TREND_SUBJECT_OPTIONS = [
  { value: 'all', label: '전체 과목' },
  { value: '국어', label: '국어' },
  { value: '영어', label: '영어' },
  { value: '수학', label: '수학' },
  { value: '과학', label: '과학' },
  { value: '사회', label: '사회' },
  { value: '생활', label: '생활' },
];

const KPIS_FALLBACK = [
  { icon: 'ph-fill ph-calendar-check', bg: '#FFEDE0', color: '#FF922E', value: '14회', label: '학습 횟수' },
  { icon: 'ph-fill ph-target', bg: '#E1F5EC', color: '#17B08C', value: '89%', label: '평균 정답률' },
  { icon: 'ph-fill ph-timer', bg: '#E6F0FF', color: '#2E7BFF', value: '12초', label: '평균 풀이 시간' },
  { icon: 'ph-fill ph-medal', bg: '#FFF3D6', color: '#F0A400', value: '3개', label: '새 배지' },
];

const REASONS_FALLBACK = [
  {
    tag: '조작 어려움',
    icon: 'ph-fill ph-hand-tap',
    bg: '#E6F0FF',
    color: '#2E7BFF',
    body: '개념은 이해했지만 정답 근처에서 놓쳐, 터치·드래그 조작에 살짝 어려움이 있었어요.',
  },
  {
    tag: '개념 혼동',
    icon: 'ph-fill ph-lightbulb',
    bg: '#FFE3E9',
    color: '#FF5A6E',
    body: '조작은 원활했지만 덧셈·뺄셈 개념에서 헷갈린 것으로 보여요. 함께 세어보면 좋아요.',
  },
  {
    tag: '선택지 혼동',
    icon: 'ph-fill ph-arrows-left-right',
    bg: '#EDE6FF',
    color: '#8B6BFF',
    body: '비슷한 낱말 그림 사이에서 여러 번 오갔어요. 헷갈리는 낱말을 함께 읽어보면 도움이 돼요.',
  },
];

const RECS_FALLBACK = [
  { icon: 'ph-fill ph-plus-minus', color: '#FF922E', text: '수학 놀이를 하루 5문제씩, 난이도는 조금 낮춰서' },
  { icon: 'ph-fill ph-hand-grabbing', color: '#17B08C', text: '큰 카드 모드로 드래그 연습 — 목표 칸을 크게' },
  { icon: 'ph-fill ph-book-open-text', color: '#8B6BFF', text: '헷갈린 낱말 5개를 소리 내어 함께 읽어보기' },
];

/* 원본 DCLogic 정답률 추이 상수 그대로 */
const AXIS = ['5주전', '4주전', '3주전', '2주전', '지난주', '이번주'];
const BASE = [80, 82, 83, 85, 87, 89];
const CBASE = [79, 80, 80, 81, 82, 82];
const SUBJ_LAST: Record<string, number> = { all: 89, 국어: 96, 영어: 78, 수학: 72, 과학: 92, 사회: 75, 생활: 88 };
const CLASS_LAST: Record<string, number> = { all: 82, 국어: 88, 영어: 74, 수학: 69, 과학: 85, 사회: 72, 생활: 83 };

const str = (v: any, fb: string) => (typeof v === 'string' && v ? v : fb);
const arr = <T,>(v: any, fb: T[]): T[] => (Array.isArray(v) && v.length ? (v as T[]) : fb);
const numArr = (v: any): number[] | null =>
  Array.isArray(v) && v.length && v.every((x: any) => typeof x === 'number') ? (v as number[]) : null;

export default function ParentReports() {
  const [chips, setChips] = useState<ChildData[] | null>(null); // null=로딩중, []=연결된 자녀 없음
  const [child, setChild] = useState('하은');
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('week');
  const [trendSubject, setTrendSubject] = useState('all');
  const [apiReport, setApiReport] = useState<any>(null);
  const [demo, setDemo] = useState(false); // 자녀 기간 실집계 없어 등급·차트가 데모값이면 true
  const { toast, flash } = useToast();

  // TODO(api): 자녀 목록 — 실패 시 원본 하드코딩 자녀 칩 유지
  useEffect(() => {
    let mounted = true;
    parentApi
      .children()
      .then((list: any) => {
        if (!mounted) return;
        // 연결된 자녀가 없으면 빈 배열 — 데모 자녀·리포트를 실데이터처럼 보여주지 않는다.
        if (!Array.isArray(list) || !list.length) {
          setChips([]);
          return;
        }
        // API: [{id, nickname, age, status, student_code, class_name, ...}] — name/code 대신 nickname/student_code
        setChips(
          list.map((c: any, i: number) => {
            const name = str(c?.nickname ?? c?.name, `자녀${i + 1}`);
            const fb =
              (FALLBACK as Record<string, ChildData>)[name] ?? FALLBACK_LIST[i % FALLBACK_LIST.length];
            return {
              ...fb,
              id: String(c?.id ?? c?.child_id ?? name),
              name,
              initial: str(c?.initial, name.charAt(0)),
              code: str(c?.student_code ?? c?.code, fb.code),
              age: typeof c?.age === 'number' ? c.age : fb.age,
              avatar: str(c?.avatar, fb.avatar),
            };
          }),
        );
      })
      .catch(() => {
        if (mounted) setChips([]); // 실패해도 데모 자녀는 안 만든다
      });
    return () => {
      mounted = false;
    };
  }, []);

  const loaded = chips !== null;
  const chipList = chips ?? [];
  const cur = chipList.find((c) => c.name === child) ?? chipList[0] ?? FALLBACK.하은;

  // TODO(api): 상세 리포트 — 실패·로딩 시 FALLBACK 유지(화면 골격 보존)
  useEffect(() => {
    let mounted = true;
    // 실 자녀(UUID)가 로드되기 전 FALLBACK id로 호출하면 403 → 실 id일 때만 호출
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(cur.id)) return;
    setApiReport(null);
    parentApi
      .childReport(cur.id, period, trendSubject === 'all' ? undefined : trendSubject)
      .then((r: any) => {
        if (mounted && r && typeof r === 'object') {
          setApiReport(r);
          setDemo(!!r.demo);
        }
      })
      .catch(() => {
        // TODO(api): 백엔드 미구현/실패 시 FALLBACK 유지
      });
    return () => {
      mounted = false;
    };
  }, [cur.id, period, trendSubject]);

  /* === API 응답(snake_case) → 화면 상태 매핑 — 실패 시 FALLBACK 전체 유지 === */
  const r = apiReport ?? {};
  const grade = str(r.grade, cur.grade);
  const percentile = str(r.percentile, cur.percentile);
  // strengths/weaknesses: API [{pct:'90%',name}] — SwItem과 동일 형태
  const strengths = arr<SwItem>(r.strengths, cur.strengths);
  const weaknesses = arr<SwItem>(r.weaknesses, cur.weaknesses);
  const strengthNote = str(r.strength_note ?? r.strengthNote, cur.strengthNote);
  const weaknessNote = str(r.weakness_note ?? r.weaknessNote, cur.weaknessNote);
  const trendDelta = str(r.trend_delta ?? r.trendDelta, cur.trendDelta);
  // KPI: API는 {icon,label,value}만 제공 — bg/color 등 디자인 값은 슬롯별 원본 유지
  const kpis = arr<any>(r.kpis, KPIS_FALLBACK).map((k: any, i: number) => {
    const fb = KPIS_FALLBACK[i % KPIS_FALLBACK.length];
    return {
      icon: str(k?.icon, fb.icon),
      bg: str(k?.bg, fb.bg),
      color: str(k?.color, fb.color),
      value: str(k?.value, fb.value),
      label: str(k?.label, fb.label),
    };
  });
  // 이유 카드: API는 {tag,body,icon}만 제공 — bg/color는 슬롯별 원본 유지
  const reasons = arr<any>(r.reasons, REASONS_FALLBACK).map((rs: any, i: number) => {
    const fb = REASONS_FALLBACK[i % REASONS_FALLBACK.length];
    return {
      tag: str(rs?.tag, fb.tag),
      icon: str(rs?.icon, fb.icon),
      bg: str(rs?.bg, fb.bg),
      color: str(rs?.color, fb.color),
      body: str(rs?.body, fb.body),
    };
  });
  // 추천: API 키는 recommendations([{icon,text}]) — color는 슬롯별 원본 유지
  const recs = arr<any>(r.recommendations ?? r.recs, RECS_FALLBACK).map((rc: any, i: number) => {
    const fb = RECS_FALLBACK[i % RECS_FALLBACK.length];
    return {
      icon: str(rc?.icon, fb.icon),
      color: str(rc?.color, fb.color),
      text: str(rc?.text, fb.text),
    };
  });
  const orgLabel = str(r.org_label ?? r.orgLabel, '햇살초등학교 1-2반');
  const periodLabel = str(r.period_label ?? r.periodLabel, PERIOD_LABELS[period]);

  /* 기간별 막대 — API bars는 v가 숫자(70) → '70%' 문자열로 변환. 원본 renderVals 그대로(마지막 막대만 진한 gradient) */
  const barsSrc = arr<any>(r.bars, cur.bars).map(
    (b: any): BarItem => ({
      label: str(b?.label, ''),
      v: typeof b?.v === 'number' ? `${b.v}%` : str(b?.v, ''),
    }),
  );
  const bars = barsSrc.map((b, i) => ({
    ...b,
    h: b.v,
    bg:
      i === barsSrc.length - 1
        ? 'linear-gradient(180deg,#FF8A5B,#FF5A4D)'
        : 'linear-gradient(180deg,#FFD9C9,#FFB39E)',
  }));

  /* === 정답률 추이 — 원본 DCLogic 좌표 계산식 그대로 === */
  const ts = trendSubject;
  const clampV = (v: number) => Math.max(45, Math.min(99, v));
  const shift = (SUBJ_LAST[ts] != null ? SUBJ_LAST[ts] : 89) - BASE[BASE.length - 1];
  const cshift = (CLASS_LAST[ts] != null ? CLASS_LAST[ts] : 82) - CBASE[CBASE.length - 1];
  // API 키는 trend.class_series (classSeries는 구버전 호환)
  const apiSeries = numArr(r.trend?.series);
  const apiClassSeries = numArr(r.trend?.class_series ?? r.trend?.classSeries);
  const useApiTrend = !!(
    apiSeries &&
    apiSeries.length >= 2 &&
    apiClassSeries &&
    apiClassSeries.length === apiSeries.length
  );
  const series = useApiTrend && apiSeries ? apiSeries : BASE.map((v) => clampV(v + shift));
  const cseries = useApiTrend && apiClassSeries ? apiClassSeries : CBASE.map((v) => clampV(v + cshift));
  const n = series.length;
  const axis =
    useApiTrend && Array.isArray(r.trend?.axis) && r.trend.axis.length === n
      ? (r.trend.axis as string[]).map(String)
      : AXIS;
  // y축 50~100, 좌표는 플롯 영역(40~200) 안으로 클램프 — 낮은 값이 카드 밖으로 그려지지 않게
  const mapY = (v: number) => Math.max(40, Math.min(200, Math.round(200 - (v - 50) * 3.2)));
  const xAt = (i: number) => Math.round(48 + i * (516 / (n - 1)));
  const trendTicks = [100, 90, 80, 70, 60, 50].map((v) => {
    const y = mapY(v);
    return { y, ty: y + 4, label: String(v) };
  });
  const trendPts = series.map((v, i) => xAt(i) + ',' + mapY(v)).join(' ');
  const trendArea = trendPts + ' ' + xAt(n - 1) + ',200 ' + xAt(0) + ',200';
  const trendClassPts = cseries.map((v, i) => xAt(i) + ',' + mapY(v)).join(' ');
  const trendDots = series.map((v, i) => ({ cx: xAt(i), cy: mapY(v), label: v + '%', ly: Math.max(mapY(v) - 11, 11) }));
  const trendAvgVal =
    useApiTrend && typeof r.trend?.avg === 'number'
      ? Math.round(r.trend.avg)
      : Math.round(series.reduce((a, b) => a + b, 0) / n);
  const trendAvg = trendAvgVal + '%';
  const trendAvgY = mapY(trendAvgVal);
  const latest = series[n - 1];
  const first = series[0];
  const delta = latest - first;
  const hi = Math.max(...series);
  const lo = Math.min(...series);
  const classLatest = cseries[n - 1];
  const vsClass = latest - classLatest;
  const sgn = (x: number) => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x);
  const subjLabel = ts === 'all' ? '전체 과목' : ts;
  const trendStats = [
    { label: '이번주 정답률', value: latest + '%', color: '#FF5A4D', icon: 'ph-fill ph-target' },
    {
      label: '6주 변화',
      value: sgn(delta) + '%p',
      color: delta >= 0 ? '#17B08C' : '#E0475E',
      icon: delta >= 0 ? 'ph-fill ph-trend-up' : 'ph-fill ph-trend-down',
    },
    { label: '최고 / 최저', value: hi + ' / ' + lo + '%', color: '#2E7BFF', icon: 'ph-fill ph-arrows-down-up' },
    {
      label: '반 평균 대비',
      value: sgn(vsClass) + '%p',
      color: vsClass >= 0 ? '#17B08C' : '#E0475E',
      icon: 'ph-fill ph-users-three',
    },
  ];
  const trendNote = str(
    r.trendNote,
    subjLabel +
      '은(는) 최근 6주간 ' +
      (delta >= 0 ? sgn(delta) + '%p 오르며 꾸준히 개선되고 있어요' : Math.abs(delta) + '%p 낮아져 조금 더 관심이 필요해요') +
      '. 반 평균(' +
      classLatest +
      '%)보다 ' +
      (vsClass >= 0 ? sgn(vsClass) + '%p 높아요' : Math.abs(vsClass) + '%p 낮아요') +
      '.',
  );

  const download = async (format: 'pdf' | 'png' = 'pdf') => {
    // 실파일 저장: 리포트 화면 데이터를 그려 PDF/PNG로 다운로드
    const pctNum = (v: string) => {
      const m = /(\d+)/.exec(String(v));
      return m ? Number(m[1]) : 0;
    };
    const canvas = drawWeeklyReport({
      childName: cur.name,
      periodLabel: `${subjLabel} 리포트 · ${grade} · ${percentile}`,
      stats: kpis.map((k: any) => ({ label: k.label, value: k.value })),
      strengths: strengths.map((s: any) => ({ label: s.name ?? s.label, pct: pctNum(s.pct) })),
      weaknesses: weaknesses.map((s: any) => ({ label: s.name ?? s.label, pct: pctNum(s.pct) })),
      recommends: recs.map((rc: any) => rc.text),
    });
    try {
      // await 필수 — 실패가 성공 토스트로 가려지지 않게(가짜 성공 금지)
      if (format === 'pdf') await canvasToPdf(`${cur.name}_리포트_${dateSuffix()}.pdf`, canvas);
      else downloadCanvasPng(`${cur.name}_리포트_${dateSuffix()}.png`, canvas);
      flash(`${cur.name} 리포트 ${format === 'pdf' ? 'PDF' : '이미지'}를 저장했어요`);
    } catch {
      flash('리포트 저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
    }
  };

  // 로딩 중에는 데모(FALLBACK) 리포트가 잠깐 새지 않도록 로딩 상태만 표시
  if (!loaded) {
    return (
      <ParentLayout className="prt-bg" bell={<ParentBellLink />}>
        <div className="prt-container">
          <div className="prt-empty"><p className="prt-empty-text">불러오는 중…</p></div>
        </div>
      </ParentLayout>
    );
  }

  // 연결된 자녀가 없으면 데모 리포트 대신 빈 상태 (미연동 시 데모값 노출 방지)
  if (loaded && chipList.length === 0) {
    return (
      <ParentLayout className="prt-bg" bell={<ParentBellLink />}>
        <div className="prt-container">
          <div className="prt-empty">
            <div className="prt-empty-ic"><i className="ph-fill ph-file-dashed" /></div>
            <h2 className="prt-empty-title">아직 볼 리포트가 없어요</h2>
            <p className="prt-empty-text">
              자녀를 연결하면 주간·월간 학습 리포트를 볼 수 있어요. 홈에서 <b>자녀 연결</b>을 먼저 해주세요.
            </p>
          </div>
        </div>
      </ParentLayout>
    );
  }

  return (
    <ParentLayout className="prt-bg" bell={<ParentBellLink />}>
      <div className="prt-container">
        <DemoBadge show={demo} variant="banner" />
        {/* CHILD + PERIOD BAR */}
        <div className="prt-topbar">
          <div className="prt-top-left">
            <span className="prt-top-label">리포트 대상</span>
            <div className="prt-chips">
              {chipList.map((c) => {
                const on = c.name === cur.name;
                return (
                  <button
                    key={c.name}
                    onClick={() => setChild(c.name)}
                    className={'prt-chip' + (on ? ' prt-chip-on' : '')}
                  >
                    <span className="prt-chip-avatar">{c.initial}</span>
                    <span className="prt-chip-label">{c.name} · {c.age}세</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="prt-top-right">
            <div className="prt-period-box">
              {PERIODS.map((p) => (
                <button
                  key={p.k}
                  onClick={() => setPeriod(p.k)}
                  className={'prt-period-btn' + (period === p.k ? ' prt-period-on' : '')}
                >
                  {p.l}
                </button>
              ))}
            </div>
            <button onClick={() => download('pdf')} className="prt-dl-btn">
              <i className={toast ? 'ph-fill ph-check' : 'ph-fill ph-file-pdf'} />
              {toast ? '저장됨' : 'PDF로 저장'}
            </button>
            <button onClick={() => download('png')} className="prt-dl-btn" style={{ background: '#fff', color: '#FF5A4D', border: '1.5px solid #FFD9CC' }}>
              <i className="ph-fill ph-image" />
              이미지
            </button>
          </div>
        </div>

        {/* REPORT SHEET */}
        <div className="prt-sheet">
          {/* report header */}
          <div className="prt-head">
            <div className="prt-head-left">
              <span className="prt-hero-avatar" style={{ background: cur.avatar }}>
                {cur.initial}
              </span>
              <div>
                <div className="prt-title-row">
                  <h1 className="prt-title">{cur.name} 학습 리포트</h1>
                  <span className="prt-code">{cur.code}</span>
                </div>
                <p className="prt-head-sub">
                  {cur.age}세 · {orgLabel} · {periodLabel}
                </p>
              </div>
            </div>
            <div className="prt-head-right">
              <div className="prt-grade-label">종합 성취도</div>
              <div className="prt-grade">{grade}</div>
              <div className="prt-percentile">상위 {percentile}</div>
            </div>
          </div>

          {/* KPI strip */}
          <div className="prt-kpis">
            {kpis.map((k) => (
              <div key={k.label} className="prt-kpi">
                <span className="prt-kpi-icon" style={{ background: k.bg, color: k.color }}>
                  <i className={k.icon} />
                </span>
                <div className="prt-kpi-value">{k.value}</div>
                <div className="prt-kpi-label">{k.label}</div>
              </div>
            ))}
          </div>

          {/* STRENGTHS / WEAKNESS */}
          <div className="prt-sw-grid">
            <div className="prt-sw-card prt-sw-good">
              <div className="prt-sw-head">
                <span className="prt-sw-icon">
                  <i className="ph-fill ph-thumbs-up" />
                </span>
                <h3 className="prt-sw-title">강점</h3>
              </div>
              <div className="prt-sw-list">
                {strengths.map((s) => (
                  <div key={s.name}>
                    <div className="prt-sw-row-top">
                      <span>{s.name}</span>
                      <span className="prt-sw-pct">{s.pct}</span>
                    </div>
                    <div className="prt-sw-track">
                      <div className="prt-sw-fill" style={{ width: s.pct }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="prt-sw-note">
                <i className="ph-fill ph-sparkle" />
                <span>{strengthNote}</span>
              </div>
            </div>
            <div className="prt-sw-card prt-sw-warn">
              <div className="prt-sw-head">
                <span className="prt-sw-icon">
                  <i className="ph-fill ph-sparkle" />
                </span>
                <h3 className="prt-sw-title">취약점</h3>
              </div>
              <div className="prt-sw-list">
                {weaknesses.map((w) => (
                  <div key={w.name}>
                    <div className="prt-sw-row-top">
                      <span>{w.name}</span>
                      <span className="prt-sw-pct">{w.pct}</span>
                    </div>
                    <div className="prt-sw-track">
                      <div className="prt-sw-fill" style={{ width: w.pct }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="prt-sw-note">
                <i className="ph-fill ph-lightbulb" />
                <span>{weaknessNote}</span>
              </div>
            </div>
          </div>

          {/* subject accuracy trend */}
          <div className="prt-trend">
            <div className="prt-trend-head">
              <div className="prt-trend-title-wrap">
                <span className="prt-trend-icon">
                  <i className="ph-fill ph-chart-line-up" />
                </span>
                <div>
                  <h3 className="prt-trend-title">정답률 추이</h3>
                  <p className="prt-trend-sub">최근 6주 · {subjLabel} · 자녀 vs 반 평균</p>
                </div>
              </div>
              <div className="prt-trend-selwrap">
                <select
                  value={trendSubject}
                  onChange={(e) => setTrendSubject(e.target.value)}
                  className="prt-subject-select"
                >
                  {TREND_SUBJECT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="prt-legend">
              <span className="prt-legend-item prt-legend-child">
                <span className="prt-legend-line" />
                {cur.name} 정답률
              </span>
              <span className="prt-legend-item prt-legend-class">
                <span className="prt-legend-dash" />반 평균
              </span>
              <span className="prt-legend-item prt-legend-avg">
                <span className="prt-legend-avgdash" />6주 평균 {trendAvg}
              </span>
            </div>
            <svg viewBox="0 0 600 220" className="prt-chart">
              <defs>
                <linearGradient id="ccTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF5A4D" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#FF5A4D" stopOpacity="0" />
                </linearGradient>
              </defs>
              {trendTicks.map((t) => (
                <g key={t.label}>
                  <line x1="48" y1={t.y} x2="584" y2={t.y} stroke="#F4EEE7" strokeWidth="1" />
                  <text x="38" y={t.ty} textAnchor="end" fontSize="11" fontWeight="700" fill="#C2B9AD">
                    {t.label}
                  </text>
                </g>
              ))}
              <line
                x1="48"
                y1={trendAvgY}
                x2="584"
                y2={trendAvgY}
                stroke="#17B08C"
                strokeWidth="1.5"
                strokeDasharray="5 5"
                opacity="0.55"
              />
              {/* 평균 수치는 범례(6주 평균)에 표시 — 차트 안 텍스트는 점 라벨과 겹쳐 제거 */}
              <polygon points={trendArea} fill="url(#ccTrendFill)" />
              <polyline
                points={trendClassPts}
                fill="none"
                stroke="#B7BBCB"
                strokeWidth="2.5"
                strokeDasharray="6 5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points={trendPts}
                fill="none"
                stroke="#FF5A4D"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {trendDots.map((p, i) => (
                <g key={i}>
                  <circle cx={p.cx} cy={p.cy} r="4.5" fill="#fff" stroke="#FF5A4D" strokeWidth="3" />
                  <text x={p.cx} y={p.ly} textAnchor="middle" fontSize="11" fontWeight="800" fill="#E0574B">
                    {p.label}
                  </text>
                </g>
              ))}
            </svg>
            <div className="prt-axis">
              {axis.map((a) => (
                <span key={a} className="prt-axis-item">
                  {a}
                </span>
              ))}
            </div>
            <div className="prt-trend-stats">
              {trendStats.map((s) => (
                <div key={s.label} className="prt-tstat">
                  <div className="prt-tstat-head">
                    <i className={s.icon} style={{ color: s.color }} />
                    <span>{s.label}</span>
                  </div>
                  <div className="prt-tstat-value" style={{ color: s.color }}>
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
            <div className="prt-trend-note">
              <i className="ph-fill ph-sparkle" />
              <span>{trendNote}</span>
            </div>
          </div>

          {/* reason cards */}
          <h2 className="prt-h2">틀린 이유 살펴보기</h2>
          <p className="prt-h2-sub">쉬운 말로 알려드리는 참고용 추정이에요. 확정 진단이 아니에요.</p>
          <div className="prt-reasons">
            {reasons.map((rs) => (
              <div key={rs.tag} className="prt-reason">
                <span className="prt-reason-tag" style={{ background: rs.bg, color: rs.color }}>
                  <i className={rs.icon} />
                  {rs.tag}
                </span>
                <p className="prt-reason-body">{rs.body}</p>
              </div>
            ))}
          </div>

          {/* weekly trend */}
          <div className="prt-weekly">
            <div className="prt-weekly-head">
              <h3 className="prt-weekly-title">기간별 정답률 추이</h3>
              <span className="prt-weekly-delta">{trendDelta}</span>
            </div>
            <div className="prt-bars">
              {bars.map((b) => (
                <div key={b.label} className="prt-bar-col">
                  <span className="prt-bar-value">{b.v}</span>
                  <div className="prt-bar" style={{ background: b.bg, height: b.h }} />
                  <span className="prt-bar-label">{b.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* recommendation */}
          <div className="prt-rec">
            <div className="prt-rec-head">
              <span className="prt-rec-icon">
                <i className="ph-fill ph-sparkle" />
              </span>
              <div>
                <h3 className="prt-rec-title">AI 티칭 추천</h3>
                <p className="prt-rec-sub">AI가 자녀 학습 데이터를 분석해 추천해요</p>
              </div>
            </div>
            <div className="prt-rec-list">
              {recs.map((rc) => (
                <div key={rc.text} className="prt-rec-item">
                  <i className={rc.icon} style={{ color: rc.color }} />
                  <span>{rc.text}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="prt-footnote">
            본 리포트는 연결된 자녀의 요약 정보만 담고 있어요 · 원본 행동 데이터와 다른 학생 정보는 제공되지 않습니다.
          </p>
        </div>
      </div>

      {/* DOWNLOAD TOAST */}
      {toast && (
        <div className="prt-toast">
          <i className="ph-fill ph-check-circle" />
          <span>{toast}</span>
        </div>
      )}
    </ParentLayout>
  );
}
