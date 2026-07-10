/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import CountUp from '../../components/motion/CountUp';
import DemoBadge from '../../components/common/DemoBadge';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { useAuth } from '../../hooks/useAuth';
import { teacherApi } from '../../api/teacher';
import { dateSuffix, downloadCSV } from '../../utils/download';
import { tableToPdf } from '../../utils/pdf';
import TeacherLayout from '../../layouts/TeacherLayout';
import './TeacherHome.css';

/** handoff `CatChap 선생님.dc.html` 포팅 — 우리 학급 요약 대시보드 */

interface ThBar {
  day: string;
  n: number;
  today?: boolean;
}

interface ThGameBar {
  label: string;
  pct: string;
  color: string;
}

interface ThAttention {
  name: string;
  initial: string;
  avatarBg: string;
  note: string;
  tag: string;
  tagBg: string;
  tagColor: string;
}

interface ThTodo {
  label: string;
  done: boolean;
}

interface ThAssignment {
  title: string;
  done: number;
  total: number;
}

interface ThDashboard {
  teacherName: string;
  /** API class_name — 사이드바 profileSub용 (FALLBACK에는 없음 → 레이아웃 기본값 유지) */
  className?: string;
  classes: string[];
  studentsTotal: number;
  doneToday: number;
  donePct: string;
  avgAcc: number;
  accDelta: string;
  attentionCount: number;
  weekBadge: string;
  barMax: number;
  barData: ThBar[];
  gameBars: ThGameBar[];
  attention: ThAttention[];
  todos: ThTodo[];
  aiSummary: string;
  assignment: ThAssignment;
}

// TODO(api): teacherApi.dashboard 실패/로딩 시 원본 DCLogic 하드코딩 데이터 유지
const FALLBACK: ThDashboard = {
  teacherName: '이수진',
  classes: ['1-2반'],
  studentsTotal: 22,
  doneToday: 18,
  donePct: '82%',
  avgAcc: 90,
  accDelta: '+3%p',
  attentionCount: 3,
  weekBadge: '지난주보다 +9%',
  barMax: 22,
  barData: [
    { day: '월', n: 16 },
    { day: '화', n: 19 },
    { day: '수', n: 14 },
    { day: '목', n: 20 },
    { day: '금', n: 18, today: true },
    { day: '토', n: 9 },
    { day: '일', n: 6 },
  ],
  gameBars: [
    { label: '한글 낱말 찾기', pct: '94%', color: '#FF5A6E' },
    { label: '그림 찾기 퀴즈', pct: '92%', color: '#2E7BFF' },
    { label: '안전 지킴이', pct: '88%', color: '#8B6BFF' },
    { label: '끌어놓기 놀이', pct: '79%', color: '#17B08C' },
    { label: '숫자 놀이터', pct: '71%', color: '#FF922E' },
  ],
  attention: [
    {
      name: '박도윤',
      initial: '박',
      avatarBg: 'linear-gradient(135deg,#FFC24B,#FF8A5B)',
      note: '숫자 놀이터 정답률 62% · 개념 오답 추정',
      tag: '숫자 도움',
      tagBg: '#FFF3E6',
      tagColor: '#C98A00',
    },
    {
      name: '최서아',
      initial: '최',
      avatarBg: 'linear-gradient(135deg,#8B6BFF,#B08AFF)',
      note: '3일 연속 학습 안 함 · 참여 독려 필요',
      tag: '참여 저조',
      tagBg: '#FFE3E9',
      tagColor: '#E0475E',
    },
    {
      name: '김하람',
      initial: '김',
      avatarBg: 'linear-gradient(135deg,#4AA6FF,#2E7BFF)',
      note: '드래그 near_miss 잦음 · 조작 어려움 추정',
      tag: '조작 도움',
      tagBg: '#E6F0FF',
      tagColor: '#2E7BFF',
    },
  ],
  todos: [
    { label: '오늘의 그림 찾기 배정', done: true },
    { label: '주의 학생 3명 개별 문제 배정', done: false },
    { label: '가정 통신문 발송 (숫자 놀이)', done: false },
  ],
  aiSummary:
    '이번 주 반 전체는 낱말·그림에 강해요. 숫자 놀이터에서 개념 오답이 늘어, 함께 세어보는 활동을 추천해요.',
  // 사이드바 '이번 주 과제' 카드 — 레이아웃 기본 문구와 동일한 시드값 (로딩/실패 시 유지)
  assignment: { title: '숫자 놀이터 배정', done: 16, total: 22 },
};

