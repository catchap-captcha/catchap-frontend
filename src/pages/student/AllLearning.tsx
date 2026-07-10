import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { useAuth } from '../../hooks/useAuth';
import { useUnreadNotifications } from '../../hooks/useUnreadNotifications';
import { studentApi } from '../../api/students';
import ScreenTimeReminder from '../../components/motion/ScreenTimeReminder';
import mascot from '../../assets/characters/catchap-logo.png';
import './AllLearning.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ChapterInfo {
  no: number;
  name: string;
  stages: number;
  stagesDone: number;
  unlocked: boolean;
  state: string; // done | current | available | locked
}
interface Cat {
  key: string;
  tag: string;
  title: string;
  desc: string;
  c1: string;
  c2: string;
  icon: string;
  available: boolean; // 문제은행 있는 과목만 챕터 플레이 가능(국어는 준비중)
  currentChapter: number; // 이어할 챕터(열린 것 중 미완료 최저)
  accuracy: number; // 숙련도(정답률)
  unlockedChapters: number;
  maxChapters: number;
  chapters: ChapterInfo[]; // 주차별 챕터 — 각 5단계, 달력 잠금
}

interface AllLearningData {
  completedChapters: number; // 완료한 챕터 수(전 과목) — 헤더 지표
  overallPct: number;
  cats: Cat[];
}

// 과목 메타(색·아이콘·설명) — 서버 /chapters가 이 껍데기에 챕터·진행을 채운다.
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
    available: false, currentChapter: 1, accuracy: 0, unlockedChapters: 0, maxChapters: 0, chapters: [],
  };
}

// 서버 미응답 시 껍데기(챕터 없음) — 가짜 진행을 보여주지 않는다.
const FALLBACK: AllLearningData = {
  completedChapters: 0,
  overallPct: 0,
  cats: SUBJECT_ORDER.map(makeCat),
};

const CHIPS = [
  { key: 'all', label: '전체', icon: 'ph-fill ph-squares-four' },
  { key: 'kor', label: '국어', icon: 'ph-fill ph-book-open' },
  { key: 'eng', label: '영어', icon: 'ph-fill ph-translate' },
  { key: 'math', label: '수학', icon: 'ph-fill ph-plus-minus' },
  { key: 'sci', label: '과학', icon: 'ph-fill ph-flask' },
  { key: 'soc', label: '사회', icon: 'ph-fill ph-scroll' },
  { key: 'life', label: '생활', icon: 'ph-fill ph-house-line' },
];

const CH_ICON: Record<string, string> = {
  done: 'ph-fill ph-check',
  current: 'ph-fill ph-play',
  available: 'ph-fill ph-play',
  locked: 'ph-bold ph-lock-simple',
};
const CH_LABEL: Record<string, string> = {
  done: '완료',
  current: '이어하기',
  available: '이어하기',
  locked: '다음 주',
};

/**
 * GET /students/me/chapters 응답 → AllLearningData 매핑.
 * 응답: { subjects: [{ subject, available, max_chapters, unlocked_chapters, current_chapter,
 *          accuracy, chapters[{no,name,stages,stages_done,unlocked,state}] }], anchor_monday }
 * 오늘의 퀴즈(습관)와 분리된 '학습(주간 챕터·5단계)' 축. 잠금은 달력(월요일) 기준.
 */
function mapChapters(d: any): Partial<AllLearningData> {
  const list: any[] = Array.isArray(d?.subjects) ? d.subjects : [];
  if (!list.length) return {};
  const cats = SUBJECT_ORDER.map((subj) => {
    const c = makeCat(subj);
    const m = list.find((x) => x && x.subject === subj);
    if (!m) return c;
    const chapters: ChapterInfo[] = (Array.isArray(m.chapters) ? m.chapters : []).map((ch: any) => ({
      no: Number(ch.no),
      name: String(ch.name ?? `${ch.no}주차`),
      stages: Number(ch.stages ?? 5),
      stagesDone: Number(ch.stages_done ?? 0),
      unlocked: !!ch.unlocked,
      state: String(ch.state ?? 'locked'),
    }));
    return {
      ...c,
      available: !!m.available,
      currentChapter: Number(m.current_chapter ?? 1) || 1,
      accuracy: Number(m.accuracy ?? 0),
      unlockedChapters: Number(m.unlocked_chapters ?? 0),
      maxChapters: Number(m.max_chapters ?? 0),
      chapters,
    };
  });
  // 전체 진행률 = 완료 단계 / 전체 단계(가능 과목만) — 홈/챕터 바와 같은 '단계' 기준
  // 완료 챕터 수 = 5단계 다 채운 챕터 개수(전 과목) — 헤더 지표(가짜 레벨 대체)
  let done = 0;
  let total = 0;
  let completedChapters = 0;
  for (const c of cats) {
    for (const ch of c.chapters) {
      done += Math.min(ch.stages, ch.stagesDone);
      total += ch.stages;
      if (ch.stagesDone >= ch.stages) completedChapters += 1;
    }
  }
  return { cats, completedChapters, overallPct: total ? Math.round((done / total) * 100) : 0 };
}

