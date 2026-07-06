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

interface Cat {
  key: string;
  tag: string;
  title: string;
  desc: string;
  c1: string;
  c2: string;
  icon: string;
  done: number;
  total: number;
  href: string;
  locked?: boolean;
}

interface AllLearningData {
  level: number;
  overallPct: number;
  cats: Cat[];
}

// TODO(api): studentApi.progress() 실패 시 원본 하드코딩 데이터 유지
const FALLBACK: AllLearningData = {
  level: 7,
  overallPct: 62,
  cats: [
    { key: 'kor', tag: '국어', title: '국어', desc: '글자와 낱말을 놀이로 익혀요', c1: '#FF7A7A', c2: '#FF5A6E', icon: 'ph-fill ph-book-open', done: 4, total: 5, href: `${PATHS.STUDENT_GAME}?subject=국어` },
    { key: 'eng', tag: '영어', title: '영어', desc: '알파벳과 쉬운 단어를 만나요', c1: '#FFB43C', c2: '#FF922E', icon: 'ph-fill ph-translate', done: 2, total: 5, href: `${PATHS.STUDENT_GAME}?subject=영어` },
    { key: 'math', tag: '수학', title: '수학', desc: '수와 셈을 놀이로 배워요', c1: '#33C892', c2: '#17B0A0', icon: 'ph-fill ph-plus-minus', done: 5, total: 5, href: `${PATHS.STUDENT_GAME}?subject=수학` },
    { key: 'sci', tag: '과학', title: '과학', desc: '관찰하고 탐구하며 배워요', c1: '#4AA6FF', c2: '#2E7BFF', icon: 'ph-fill ph-flask', done: 1, total: 5, href: `${PATHS.STUDENT_GAME}?subject=과학` },
    { key: 'hist', tag: '역사', title: '역사', desc: '옛날 이야기와 지혜를 만나요', c1: '#A98CFF', c2: '#8B6BFF', icon: 'ph-fill ph-scroll', done: 0, total: 5, href: `${PATHS.STUDENT_GAME}?subject=역사` },
    { key: 'life', tag: '생활', title: '생활', desc: '생활 속 안전과 지혜를 익혀요', c1: '#FF93BE', c2: '#FF6DA6', icon: 'ph-fill ph-house-line', done: 0, total: 5, href: `${PATHS.STUDENT_GAME}?subject=생활` },
  ],
};

const CHIPS = [
  { key: 'all', label: '전체', icon: 'ph-fill ph-squares-four' },
  { key: 'kor', label: '국어', icon: 'ph-fill ph-book-open' },
  { key: 'eng', label: '영어', icon: 'ph-fill ph-translate' },
  { key: 'math', label: '수학', icon: 'ph-fill ph-plus-minus' },
  { key: 'sci', label: '과학', icon: 'ph-fill ph-flask' },
  { key: 'hist', label: '역사', icon: 'ph-fill ph-scroll' },
  { key: 'life', label: '생활', icon: 'ph-fill ph-house-line' },
];

const LESSON_NAMES = ['기초 익히기', '기초 다지기', '조금 더 어렵게', '도전 문제', '마스터 챌린지'];

type LessonStatus = 'done' | 'active' | 'lock' | 'todo';

const LESSON_ICON: Record<LessonStatus, string> = {
  done: 'ph-fill ph-check',
  active: 'ph-fill ph-play',
  lock: 'ph-bold ph-lock-simple',
  todo: 'ph-bold ph-dot-outline',
};

const LESSON_LABEL: Record<LessonStatus, string> = {
  done: '완료',
  active: '진행중',
  lock: '잠김',
  todo: '시작 전',
};

/**
 * GET /students/me/progress 응답 → AllLearningData 매핑.
 * 실제 응답 형태: { subjects: [{ subject, done_chapters, current_chapter, accuracy, questions_done,
 *                              levels[], chapters[{no,name,count,state}] }], level, overall_pct }
 * 과목명(subject) 기준으로 매칭해 done(=done_chapters)·total(=chapters 개수)만 덮어쓴다.
 * level(실컬럼) / overall_pct(완료 챕터 실집계)는 top-level 필드를 사용한다.
 */