/**
 * API 응답(snake_case) → 화면 ThDashboard 매핑.
 * GET /teacher/dashboard: { teacher_name, class_name, kpis{total_students, today_done,
 * today_done_pct, avg_accuracy, avg_accuracy_delta, need_help}, bar_data[{n,day,today?}],
 * game_bars[{pct:number,color,label}], attention[{tag,name,note}], todos[{icon,title,done}],
 * assignment{title,done,total}, ai_summary, participation_delta }
 */
function mapDashboard(res: any): Partial<ThDashboard> | null {
  if (!res || typeof res !== 'object') return null;
  const src = res.data ?? res;
  if (!src || typeof src !== 'object') return null;
  const out: Partial<ThDashboard> = {};

  const k = src.kpis;
  if (k && typeof k === 'object') {
    if (k.total_students != null) {
      out.studentsTotal = Number(k.total_students);
      // 디자인상 막대 최대값 = 반 정원
      out.barMax = Number(k.total_students) || FALLBACK.barMax;
    }
    if (k.today_done != null) out.doneToday = Number(k.today_done);
    if (k.today_done_pct != null) out.donePct = String(k.today_done_pct);
    if (k.avg_accuracy != null) out.avgAcc = Number(k.avg_accuracy);
    if (k.avg_accuracy_delta != null) out.accDelta = String(k.avg_accuracy_delta);
    if (k.need_help != null) out.attentionCount = Number(k.need_help);
  }

  if (src.teacher_name) out.teacherName = String(src.teacher_name);
  if (src.class_name) {
    out.className = String(src.class_name);
    out.classes = [String(src.class_name)];
  }
  if (src.participation_delta != null) out.weekBadge = '지난주보다 ' + src.participation_delta;
  if (src.ai_summary) out.aiSummary = String(src.ai_summary);

  if (Array.isArray(src.bar_data) && src.bar_data.length) {
    out.barData = src.bar_data.map((b: any): ThBar => ({
      day: String(b.day ?? ''),
      n: Number(b.n ?? 0),
      ...(b.today ? { today: true } : {}),
    }));
  }

  if (Array.isArray(src.game_bars) && src.game_bars.length) {
    out.gameBars = src.game_bars.map((g: any): ThGameBar => ({
      label: String(g.label ?? ''),
      // API는 숫자(94) — 화면은 텍스트/CSS width 겸용 '94%'
      pct: typeof g.pct === 'number' ? g.pct + '%' : String(g.pct ?? ''),
      color: String(g.color ?? '#8B6BFF'),
    }));
  }

  if (Array.isArray(src.attention) && src.attention.length) {
    out.attention = src.attention.map((a: any, i: number): ThAttention => {
      const name = String(a.name ?? '');
      // API에는 색상 정보가 없어 FALLBACK 팔레트 재사용(태그 일치 우선, 아니면 순환)
      const pal =
        FALLBACK.attention.find((f) => f.tag === a.tag) ??
        FALLBACK.attention[i % FALLBACK.attention.length];
      return {
        name,
        initial: [...name][0] ?? '냥',
        avatarBg: pal.avatarBg,
        note: String(a.note ?? ''),
        tag: String(a.tag ?? ''),
        tagBg: pal.tagBg,
        tagColor: pal.tagColor,
      };
    });
  }

  if (Array.isArray(src.todos) && src.todos.length) {
    out.todos = src.todos.map((t: any): ThTodo => ({
      label: String(t.title ?? t.label ?? ''),
      done: !!t.done,
    }));
  }

  const asg = src.assignment;
  if (asg && typeof asg === 'object' && asg.title != null) {
    out.assignment = {
      title: String(asg.title),
      done: Number(asg.done ?? FALLBACK.assignment.done),
      total: Number(asg.total ?? FALLBACK.assignment.total),
    };
  }

  return Object.keys(out).length ? out : null;
}

