import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from '../../layouts/StudentLayout';
import DemoBadge from '../../components/common/DemoBadge';
import { PATHS } from '../../routes/paths';
import { useAuth } from '../../hooks/useAuth';
import { studentApi } from '../../api/students';
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
    { name: '끌어놓기 놀이', icon: 'ph-fill ph-hand-grabbing', color: '#17B08C', bg: '#DFF6ED', pct: 95, solved: 40, delta: 3 },
    { name: '한글 낱말 찾기', icon: 'ph-fill ph-text-aa', color: '#FF5A6E', bg: '#FFE3E9', pct: 88, solved: 50, delta: 2 },
    { name: '숫자 놀이터', icon: 'ph-fill ph-plus-minus', color: '#FF922E', bg: '#FFEDE0', pct: 76, solved: 45, delta: -4 },
    { name: '그림 찾기 퀴즈', icon: 'ph-fill ph-image', color: '#2E7BFF', bg: '#E6F0FF', pct: 64, solved: 38, delta: 6 },
    { name: '안전 지킴이', icon: 'ph-fill ph-shield-check', color: '#8B6BFF', bg: '#EDE6FF', pct: 32, solved: 25, delta: 12 },
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
    { title: '그림 찾기 퀴즈', sub: '고양이만 골라요 · 8문제', icon: 'ph-fill ph-image', color: '#2E7BFF', bg: '#E6F0FF', result: '정답률 86%', grade: 'ok', time: '방금 전' },
    { title: '끌어놓기 놀이', sub: '카드 옮기기 · 6문제', icon: 'ph-fill ph-hand-grabbing', color: '#17B08C', bg: '#DFF6ED', result: '정답률 100%', grade: 'ok', time: '오늘 오후 3:10' },
    { title: '숫자 놀이터', sub: '더하기·빼기 · 10문제', icon: 'ph-fill ph-plus-minus', color: '#FF922E', bg: '#FFEDE0', result: '정답률 72%', grade: 'mid', time: '어제' },
    { title: '한글 낱말 찾기', sub: '받침 완성 · 10문제', icon: 'ph-fill ph-text-aa', color: '#FF5A6E', bg: '#FFE3E9', result: '정답률 90%', grade: 'ok', time: '2일 전' },
  ],
  accLabels: ['6회 전', '5회 전', '4회 전', '3회 전', '2회 전', '최근'],
};

const GRID_LINES = [50, 60, 70, 80, 90, 100];

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

export default function MyRecords() {
  const { me } = useAuth();
  const [data, setData] = useState<RecordsData>(FALLBACK);
  const [demo, setDemo] = useState(false); // 시도 기록이 없어 전부 데모값이면 true
  const [subject, setSubject] = useState('전체');

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
    return () => {
      mounted = false;
    };
  }, []);

  const name = (me?.name ?? '하은').trim() || '하은';

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
      <div style={{ padding: '0 16px' }}><DemoBadge show={demo} variant="banner" /></div>
      {/* HEADER */}
      <section className="mr-section mr-header">
        <div className="mr-headrow">
          <div className="mr-headleft">
            <span className="mr-headicon">
              <i className="ph-fill ph-chart-line-up" />
            </span>
            <div>
              <h1 className="mr-title">{name}이의 성장 기록</h1>
              <p className="mr-subtitle">지금까지 얼마나 자랐는지 한눈에 볼 수 있어요</p>
            </div>
          </div>
          <button className="mr-reportbtn">
            <i className="ph-fill ph-download-simple" />
            리포트 저장
          </button>
        </div>
      </section>

      {/* STAT ROW */}
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
            <span className="mr-staticon mr-staticon-clock">
              <i className="ph-fill ph-clock-countdown" />
            </span>
            <div className="mr-statval">
              {data.stats.totalHours}
              <span className="mr-statunit">시간 {data.stats.totalMinutes}분</span>
            </div>
            <div className="mr-statlabel">총 학습 시간</div>
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

      {/* CHART + CALENDAR ROW */}
      <section className="mr-section mr-row2">
        {/* monthly bars */}
        <div className="mr-card">
          <div className="mr-weekhead">
            <h3 className="mr-h3">최근 4주 학습량</h3>
            <span className="mr-weekchip">꾸준히 오르는 중 📈</span>
          </div>
          <div className="mr-bars">
            {data.weeks.map((w, i) => (
              <div key={w.label} className="mr-barcol">
                <span className="mr-barval">{w.minutes}분</span>
                <div
                  className={`mr-bar${i === data.weeks.length - 1 ? ' mr-bar-now' : ''}`}
                  style={{ height: w.v + '%' }}
                />
                <span className="mr-barlabel">{w.label}</span>
              </div>
            ))}
          </div>
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

      {/* CATEGORY MASTERY + ACCURACY */}
      <section className="mr-section mr-row2">
        <div className="mr-card">
          <div className="mr-mhead">
            <h3 className="mr-h3">놀이별 실력</h3>
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
                  <line x1={padL} y1={Y(g)} x2={CW - padR} y2={Y(g)} stroke="#F1EAE1" strokeWidth={1} />
                  <text x={padL - 7} y={Y(g) + 3} textAnchor="end" fontSize={10} fontWeight={700} fill="#C2B9AD">
                    {g}
                  </text>
                </g>
              ))}
              <line
                x1={padL}
                y1={accAvgY}
                x2={CW - padR}
                y2={accAvgY}
                stroke="#FFB43C"
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
                      fill={last ? '#FF5A4D' : clr}
                    >
                      {v}%
                    </text>
                    <circle cx={X(i)} cy={Y(v)} r={last ? 6 : 4.5} fill={last ? '#FF5A4D' : clr} stroke="#fff" strokeWidth={2} />
                    <text
                      x={X(i)}
                      y={CH - 8}
                      textAnchor="middle"
                      fontSize={10.5}
                      fontWeight={700}
                      fill={last ? '#FF5A4D' : '#B0A79B'}
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
                <div className="mr-sessval" style={{ color: i === lastI ? '#FF5A4D' : clr }}>
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

      {/* RECENT ACTIVITY */}
      <section className="mr-section mr-recent">
        <div className="mr-card">
          <div className="mr-rhead">
            <h3 className="mr-h3">최근 학습 기록</h3>
            <Link to={PATHS.STUDENT_BADGES} className="mr-badgelink">
              획득 배지 보기 <i className="ph-bold ph-arrow-right" />
            </Link>
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
    </StudentLayout>
  );
}
