import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { studentApi } from '../../api/students';
import ScreenTimeReminder from '../../components/motion/ScreenTimeReminder';
import ChapterAccuracyChart, { type SubjectStat } from '../../components/student/ChapterAccuracyChart';
import { StudentNav } from '../../layouts/StudentLayout';
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
  const [filter, setFilter] = useState('all');
  const [data, setData] = useState<AllLearningData>(FALLBACK);
  const [chapStats, setChapStats] = useState<SubjectStat[]>([]);
  /* 오늘의 Q 현황(퀴즈 통합 1단계) — 일일 목표·연속 학습일·과목별 큐. 실패 시 카드 미노출 */
  const [qToday, setQToday] = useState<any>(null);

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
    // 숙련 축 — 과목×챕터별 정답률(대시보드 그래프). 실패 시 빈 배열 → 섹션 미노출
    studentApi
      .chapterStats()
      .then((d: any) => {
        if (mounted && Array.isArray(d?.subjects)) setChapStats(d.subjects);
      })
      .catch(() => {});
    // 오늘의 Q — 목표·연속·큐 요약(실패는 조용히 카드 생략 — 가짜 수치 표시 안 함)
    studentApi
      .qToday()
      .then((d: any) => {
        if (mounted && d && typeof d.goal === 'number') setQToday(d);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const cats = data.cats.filter((c) => filter === 'all' || c.key === filter);

  /* 오늘의 Q 시작 과목 — 만기 많은 과목 우선 → 틀린 것 있는 과목 → 새 문항 많은 과목.
     (발급은 기존 과목 단위 챌린지 그대로 — '통합'은 진입점·목표·집계 레벨에서) */
  const qStartHref = (() => {
    const subs: any[] = qToday?.subjects ?? [];
    if (!subs.length) return null;
    const mostDue = [...subs].sort((a, b) => (b.due ?? 0) - (a.due ?? 0))[0];
    const mostNew = [...subs].sort((a, b) => (b.new ?? 0) - (a.new ?? 0))[0];
    const pick =
      (mostDue?.due ?? 0) > 0 ? mostDue : subs.find((s) => (s.wrong ?? 0) > 0) ?? mostNew;
    if (!pick || ((pick.due ?? 0) === 0 && (pick.wrong ?? 0) === 0 && (pick.new ?? 0) === 0))
      return null; // 풀 게 하나도 없음(전부 휴면·잠김) — 버튼 대신 완료 문구
    return `${PATHS.STUDENT_GAME}?subject=${encodeURIComponent(pick.subject)}&bank=1`;
  })();

  return (
    <div className="al-root">
      {/* NAV — 공용 StudentNav로 통일(사용자 결정 0714: 전 페이지 동일 상단바 + 프로필 로그아웃) */}
      <StudentNav />

      {/* HEADER */}
      <section className="al-header-section">
        <div className="al-header">
          <div className="al-header-left">
            <span className="al-header-icon">
              <i className="ph-fill ph-squares-four" />
            </span>
            <div>
              <h1 className="al-title">문제은행</h1>
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

        {/* 오늘의 Q — 일일 목표(1세트)·연속 학습일·전과목 큐 요약(퀴즈 통합 1단계).
            데이터를 못 받으면 카드 자체를 생략(가짜 수치 금지). */}
        {qToday && (
          <div className="al-qcard">
            <div className="al-qcard-left">
              <div className="al-qcard-titlerow">
                <span className="al-qcard-badge">
                  <i className="ph-fill ph-stack" /> 오늘의 Q
                </span>
                {qToday.streak_days > 0 && (
                  <span className="al-qcard-streak" title="일일 목표(10문제) 달성일 연속">
                    🔥 연속 {qToday.streak_days}일
                  </span>
                )}
              </div>
              <div className="al-qcard-counts">
                <span className="al-qcard-count al-qcard-count--due">
                  복습 도착 <b>{qToday.total?.due ?? 0}</b>
                </span>
                <span className="al-qcard-count al-qcard-count--wrong">
                  틀린 문제 <b>{qToday.total?.wrong ?? 0}</b>
                </span>
                <span className="al-qcard-count">
                  새 문제 <b>{qToday.total?.new ?? 0}</b>
                </span>
              </div>
              <div className="al-qcard-goal">
                <div className="al-qcard-goaltrack">
                  <div
                    className="al-qcard-goalfill"
                    style={{ width: `${Math.min(100, Math.round(((qToday.done_today ?? 0) / (qToday.goal || 10)) * 100))}%` }}
                  />
                </div>
                <span className="al-qcard-goaltext">
                  오늘 목표 {Math.min(qToday.done_today ?? 0, qToday.goal ?? 10)}/{qToday.goal ?? 10}
                  {qToday.goal_met ? ' · 달성! 🎉' : ''}
                </span>
              </div>
            </div>
            {qStartHref ? (
              <Link to={qStartHref} className="al-qcard-start">
                {qToday.goal_met ? '더 풀기' : '오늘의 Q 시작'} <i className="ph-bold ph-arrow-right" />
              </Link>
            ) : (
              <span className="al-qcard-done">오늘 풀 문제를 모두 끝냈어요 ✨</span>
            )}
          </div>
        )}

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
          // 메인 CTA '이어서 하기' = 과목 전체 SRS 큐(만기 복습→틀린→새, 챕터 없이) —
          // 큐를 다 비우면 '오늘 완료' 화면이 뜬다(설계 question-bank-scale-design.md).
          // 주차 카드는 기존대로 챕터 스코프(bank+chapter) — 명시적 챕터 복습 경로로 유지.
          const playHref = cur
            ? `${PATHS.STUDENT_GAME}?subject=${encodeURIComponent(c.tag)}&bank=1`
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

      {/* 숙련 축 — 과목×주차(챕터)별 정답률 그래프. 기록 있을 때만 노출(가짜 진행 없음) */}
      {chapStats.some((s) => s.chapters?.some((c) => c.total > 0)) && (
        <section className="al-accsection">
          <div className="al-acchead">
            <h2 className="al-acctitle">주차별 정답률</h2>
            <p className="al-accsub">과목을 골라 챕터(주차)마다 얼마나 맞혔는지 확인해요. 오늘의 퀴즈와는 별개예요.</p>
          </div>
          <ChapterAccuracyChart subjects={chapStats} />
        </section>
      )}

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
            // 주차별 진입 — 문제은행 무한 모드(그 주차 안 푼>틀린>푼 우선). 잠긴 주차는 아래에서 비활성.
            const href = `${PATHS.STUDENT_GAME}?subject=${encodeURIComponent(cat.tag)}&chapter=${ch.no}&bank=1`;
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