function mapProgress(d: any, prev: AllLearningData): Partial<AllLearningData> {
  const out: Partial<AllLearningData> = {};
  const list: any[] = Array.isArray(d.subjects) ? d.subjects : Array.isArray(d.cats) ? d.cats : [];
  const overall = d.overall_pct ?? d.overallPct;
  if (typeof d.level === 'number') out.level = d.level;
  if (typeof overall === 'number') out.overallPct = overall;
  if (list.length) {
    out.cats = prev.cats.map((c) => {
      const m = list.find((x) => x && (x.subject === c.tag || x.key === c.key || x.tag === c.tag));
      if (!m) return c;
      const done =
        typeof m.done_chapters === 'number' ? m.done_chapters : typeof m.done === 'number' ? m.done : c.done;
      const total =
        Array.isArray(m.chapters) && m.chapters.length
          ? m.chapters.length
          : typeof m.total === 'number'
            ? m.total
            : c.total;
      return {
        ...c,
        done,
        total,
        locked: typeof m.locked === 'boolean' ? m.locked : c.locked,
      };
    });
  }
  return out;
}

export default function AllLearning() {
  const { me } = useAuth();
  const [filter, setFilter] = useState('all');
  const [data, setData] = useState<AllLearningData>(FALLBACK);

  useEffect(() => {
    let mounted = true;
    studentApi
      .progress()
      .then((d: any) => {
        if (!mounted || !d) return;
        setData((prev) => ({ ...prev, ...mapProgress(d, prev) }));
      })
      .catch(() => {
        /* TODO(api): 백엔드 미구현 — FALLBACK 유지 */
      });
    return () => {
      mounted = false;
    };
  }, []);

  const name = (me?.name ?? '하은').trim() || '하은';
  const unread = useUnreadNotifications();
  const cats = data.cats.filter((c) => filter === 'all' || c.key === filter);

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
              <p className="al-subtitle">국어·영어·수학·과학·역사·생활 여섯 과목을 단계별로 차근차근 배워요</p>
            </div>
          </div>
          <div className="al-stats">
            <div className="al-stat">
              <div className="al-stat-value al-stat-level">레벨 {data.level}</div>
              <div className="al-stat-label">나의 학습 레벨</div>
            </div>
            <div className="al-stat">
              <div className="al-stat-value al-stat-pct">{data.overallPct}%</div>
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

      {/* CATEGORY LIST */}
      <section className="al-cats">
        {cats.map((c) => {
          const pct = Math.round((c.done / c.total) * 100);
          const panelVars = { '--al-c1': c.c1, '--al-c2': c.c2, '--al-sh': `${c.c2}cc` } as CSSProperties;
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
                <div className="al-panel-meta">
                  <span className="al-panel-donelabel">{c.locked ? '곧 열려요' : `${c.done}/${c.total} 단계`}</span>
                  <span>{pct}%</span>
                </div>
                <div className="al-panel-track">
                  <div className="al-panel-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
              {/* lessons */}
              <div>
                <div className="al-lessons-head">
                  <span className="al-lessons-label">단계별 학습</span>
                  <Link to={c.href} className="al-continue">
                    이어서 하기 <i className="ph-bold ph-arrow-right" />
                  </Link>
                </div>
                <div className="al-lessons">
                  {LESSON_NAMES.map((nm, i) => {
                    const status: LessonStatus = c.locked
                      ? 'lock'
                      : i < c.done
                        ? 'done'
                        : i === c.done
                          ? 'active'
                          : 'todo';
                    return (
                      <div key={nm} className={`al-ls al-ls-${status}`}>
                        <div className="al-ls-head">
                          <span className="al-ls-level">LV.{i + 1}</span>
                          <span className="al-ls-icon">
                            <i className={LESSON_ICON[status]} />
                          </span>
                        </div>
                        <div className="al-ls-name">{nm}</div>
                        <div className="al-ls-state">{LESSON_LABEL[status]}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <ScreenTimeReminder />
    </div>
  );
}