export default function AllLearning() {
  const { me } = useAuth();
  const [filter, setFilter] = useState('all');
  const [data, setData] = useState<AllLearningData>(FALLBACK);

  useEffect(() => {
    let mounted = true;
    // 주간 챕터(학습 축) — 5단계 진행·달력 잠금
    studentApi
      .chapters()
      .then((d: any) => {
        if (!mounted || !d) return;
        setData((prev) => ({ ...prev, ...mapChapters(d) }));
      })
      .catch(() => {
        /* 실패 시 FALLBACK(빈 챕터) 유지 — 가짜 진행 표시 안 함 */
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
              <p className="al-subtitle">국어·영어·수학·과학·사회·생활 여섯 과목을 단계별로 차근차근 배워요</p>
            </div>
          </div>
          <div className="al-stats">
            <div className="al-stat">
              <div className="al-stat-value al-stat-level">{data.completedChapters}개</div>
              <div className="al-stat-label">완료한 챕터</div>
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
          const panelVars = { '--al-c1': c.c1, '--al-c2': c.c2, '--al-sh': `${c.c2}cc` } as CSSProperties;
          // 이번 주(이어할) 챕터의 단계 진행 — 홈/오늘의퀴즈 바와 같은 5단계 세그먼트
          const cur = c.chapters.find((ch) => ch.no === c.currentChapter) || c.chapters[0];
          const curDone = cur ? cur.stagesDone : 0;
          const curStages = cur ? cur.stages : 5;
          // 오늘의 퀴즈와 같은 위젯(GameScreen)으로 통일 — 이어할 챕터의 다음 미완료 단계를 연다.
          // 이미 5단계를 다 끝낸 챕터면 복습 모드(1단계부터, 코인·진도 미적립)로 들어간다.
          const curFinished = !!cur && curDone >= curStages;
          const playHref = cur
            ? curFinished
              ? `${PATHS.STUDENT_GAME}?subject=${encodeURIComponent(c.tag)}&chapter=${cur.no}&stage=1&replay=1`
              : `${PATHS.STUDENT_GAME}?subject=${encodeURIComponent(c.tag)}&chapter=${cur.no}&stage=${Math.min(cur.stages, curDone + 1)}`
            : '';
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
                {c.available && cur ? (
                  <div className="al-panel-meta">
                    <span className="al-panel-donelabel">{cur.no}주차</span>
                  </div>
                ) : (
                  <div className="al-panel-soon">
                    <i className="ph-fill ph-puzzle-piece" /> 문제 준비 중
                  </div>
                )}
              </div>
              {/* 주차별 챕터 — 각 5단계, 달력 잠금(월요일 해제). 가로 캐러셀(< > 화살표) */}
              <ChapterWeeks cat={c} playHref={playHref} />
            </div>
          );
        })}
      </section>

      <ScreenTimeReminder />
    </div>
  );
}

/** 주차별 챕터 가로 캐러셀 — 이어서 하기 위 < > 화살표로 좌우 이동(챕터가 화면보다 많으면 스크롤). */
function ChapterWeeks({ cat, playHref }: { cat: Cat; playHref: string }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const cur = cat.chapters.find((ch) => ch.no === cat.currentChapter) || cat.chapters[0];
  const scroll = (dir: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.7), behavior: 'smooth' });
  };
  return (
    <div className="al-weeks-col">
      <div className="al-lessons-head">
        <span className="al-lessons-label">주차별 챕터</span>
        {cat.available && cur && (
          <div className="al-weeks-headright">
            <div className="al-weeks-arrows">
              <button type="button" className="al-weeks-arrow" onClick={() => scroll(-1)} aria-label="이전 주차">
                <i className="ph-bold ph-caret-left" />
              </button>
              <button type="button" className="al-weeks-arrow" onClick={() => scroll(1)} aria-label="다음 주차">
                <i className="ph-bold ph-caret-right" />
              </button>
            </div>
            <Link to={playHref} className="al-continue">
              이어서 하기 <i className="ph-bold ph-arrow-right" />
            </Link>
          </div>
        )}
      </div>
      <div className="al-lessons" ref={trackRef}>
        {cat.available && cat.chapters.length ? (
          cat.chapters.map((ch) => {
            // 완주 챕터(5/5)는 복습 모드(1단계부터, 코인·진도 미적립)로 진입
            const chFinished = ch.stagesDone >= ch.stages;
            const href = chFinished
              ? `${PATHS.STUDENT_GAME}?subject=${encodeURIComponent(cat.tag)}&chapter=${ch.no}&stage=1&replay=1`
              : `${PATHS.STUDENT_GAME}?subject=${encodeURIComponent(cat.tag)}&chapter=${ch.no}&stage=${Math.min(ch.stages, ch.stagesDone + 1)}`;
            const inner = (
              <>
                <div className="al-ls-head">
                  <span className="al-ls-level">{ch.no}주차</span>
                  <span className="al-ls-icon">
                    <i className={CH_ICON[ch.state] || CH_ICON.locked} />
                  </span>
                </div>
                <div className="al-ls-name">{ch.name}</div>
                <div className="al-ls-state">
                  {ch.state === 'locked'
                    ? ch.no - cat.unlockedChapters <= 1
                      ? '다음 주'
                      : `${ch.no - cat.unlockedChapters}주 후`
                    : CH_LABEL[ch.state] || '잠김'}
                </div>
              </>
            );
            const cls = `al-ls al-ls-${ch.state === 'current' || ch.state === 'available' ? 'active' : ch.state === 'done' ? 'done' : 'lock'}`;
            return ch.unlocked ? (
              <Link key={ch.no} to={href} className={cls}>
                {inner}
              </Link>
            ) : (
              <div key={ch.no} className={cls} title="다음 주 월요일에 열려요">
                {inner}
              </div>
            );
          })
        ) : (
          <div className="al-ls al-ls-lock al-ls-soon">
            <div className="al-ls-name">이 과목은 문제를 준비 중이에요</div>
          </div>
        )}
      </div>
    </div>
  );
}
