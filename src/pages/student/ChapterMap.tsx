import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { studentApi } from '../../api/students';
import { useToast } from '../../hooks/useToast';
import ScreenTimeReminder from '../../components/motion/ScreenTimeReminder';
import mascot from '../../assets/characters/catchap-logo.png';
import './ChapterMap.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface SubjectTheme {
  color: string;
  soft: string;
  ring: string;
  grad: string;
  icon: string;
}

const SUBJECTS: Record<string, SubjectTheme> = {
  국어: { color: '#FF5A4D', soft: '#FFE0DB', ring: 'rgba(255,90,77,0.4)', grad: 'linear-gradient(150deg,#FF7A7A,#FF5A6E)', icon: 'ph-fill ph-book-open' },
  영어: { color: '#FF922E', soft: '#FFEDD6', ring: 'rgba(255,146,46,0.4)', grad: 'linear-gradient(150deg,#FFB43C,#FF922E)', icon: 'ph-fill ph-translate' },
  수학: { color: '#17B08C', soft: '#DFF6EE', ring: 'rgba(23,176,140,0.4)', grad: 'linear-gradient(150deg,#33C892,#17B0A0)', icon: 'ph-fill ph-plus-minus' },
  과학: { color: '#2E7BFF', soft: '#E1EDFF', ring: 'rgba(46,123,255,0.4)', grad: 'linear-gradient(150deg,#4AA6FF,#2E7BFF)', icon: 'ph-fill ph-flask' },
  사회: { color: '#8B6BFF', soft: '#EAE2FF', ring: 'rgba(139,107,255,0.4)', grad: 'linear-gradient(150deg,#A98CFF,#8B6BFF)', icon: 'ph-fill ph-scroll' },
  생활: { color: '#FF6DA6', soft: '#FFE3EF', ring: 'rgba(255,109,166,0.4)', grad: 'linear-gradient(150deg,#FF93BE,#FF6DA6)', icon: 'ph-fill ph-house-line' },
};

const CHAPTERS: Record<string, { name: string; count: number }[]> = {
  국어: [
    { name: '자음·모음', count: 4 }, { name: '낱말 읽기', count: 5 }, { name: '짧은 문장', count: 4 },
    { name: '받아쓰기', count: 3 }, { name: '종합 복습', count: 5 },
  ],
  영어: [
    { name: '알파벳', count: 4 }, { name: '파닉스 소리', count: 5 }, { name: '쉬운 단어', count: 5 },
    { name: '짧은 문장', count: 4 }, { name: '종합 복습', count: 5 },
  ],
  수학: [
    { name: '수 세기', count: 4 }, { name: '더하기', count: 5 }, { name: '빼기', count: 5 },
    { name: '모양과 규칙', count: 4 }, { name: '종합 복습', count: 5 },
  ],
  과학: [
    { name: '동물 친구', count: 4 }, { name: '식물 관찰', count: 4 }, { name: '날씨와 계절', count: 5 },
    { name: '물과 공기', count: 4 }, { name: '종합 복습', count: 5 },
  ],
  사회: [
    { name: '옛날 사람들', count: 4 }, { name: '위인 이야기', count: 5 }, { name: '우리 문화', count: 4 },
    { name: '나라의 시작', count: 4 }, { name: '종합 복습', count: 5 },
  ],
  생활: [
    { name: '교통 안전', count: 4 }, { name: '우리 집 안전', count: 4 }, { name: '친구 사이', count: 5 },
    { name: '건강 습관', count: 4 }, { name: '종합 복습', count: 5 },
  ],
};

// TODO(api): studentApi.progress(subject) 실패 시 원본 DEFAULT_DONE 데이터 유지
const FALLBACK: Record<string, number> = { 국어: 2, 영어: 1, 수학: 3, 과학: 0, 사회: 1, 생활: 2 };

interface ChapterEntry {
  name: string;
  count: number;
}

/**
 * GET /students/me/progress 응답 → 과목별 { done_chapters, chapters[{name,count}] } 매핑.
 * 실제 응답 형태: { subjects: [{ subject, done_chapters, current_chapter, chapters[{no,name,count,state}], ... }] }
 * (과거 형태인 최상위 done_chapters 단일 객체도 허용)
 */