export default function TeacherHome() {
  const { me } = useAuth();
  const [data, setData] = useState<ThDashboard>(FALLBACK);
  const [demo, setDemo] = useState(false); // 실 시도가 없어 그래프·KPI가 데모값이면 true
  const [cls, setCls] = useState('1-2');
  const name = me?.name || data.teacherName || '이수진';

  useEffect(() => {
    let on = true;
    teacherApi
      .dashboard()
      .then((res: any) => {
        if (!on) return;
        setDemo(!!res?.demo);
        const mapped = mapDashboard(res);
        // 성공 시 API에 존재하는 필드만 덮어쓰기 — 나머지는 FALLBACK 유지
        if (mapped) setData((d) => ({ ...d, ...mapped }));
      })
      .catch(() => {
        // TODO(api): 실패 시 FALLBACK 유지
      });
    return () => {
      on = false;
    };
  }, []);

  // 원본 DCLogic classChips 활성 판정 로직 그대로
  const classChips = data.classes.map((label) => ({
    label,
    on: label === cls + '반' || label.startsWith(cls),
  }));

  // 원본 DCLogic bars 파생 로직 그대로 (max=22)
  const bars = data.barData.map((b) => ({
    ...b,
    h: Math.round((b.n / data.barMax) * 100) + '%',
    bg: b.today
      ? 'linear-gradient(180deg,#FF8A5B,#FF5A4D)'
      : 'linear-gradient(180deg,#CFC7F0,#B0A2E8)',
    dayColor: b.today ? '#FF5A4D' : '#8F8CA6',
  }));

  // 사이드바 '이번 주 과제' 카드 — 레이아웃 기본 마크업과 동일, 값만 API 데이터
  const asg = data.assignment;
  const asgPct = asg.total > 0 ? Math.round((asg.done / asg.total) * 100) : 0;

  return (
    <TeacherLayout
      profileSub={data.className ? `${data.className} 담임` : undefined}
      bottomCard={
        <>
          <div className="tl-task-title">이번 주 과제</div>
          <div className="tl-task-desc">{`${asg.title} · ${asg.total}명 중 ${asg.done}명 완료`}</div>
          <div className="tl-task-bar">
            {/* inline width가 .tl-task-fill의 고정 width:73%를 덮어씀 (시드값도 73%) */}
            <div className="tl-task-fill" style={{ width: `${asgPct}%` }} />
          </div>
        </>
      }
    >
      <main className="th-main">
        <DemoBadge show={demo} variant="banner" />
        {/* HEADER */}
        <div className="th-header">
          <div>
            <h1 className="th-title">안녕하세요, {name} 선생님 👋</h1>
            <p className="th-subtitle">
              {data.classes[0] ?? '1-2반'} · 오늘 {data.studentsTotal}명 중 <b>{data.doneToday}명</b>이 학습을 마쳤어요
            </p>
          </div>
          <div className="th-header-actions">
            {(() => {
              // 학급 요약 리포트 — 오늘 현황 + 요일별 + 놀이별 + 관심 학생 (CSV/PDF 공용)
              const exportRows = [
                ['[오늘 현황]'],
                ['전체 학생', data.studentsTotal],
                ['오늘 학습 완료', data.doneToday],
                ['평균 정답률(%)', data.avgAcc],
                ['관심 필요 학생', data.attentionCount],
                [],
                ['[요일별 학습 인원]'],
                ['요일', '인원'],
                ...data.barData.map((b) => [b.day, b.n]),
                [],
                ['[놀이별 정답률]'],
                ['놀이', '정답률'],
                ...data.gameBars.map((g) => [g.label, g.pct]),
                [],
                ['[관심이 필요한 학생]'],
                ['이름', '메모'],
                ...data.attention.map((a) => [a.name, a.note]),
              ];
              const cls = data.classes[0] ?? '우리반';
              return (
                <>
                  <button className="th-export-btn" onClick={() => downloadCSV(`${cls}_학급리포트_${dateSuffix()}.csv`, exportRows)}>
                    <i className="ph-fill ph-export" />
                    CSV
                  </button>
                  <button className="th-export-btn" onClick={() => tableToPdf(`${cls}_학급리포트_${dateSuffix()}.pdf`, `${cls} 학급 리포트`, exportRows).catch((e) => console.error('PDF 저장 실패', e))}>
                    <i className="ph-fill ph-file-pdf" />
                    PDF
                  </button>
                </>
              );
            })()}
          </div>
        </div>

        {/* CLASS SWITCHER */}
        <div className="th-class-row">
          <span className="th-class-label">학급</span>
          {classChips.map((ch) => (
            <button
              key={ch.label}
              className={'th-chip ' + (ch.on ? 'th-chip-on' : 'th-chip-off')}
              onClick={() => setCls(ch.label.replace('반', ''))}
            >
              {ch.label}
            </button>
          ))}
        </div>

        {/* KPI ROW */}
        <div className="th-kpi-grid">
          <div className="th-kpi-card">
            <div className="th-kpi-top">
              <span className="th-kpi-icon th-kpi-icon-red">
                <i className="ph-fill ph-student" />
              </span>
            </div>
            <div className="th-kpi-value">
              <CountUp value={data.studentsTotal} />
              <span className="th-kpi-unit">명</span>
            </div>
            <div className="th-kpi-label">우리반 학생</div>
          </div>
          <div className="th-kpi-card">
            <div className="th-kpi-top">
              <span className="th-kpi-icon th-kpi-icon-green">
                <i className="ph-fill ph-check-circle" />
              </span>
              <span className="th-kpi-badge">{data.donePct}</span>
            </div>
            <div className="th-kpi-value">
              <CountUp value={data.doneToday} />
              <span className="th-kpi-unit">명</span>
            </div>
            <div className="th-kpi-label">오늘 학습 완료</div>
          </div>
          <div className="th-kpi-card">
            <div className="th-kpi-top">
              <span className="th-kpi-icon th-kpi-icon-blue">
                <i className="ph-fill ph-target" />
              </span>
              <span className="th-kpi-badge">{data.accDelta}</span>
            </div>
            <div className="th-kpi-value">
              <CountUp value={data.avgAcc} />
              <span className="th-kpi-unit">%</span>
            </div>
            <div className="th-kpi-label">반 평균 정답률</div>
          </div>
          <div className="th-kpi-card">
            <div className="th-kpi-top">
              <span className="th-kpi-icon th-kpi-icon-amber">
                <i className="ph-fill ph-hand-heart" />
              </span>
            </div>
            <div className="th-kpi-value">
              <CountUp value={data.attentionCount} />
              <span className="th-kpi-unit">명</span>
            </div>
            <div className="th-kpi-label">도움이 필요한 학생</div>
          </div>
        </div>

        {/* CHARTS ROW */}
        <div className="th-charts">
          {/* weekly activity */}
          <div className="th-card">
            <div className="th-chart-head">
              <div>
                <h3 className="th-card-title">이번 주 반 학습 참여</h3>
                <p className="th-chart-sub">요일별 학습을 마친 학생 수</p>
              </div>
              <span className="th-week-badge">{data.weekBadge}</span>
            </div>
            <div className="th-bars">
              {bars.map((b) => (
                <div key={b.day} className="th-bar-col">
                  <span className="th-bar-n">{b.n}</span>
                  <div className="th-bar-fill" style={{ background: b.bg, height: b.h }} />
                  <span className="th-bar-day" style={{ color: b.dayColor }}>
                    {b.day}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {/* per-game accuracy */}
          <div className="th-card">
            <h3 className="th-game-title">놀이별 반 정답률</h3>
            <p className="th-game-sub">낮은 놀이는 함께 연습해요</p>
            <div className="th-game-list">
              {data.gameBars.map((g) => (
                <div key={g.label}>
                  <div className="th-game-row-head">
                    <span>{g.label}</span>
                    <span style={{ color: g.color }}>{g.pct}</span>
                  </div>
                  <div className="th-game-track">
                    <div className="th-game-fill" style={{ width: g.pct, background: g.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ATTENTION LIST + TODO */}
        <div className="th-bottom">
          <div className="th-card">
            <div className="th-att-head">
              <div className="th-att-head-left">
                <span className="th-att-icon">
                  <i className="ph-fill ph-hand-heart" />
                </span>
                <h3 className="th-card-title">도움이 필요한 학생</h3>
              </div>
              <Link to={PATHS.TEACHER_CLASS} className="th-att-all">
                전체 학생 보기
              </Link>
            </div>
            <div className="th-att-list">
              {data.attention.map((a) => (
                <div key={a.name} className="th-att-row">
                  <span className="th-att-avatar" style={{ background: a.avatarBg }}>
                    {a.initial}
                  </span>
                  <div className="th-att-info">
                    <div className="th-att-name">{a.name}</div>
                    <div className="th-att-note">{a.note}</div>
                  </div>
                  <span
                    className="th-att-tag"
                    style={{ background: a.tagBg, color: a.tagColor }}
                  >
                    {a.tag}
                  </span>
                  <button className="th-assign-btn">배정</button>
                </div>
              ))}
            </div>
          </div>
          <div className="th-card">
            <h3 className="th-todo-title">오늘 할 일</h3>
            <div className="th-todo-list">
              {data.todos.map((t) => (
                <div
                  key={t.label}
                  className={'th-todo-row ' + (t.done ? 'th-todo-done' : 'th-todo-open')}
                >
                  <span className="th-todo-icon">
                    <i className={t.done ? 'ph-fill ph-check' : 'ph-bold ph-circle'} />
                  </span>
                  <span className={t.done ? 'th-todo-text-done' : 'th-todo-text'}>{t.label}</span>
                </div>
              ))}
            </div>
            <div className="th-ai">
              <div className="th-ai-head">
                <i className="ph-fill ph-robot" />
                <span className="th-ai-label">AI 요약</span>
              </div>
              <p className="th-ai-text">{data.aiSummary}</p>
            </div>
          </div>
        </div>
      </main>
    </TeacherLayout>
  );
}
