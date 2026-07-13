import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { useAuth } from '../../hooks/useAuth';
import { useUnreadNotifications } from '../../hooks/useUnreadNotifications';
import { studentApi } from '../../api/students';
import ScreenTimeReminder from '../../components/motion/ScreenTimeReminder';
import mascot from '../../assets/characters/catchap-logo.png';
import './AllLearning.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** 전체 학습 = 문제은행 모드(0713 제품 결정).
 * 챕터/단계/주간 잠금/코인 없이 과목 은행 전체에서 이어서 연습한다.
 * 출제 우선순위는 서버가 자동으로: ① 안 푼 문제 → ② 틀린 문제 → ③ 맞춘 문제.
 * 코인·연속도전은 오늘의 퀴즈(습관 축) 전용 — 여기는 기록·정답률·오답노트만 쌓인다. */

interface Cat {
  key: string;
  tag: string;
  title: string;
  desc: string;
  c1: string;
  c2: string;
  icon: string;
  available: boolean; // 문제은행 있는 과목만 플레이 가능
  total: number;
  unsolved: number;
  wrong: number;
  correct: number;
  accuracy: number | null; // 과목 정답률(누적) — 기록 없으면 null
}

const SUBJECT_META: Record<string, { key: string; desc: string; c1: string; c2: string; icon: string }> = {
  국어: { key: 'kor', desc: '낱말·문장·글의 속뜻을 익혀요', c1: '#FF7A7A', c2: '#FF5A6E', icon: 'ph-fill ph-book-open' },
  영어: { key: 'eng', desc: '단어·문장·문법으로 영어를 익혀요', c1: '#FFB43C', c2: '#FF922E', icon: 'ph-fill ph-translate' },
  수학: { key: 'math', desc: '수·연산·도형·측정을 익혀요', c1: '#33C892', c2: '#17B0A0', icon: 'ph-fill ph-plus-minus' },
  과학: { key: 'sci', desc: '관찰하고 탐구하며 배워요', c1: '#4AA6FF', c2: '#2E7BFF', icon: 'ph-fill ph-flask' },
  사회: { key: 'soc', desc: '지도·지역·공공기관을 알아가요', c1: '#A98CFF', c2: '#8B6BFF', icon: 'ph-fill ph-scroll' },
  생활: { key: 'life', desc: '생활 속 안전과 지혜를 익혀요', c1: '#FF93BE', c2: '#FF6DA6', icon: 'ph-fill ph-house-line' },
};
const SUBJECT_ORDER = ['국어', '영어', '수학', '과학', '사회', '생활'];

function makeCat(subject: string): Cat {
  const m = SUBJECT_META[subject];
  return {
    key: m.key, tag: subject, title: subject, desc: m.desc, c1: m.c1, c2: m.c2, icon: m.icon,
    available: false, total: 0, unsolved: 0, wrong: 0, correct: 0, accuracy: null,
  };
}

const CHIPS = [
  { key: 'all', label: '전체', icon: 'ph-fill ph-squares-four' },
  { key: 'kor', label: '국어', icon: 'ph-fill ph-book-open' },
  { key: 'eng', label: '영어', icon: 'ph-fill ph-translate' },
  { key: 'math', label: '수학', icon: 'ph-fill ph-plus-minus' },
  { key: 'sci', label: '과학', icon: 'ph-fill ph-flask' },
  { key: 'soc', label: '사회', icon: 'ph-fill ph-scroll' },
  { key: 'life', label: '생활', icon: 'ph-fill ph-house-line' },
];

/** GET /students/me/bank-progress → 과목 카드. 응답에 없는 과목은 '준비 중'. */
function mapBank(d: any): Cat[] {
  const list: any[] = Array.isArray(d?.subjects) ? d.subjects : [];
  return SUBJECT_ORDER.map((subj) => {
    const c = makeCat(subj);
    const m = list.find((x) => x && x.subject === subj);
    if (!m || !Number(m.total)) return c;
    return {
      ...c,
      available: true,
      total: Number(m.total) || 0,
      unsolved: Number(m.unsolved) || 0,
      wrong: Number(m.wrong) || 0,
      correct: Number(m.correct) || 0,
      accuracy: typeof m.accuracy === 'number' ? m.accuracy : null,
    };
  });
}