function mapProgress(d: any): { done: Record<string, number>; chapters: Record<string, ChapterEntry[]> } {
  const done: Record<string, number> = {};
  const chapters: Record<string, ChapterEntry[]> = {};
  const list: any[] = Array.isArray(d?.subjects) ? d.subjects : d ? [d] : [];
  for (const s of list) {
    const subj = typeof s?.subject === 'string' ? s.subject : null;
    if (!subj || !SUBJECTS[subj]) continue;
    const raw = s.done_chapters ?? s.doneChapters ?? s.done;
    if (typeof raw === 'number') done[subj] = raw;
    if (Array.isArray(s.chapters) && s.chapters.length) {
      const valid = s.chapters.filter((c: any) => c && typeof c.name === 'string' && typeof c.count === 'number');
      if (valid.length) chapters[subj] = valid.map((c: any) => ({ name: c.name, count: c.count }));
    }
  }
  return { done, chapters };
}

/** 생활 일일 교육과정 일차 — 지난날(복습)·오늘(과제)·미래(잠금·주제 미리보기) */
interface CurDay {
  day: number;
  topic: string;
  status: 'past' | 'today' | 'future';
  playable_count: number;
  total: number;
}

export default function ChapterMap() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast, flash } = useToast(2400); // 원본 showToast: 2400ms
  const [apiDone, setApiDone] = useState<Record<string, number>>({});
  const [apiChapters, setApiChapters] = useState<Record<string, ChapterEntry[]>>({});
  // 생활: 커리큘럼 일차 목록 (실전 플레이 연동 — 실패 시 null → 기존 챕터 데모 유지)
  const [curDays, setCurDays] = useState<CurDay[] | null>(null);
  const [curTodayDay, setCurTodayDay] = useState<number | null>(null);

  // 원본 componentDidMount 로직: ?subject= → #hash → 기본 '국어'
  let name = '국어';
  const q = searchParams.get('subject');
  if (q) {
    name = q;
  } else if (window.location.hash) {
    try {
      const h = decodeURIComponent(window.location.hash.slice(1));
      if (h) name = h;
    } catch {
      /* 원본과 동일: 파싱 실패 시 무시 */
    }
  }
  const key = SUBJECTS[name] ? name : '국어';
  const s = SUBJECTS[key];

  // 생활 과목: 챕터 지도 대신 실제 일일 커리큘럼(주제 순환)을 노드로 렌더
  useEffect(() => {
    if (key !== '생활') {
      setCurDays(null);
      return;
    }
    let mounted = true;
    studentApi
      .curriculum('생활', 6, 3)
      .then((d: any) => {
        if (!mounted || !d?.available || !Array.isArray(d.days) || d.days.length === 0) return;
        setCurDays(
          d.days.map((x: any) => ({
            day: Number(x.day),
            topic: String(x.topic ?? ''),
            status: x.status === 'past' || x.status === 'today' ? x.status : 'future',
            playable_count: typeof x.playable_count === 'number' ? x.playable_count : 0,
            total: typeof x.total === 'number' ? x.total : 0,
          })),
        );
        setCurTodayDay(typeof d.today_day === 'number' ? d.today_day : null);
      })
      .catch(() => {
        /* 실패 시 기존 챕터 데모 유지 */
      });
    return () => {
      mounted = false;
    };
  }, [key]);

  const isLife = key === '생활' && curDays !== null && curDays.length > 0;
  const list: ChapterEntry[] = isLife
    ? curDays.map((d) => ({ name: d.topic, count: d.playable_count || d.total }))
    : (apiChapters[key] ?? CHAPTERS[key]);

  useEffect(() => {
    let mounted = true;
    studentApi
      .progress(key)
      .then((d: any) => {
        if (!mounted || !d) return;
        const mapped = mapProgress(d);
        if (Object.keys(mapped.done).length) setApiDone((prev) => ({ ...prev, ...mapped.done }));
        if (Object.keys(mapped.chapters).length) setApiChapters((prev) => ({ ...prev, ...mapped.chapters }));
      })
      .catch(() => {
        /* TODO(api): 백엔드 미구현 — FALLBACK 유지 */
      });
    return () => {
      mounted = false;
    };
  }, [key]);

  const done = isLife
    ? curDays.filter((d) => d.status === 'past').length
    : Math.max(0, Math.min(list.length, apiDone[key] ?? FALLBACK[key] ?? 0));
  const currentNum = Math.min(list.length, done + 1);
  const pct = list.length ? Math.round((done / list.length) * 100) : 0; // 빈 목록이면 NaN% 방지
  const continueHref = isLife
    ? `${PATHS.STUDENT_GAME}?subject=${encodeURIComponent(key)}&day=${curTodayDay ?? curDays[done]?.day ?? 1}`
    : `${PATHS.STUDENT_GAME}?subject=${encodeURIComponent(key)}&chapter=${currentNum}`;
  const conceptHref = `${PATHS.STUDENT_CONCEPTS}?tab=${encodeURIComponent(key)}`;

  const openChapter = (num: number, locked: boolean) => {
    // 생활: 일차 커리큘럼으로 진입 — 지난날은 복습(replay), 미래 일차는 잠금(주제만 미리보기)
    if (isLife) {
      const d = curDays[num - 1];
      if (!d) return;
      if (d.status === 'future') {
        flash(`이 주제는 ${d.day}일차에 열려요 — 「${d.topic}」 🐾`);
        return;
      }
      if (d.playable_count === 0) {
        flash('이 날 문제는 준비 중이에요 🐾');
        return;
      }
      navigate(
        `${PATHS.STUDENT_GAME}?subject=${encodeURIComponent(key)}&day=${d.day}${d.status === 'past' ? '&replay=1' : ''}`,
      );
      return;
    }
    if (locked) {
      flash('이전 챕터를 먼저 완료해봐요 🐾');
      return;
    }
    // 복습 여부는 서버가 판정한다(ChapterProgress 기준 — 완주 단계 재플레이는 자동 미적립).
    // 이 화면의 done은 옛 진도 축(chapters_done)이라 주간 챕터 완주 판정에 쓰면 어긋난다.
    navigate(`${PATHS.STUDENT_GAME}?subject=${encodeURIComponent(key)}&chapter=${num}`);
  };

  const themeVars = {
    '--cm-color': s.color,
    '--cm-soft': s.soft,
    '--cm-ring': s.ring,
    '--cm-grad': s.grad,
  } as CSSProperties;

  return (
    <div className="cm-root" style={themeVars} data-screen-label="챕터 지도">
      {/* NAV (축소 NAV — 원본 그대로) */}
      <div className="cm-nav">
        <div className="cm-navinner">
          <Link to={PATHS.STUDENT_HOME} className="cm-back">
            <i className="ph-bold ph-arrow-left" />뒤로
          </Link>
          <Link to={PATHS.STUDENT_HOME} className="cm-navlogo">
            <img src={mascot} alt="CatChap" className="cm-navlogoimg" />
            <span className="cm-navlogotitle">CatChap</span>
          </Link>
          <div className="cm-navspacer" />
          <Link to={PATHS.STUDENT_SEARCH} title="검색" className="cm-navsearch">
            <i className="ph-bold ph-magnifying-glass" />
          </Link>
        </div>
      </div>

      <div className="cm-container">
        {/* SUBJECT HEADER */}
        <section className="cm-hero-section">
          <div className="cm-hero">
            <div className="cm-hero-orb1" />
            <div className="cm-hero-orb2" />
            <div className="cm-hero-row">
              <span className="cm-hero-icon">
                <i className={s.icon} />
              </span>
              <div className="cm-hero-body">
                <span className="cm-hero-tag">과목 학습</span>
                <h1 className="cm-hero-title">{key}</h1>
              </div>
              <Link to={continueHref} className="cm-continue">
                <i className="ph-fill ph-play-circle" />이어서 하기
              </Link>
            </div>
            <div className="cm-hero-progress">
              <div className="cm-progress-head">
                <span className="cm-progress-label">{isLife ? '교육과정 진행' : '챕터 진행'}</span>
                <span className="cm-progress-count">
                  {isLife ? `오늘은 ${curTodayDay ?? done + 1}일차 · 지난 ${done}일은 복습할 수 있어요` : `${list.length}챕터 중 ${done}개 완료`}
                </span>
              </div>
              <div className="cm-progress-track">
                <div className="cm-progress-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        </section>

        {/* CHAPTER SKILL MAP */}
        <section className="cm-map">
          {list.map((ch, i) => {
            const num = i + 1;
            const isDone = i < done;
            const isCurrent = i === done;
            const isLocked = i > done;
            const state = isDone ? 'done' : isCurrent ? 'current' : 'locked';
            const nodeTitle = isDone
              ? `${ch.name} · ${isLife ? '복습할 수 있어요 (코인 없음)' : '다시 도전할 수 있어요'}`
              : isCurrent
                ? `${ch.name} · ${isLife ? '오늘의 과제!' : '지금 도전해요'}`
                : isLife
                  ? `${ch.name} · 아직 잠겨 있어요 (주제 미리보기)`
                  : '이전 챕터를 먼저 완료해봐요';
            const nodeIcon = isDone ? 'ph-fill ph-check-fat' : isCurrent ? 'ph-fill ph-star' : 'ph-fill ph-lock-simple';
            const pillIcon = isDone ? 'ph-fill ph-arrow-clockwise' : isCurrent ? 'ph-fill ph-play-circle' : 'ph-fill ph-moon-stars';
            const pillText = isDone ? (isLife ? '복습하기' : '다시 하기') : isCurrent ? (isLife ? '오늘 과제!' : '도전!') : '다음에 만나요';

            return (
              <div key={num} className="cm-row">
                {/* node column */}
                <div className="cm-nodecol">
                  {i > 0 && <span className={`cm-connector${isLocked ? '' : ' cm-connector-on'}`} />}
                  {isCurrent && <span className="cm-ring" />}
                  <div
                    className={`cm-node cm-node-${state}`}
                    title={nodeTitle}
                    onClick={() => openChapter(num, isLocked)}
                  >
                    <i className={nodeIcon} />
                  </div>
                  {isCurrent && <span className="cm-here">지금 여기</span>}
                </div>

                {/* info card */}
                <div className={`cm-card cm-card-${state}`} onClick={() => openChapter(num, isLocked)}>
                  <div className="cm-card-body">
                    <div className="cm-card-tags">
                      <span className={`cm-tag cm-tag-${state}`}>
                        {isLife ? `${curDays[i]?.day ?? num}일차` : `챕터 ${num}`}
                      </span>
                      {isDone && (
                        <span className="cm-stars">
                          <i className="ph-fill ph-star" />
                          <i className="ph-fill ph-star" />
                          <i className="ph-fill ph-star" />
                        </span>
                      )}
                    </div>
                    <div className={`cm-card-title${isLocked ? ' cm-title-locked' : ''}`}>{ch.name}</div>
                    <div className={`cm-card-sub cm-sub-${state}`}>
                      {ch.name} · 문제 {ch.count}개
                    </div>
                  </div>
                  <span className={`cm-pill cm-pill-${state}`}>
                    <i className={pillIcon} />
                    {pillText}
                  </span>
                </div>

                {/* mascot at current node */}
                {isCurrent && (
                  <div className="cm-mascotcol">
                    <div className="cm-bubble">
                      여기서
                      <br />
                      이어서 해요!
                      <div className="cm-bubble-tail" />
                    </div>
                    <img src={mascot} alt="냥냥이" className="cm-mascotimg" />
                  </div>
                )}
              </div>
            );
          })}

          {/* finish flag */}
          <div className="cm-row">
            <div className="cm-nodecol">
              <span className="cm-connector" />
              <div className="cm-flag">
                <i className="ph-fill ph-flag-checkered" />
              </div>
            </div>
            <div className="cm-finish-card">
              <div className="cm-finish-title">{key} 완주!</div>
              <div className="cm-finish-sub">모든 챕터를 마치면 특별 배지를 받아요 🏅</div>
            </div>
          </div>
        </section>
      </div>

      {/* TOAST */}
      {toast && (
        <div className="cm-toast">
          <i className="ph-fill ph-lock-simple cm-toast-lock" />
          {toast}
          <Link to={conceptHref} className="cm-toast-link">
            <i className="ph-fill ph-book-bookmark" />개념 먼저 보기
          </Link>
        </div>
      )}

      <ScreenTimeReminder />
    </div>
  );
}