export default function AllLearning() {
  const { me } = useAuth();
  const [filter, setFilter] = useState('all');
  const [cats, setCats] = useState<Cat[]>(SUBJECT_ORDER.map(makeCat));

  useEffect(() => {
    let mounted = true;
    studentApi
      .bankProgress()
      .then((d: any) => {
        if (!mounted || !d) return;
        setCats(mapBank(d));
      })
      .catch(() => {
        /* 실패 시 껍데기 유지 — 가짜 진행 표시 안 함 */
      });
    return () => {
      mounted = false;
    };
  }, []);

  const name = (me?.name ?? '하은').trim() || '하은';
  const unread = useUnreadNotifications();
  const shown = cats.filter((c) => filter === 'all' || c.key === filter);

  // 헤더 지표: 풀어본 문항 수 / 전체 진행률(전 과목 은행 기준)
  const solvedAll = cats.reduce((s, c) => s + c.wrong + c.correct, 0);
  const totalAll = cats.reduce((s, c) => s + c.total, 0);
  const overallPct = totalAll ? Math.round((solvedAll / totalAll) * 100) : 0;

  return (
    <div className="al-root">
      {/* NAV — 원본 전체학습 NAV (우측 요소가 학습 홈 NAV와 달라 페이지 내 구현) */}
      <div className="al-nav">
        <div className="al-navinner">
          <Link to={PATHS.STUDENT_HOME} className="al-logo">
            <img src={mascot} alt="CatChap" className="al-logoimg" />
            <div className="al-logotext">
              <span className="al-logotitle">CatChap</span>
              <span className="al-logosub">놀면서 배우는 캡챠 학습</span>
            </div>
          </Link>
          <nav className="al-menu">
            <Link to={PATHS.STUDENT_HOME} className="al-navlink">
              홈
            </Link>
            <a href="#" className="al-navlink-active">
              전체 학습
            </a>
            <Link to={PATHS.STUDENT_CONCEPTS} className="al-navlink">
              개념 설명
            </Link>
            <Link to={PATHS.STUDENT_AI_TEACHER} className="al-navlink">
              AI 선생님
            </Link>
            <Link to={PATHS.STUDENT_RECORDS} className="al-navlink">
              나의 기록
            </Link>
          </nav>
          <div className="al-navright">
            <Link to={PATHS.STUDENT_SEARCH} title="검색" className="al-iconbtn">
              <i className="ph-bold ph-magnifying-glass" />
            </Link>
            <Link to={PATHS.STUDENT_NOTIFICATIONS} title="알림" className="al-bellbtn">
              <i className="ph-fill ph-bell" />
              {unread > 0 && <span className="al-belldot" />}
            </Link>
            <Link to={PATHS.STUDENT_PROFILE} title="마이페이지" className="al-profile">
              <div className="al-avatar">{name.charAt(0)}</div>
              <span className="al-profilename">{name}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* HEADER */}
      <section className="al-header-section">
        <div className="al-header">
          <div className="al-header-left">
            <span className="al-header-icon">
              <i className="ph-fill ph-squares-four" />
            </span>
            <div>
              <h1 className="al-title">전체 학습</h1>
              <p className="al-subtitle">
                여섯 과목 문제은행을 이어서 풀어요 — 안 푼 문제부터, 그다음 틀린 문제를 자동으로 내줘요
              </p>
            </div>
          </div>
          <div className="al-stats">
            <div className="al-stat">
              <div className="al-stat-value al-stat-level">{solvedAll}문항</div>
              <div className="al-stat-label">풀어본 문제</div>
            </div>
            <div className="al-stat">
              <div className="al-stat-value al-stat-pct">{overallPct}%</div>
              <div className="al-stat-label">전체 진행률</div>
            </div>
          </div>
        </div>

        {/* FILTER CHIPS */}
        <div className="al-chips">
          {CHIPS.map((chip) => (
            <button
              key={chip.key}
              onClick={() => setFilter(chip.key)}
              className={`al-chip ${filter === chip.key ? 'al-chip-on' : 'al-chip-off'}`}
            >
              <i className={chip.icon} />
              {chip.label}
            </button>
          ))}
        </div>
      </section>

      {/* SUBJECT BANK CARDS */}
      <section className="al-cats">
        {shown.map((c) => {
          const panelVars = { '--al-c1': c.c1, '--al-c2': c.c2, '--al-sh': `${c.c2}cc` } as CSSProperties;
          const solved = c.wrong + c.correct;
          const pct = c.total ? Math.round((solved / c.total) * 100) : 0;
          const playHref = `${PATHS.STUDENT_GAME}?subject=${encodeURIComponent(c.tag)}&bank=1`;
          // 다음에 나올 문제 힌트 — 서버 출제 우선순위와 동일 문구
          const nextHint = c.unsolved > 0
            ? '다음은 안 푼 문제가 나와요'
            : c.wrong > 0
              ? '다음은 틀렸던 문제를 다시 풀어요'
              : '모두 풀었어요! 맞춘 문제로 복습해요';
          return (
            <div key={c.key} className="al-cat">
              {/* left color panel */}
              <div className="al-panel" style={panelVars}>
                <div className="al-panel-orb" />
                <div className="al-panel-head">
                  <span className="al-panel-tag">{c.tag}</span>
                  <span className="al-panel-icon">
                    <i className={c.icon} />
                  </span>
                </div>
                <h3 className="al-panel-title">{c.title}</h3>
                <p className="al-panel-desc">{c.desc}</p>
                {c.available ? (
                  <div className="al-panel-meta">
                    <span className="al-panel-donelabel">{c.total}문항 은행</span>
                  </div>
                ) : (
                  <div className="al-panel-soon">
                    <i className="ph-fill ph-puzzle-piece" /> 문제 준비 중
                  </div>
                )}
              </div>
              {/* right: 은행 진도 + 문제 풀기 */}
              <div className="al-bank-col">
                {c.available ? (
                  <>
                    <div className="al-bank-head">
                      <span className="al-lessons-label">문제은행 진행</span>
                      <Link to={playHref} className="al-continue">
                        문제 풀기 <i className="ph-bold ph-arrow-right" />
                      </Link>
                    </div>
                    <div className="al-bank-bar">
                      <div className="al-bank-fill" style={{ width: `${pct}%`, background: c.c2 }} />
                    </div>
                    <div className="al-bank-barlabel">
                      {solved}/{c.total} 풀어봄 · {pct}%
                      {typeof c.accuracy === 'number' && c.accuracy > 0 && (
                        <span className="al-bank-acc"> · 정답률 {Math.round(c.accuracy)}%</span>
                      )}
                    </div>
                    <div className="al-bank-pills">
                      <span className="al-bank-pill al-bank-pill-new">
                        <i className="ph-fill ph-sparkle" /> 안 푼 문제 {c.unsolved}
                      </span>
                      <span className="al-bank-pill al-bank-pill-wrong">
                        <i className="ph-fill ph-arrow-counter-clockwise" /> 틀린 문제 {c.wrong}
                      </span>
                      <span className="al-bank-pill al-bank-pill-ok">
                        <i className="ph-fill ph-check-circle" /> 맞춘 문제 {c.correct}
                      </span>
                    </div>
                    <div className="al-bank-hint">
                      <i className="ph-fill ph-lightbulb" /> {nextHint}
                    </div>
                  </>
                ) : (
                  <div className="al-ls al-ls-lock al-ls-soon">
                    <div className="al-ls-name">이 과목은 문제를 준비 중이에요</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <ScreenTimeReminder />
    </div>
  );
}
