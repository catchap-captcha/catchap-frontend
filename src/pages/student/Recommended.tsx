import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { useAuth } from '../../hooks/useAuth';
import { studentApi } from '../../api/students';
import ScreenTimeReminder from '../../components/motion/ScreenTimeReminder';
import mascot from '../../assets/characters/catchap-logo.png';
import './Recommended.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

type Priority = '우선' | '보통' | '낮음';

interface RecItem {
  title: string;
  subject: string;
  cat: string;
  chapter: number;
  priority: Priority;
  reason: string;
  icon: string;
  bg: string;
  color: string;
}

/* 과목별 아이콘/색 (원본 REC의 스타일 값 그대로 — API 항목 매핑용) */
const SUBJECT_STYLE: Record<string, { icon: string; bg: string; color: string }> = {
  '국어': { icon: 'ph-fill ph-book-open', bg: '#FFE0DB', color: '#FF5A4D' },
  '영어': { icon: 'ph-fill ph-translate', bg: '#FFEDD6', color: '#FF922E' },
  '수학': { icon: 'ph-fill ph-plus-minus', bg: '#DFF6EE', color: '#17B08C' },
  '과학': { icon: 'ph-fill ph-flask', bg: '#E1EDFF', color: '#2E7BFF' },
  '사회': { icon: 'ph-fill ph-scroll', bg: '#EAE2FF', color: '#8B6BFF' },
  '생활': { icon: 'ph-fill ph-house-line', bg: '#FFE3EF', color: '#FF6DA6' },
};

// TODO(api): studentApi.recommendations() 실패 시 원본 하드코딩 REC 유지
const FALLBACK: RecItem[] = [
  { title: '두 수 모아 더하기', subject: '수학', cat: '수학', chapter: 2, priority: '우선', reason: '최근 더하기 문제 3개 중 2개를 틀렸어요.', icon: 'ph-fill ph-plus-minus', bg: '#DFF6EE', color: '#17B08C' },
  { title: '동물 친구 관찰하기', subject: '과학', cat: '과학', chapter: 1, priority: '우선', reason: '정답을 골랐다가 자주 바꿨어요. 한 번 더 연습!', icon: 'ph-fill ph-flask', bg: '#E1EDFF', color: '#2E7BFF' },
  { title: '받침 있는 낱말 찾기', subject: '국어', cat: '국어', chapter: 2, priority: '보통', reason: '비슷한 낱말에서 살짝 헷갈렸어요.', icon: 'ph-fill ph-book-open', bg: '#FFE0DB', color: '#FF5A4D' },
  { title: '알파벳 소리 맞히기', subject: '영어', cat: '영어', chapter: 2, priority: '보통', reason: '파닉스 소리에서 헷갈린 적이 있어요.', icon: 'ph-fill ph-translate', bg: '#FFEDD6', color: '#FF922E' },
  { title: '위인 이야기 떠올리기', subject: '사회', cat: '사회', chapter: 2, priority: '낮음', reason: '대체로 잘했지만 한 문제만 다시 볼까요?', icon: 'ph-fill ph-scroll', bg: '#EAE2FF', color: '#8B6BFF' },
  { title: '안전한 행동 고르기', subject: '생활', cat: '생활', chapter: 1, priority: '낮음', reason: '상황을 보고 바른 행동을 한 번 더 골라봐요.', icon: 'ph-fill ph-house-line', bg: '#FFE3EF', color: '#FF6DA6' },
];

/* 원본 CHIPS 그대로 */
const CHIPS = [
  { key: 'all', label: '전체' },
  { key: '국어', label: '국어' },
  { key: '영어', label: '영어' },
  { key: '수학', label: '수학' },
  { key: '과학', label: '과학' },
  { key: '사회', label: '사회' },
  { key: '생활', label: '생활' },
];

/* 원본 priStyle() → 접두사 클래스 */
const priClass = (p: Priority) =>
  p === '우선' ? 'rc-pri rc-pri-hot' : p === '보통' ? 'rc-pri rc-pri-mid' : 'rc-pri rc-pri-low';

const NAV_LINKS = [
  { label: '홈', to: PATHS.STUDENT_HOME },
  { label: '전체 학습', to: PATHS.STUDENT_ALL_LEARNING },
  { label: '개념 설명', to: PATHS.STUDENT_CONCEPTS },
  { label: 'AI 선생님', to: PATHS.STUDENT_AI_TEACHER },
  { label: '나의 기록', to: PATHS.STUDENT_RECORDS },
];

/** API 실패 시 원본 분석 요약 문구 유지 (**…**는 <b> 렌더 구간) */
const FALLBACK_SUMMARY =
  '**수학 · 더하기**에서 오답이 가장 많았고, **과학 · 그림 관찰**에서 선택을 자주 바꿨어요. 아래 5문제를 풀면 약한 부분이 쑥 올라가요!';

/** "**굵게**" 마커 문자열 → <b> 섞인 노드 배열 */
function renderBold(text: string) {
  return text.split('**').map((part, i) => (i % 2 === 1 ? <b key={i}>{part}</b> : part));
}

export default function Recommended() {
  const { me } = useAuth();
  const name = (me?.name ?? '하은').trim() || '하은';

  const [filter, setFilter] = useState('all');
  const [recs, setRecs] = useState<RecItem[]>(FALLBACK);
  const [coins, setCoins] = useState<number>(me?.student?.coins ?? 340);
  const [summary, setSummary] = useState<string>(FALLBACK_SUMMARY);

  useEffect(() => {
    let mounted = true;
    studentApi
      .recommendations()
      .then((d: any) => {
        if (!mounted) return;
        if (typeof d?.coins === 'number') setCoins(d.coins); // NAV 냥코인 칩
        if (typeof d?.summary === 'string' && d.summary) setSummary(d.summary);
        const list = Array.isArray(d) ? d : Array.isArray(d?.recommendations) ? d.recommendations : null;
        if (!list) return;
        /* API 항목: {title,subject,chapter,priority,reason,meta{icon,soft,color}}
         * meta 값 우선 사용, 없으면 SUBJECT_STYLE 폴백. 원본 디자인처럼 우선순위순 정렬 */
        const PRI_ORDER: Record<Priority, number> = { 우선: 0, 보통: 1, 낮음: 2 };
        const mapped = list
          .map((r: any): RecItem | null => {
            const subject = typeof r?.subject === 'string' ? r.subject : '';
            const style = SUBJECT_STYLE[subject];
            const meta = r?.meta;
            if ((!style && !meta) || typeof r?.title !== 'string') return null;
            return {
              title: r.title,
              subject,
              cat: typeof r.cat === 'string' ? r.cat : subject,
              chapter: typeof r.chapter === 'number' ? r.chapter : 1,
              priority: r.priority === '우선' || r.priority === '보통' || r.priority === '낮음' ? r.priority : '보통',
              reason: typeof r.reason === 'string' ? r.reason : '',
              icon: typeof meta?.icon === 'string' ? meta.icon : style?.icon ?? 'ph-fill ph-book-open',
              bg: typeof meta?.soft === 'string' ? meta.soft : style?.bg ?? '#FFE0DB',
              color: typeof meta?.color === 'string' ? meta.color : style?.color ?? '#FF5A4D',
            };
          })
          .filter((r: RecItem | null): r is RecItem => r !== null)
          .sort((a: RecItem, b: RecItem) => PRI_ORDER[a.priority] - PRI_ORDER[b.priority]);
        if (mapped.length > 0) setRecs(mapped);
      })
      .catch(() => {
        // TODO(api): 백엔드 미구현/실패 시 FALLBACK 유지
      });
    return () => {
      mounted = false;
    };
  }, []);

  const visible = recs.filter((r) => filter === 'all' || r.cat === filter);
  /* "모두 풀기" 시작점: 정렬된 추천 목록의 최우선 항목 (원본 하드코딩: 수학 2챕터) */
  const startRec = recs[0];

  return (
    <div className="rc-root">
      {/* NAV (원본 그대로 — 코인 표시/이니셜 아바타 등 학습 홈 NAV와 구조가 달라 자체 구현) */}
      <div className="rc-nav">
        <div className="rc-navinner">
          <Link to={PATHS.STUDENT_HOME} className="rc-navlogo">
            <img src={mascot} alt="CatChap" className="rc-navlogoimg" />
            <div className="rc-navlogotext">
              <span className="rc-navtitle">CatChap</span>
              <span className="rc-navsub">놀면서 배우는 캡챠 학습</span>
            </div>
          </Link>
          <nav className="rc-menu">
            {NAV_LINKS.map((l) => (
              <Link key={l.label} to={l.to} className="rc-navlink">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="rc-navright">
            <Link to={PATHS.STUDENT_SEARCH} title="검색" className="rc-navsearch">
              <i className="ph-bold ph-magnifying-glass" />
            </Link>
            <div className="rc-coins">
              <i className="ph-fill ph-coins" />
              <span className="rc-coinsnum">{coins}</span>
            </div>
            <Link to={PATHS.STUDENT_PROFILE} title="마이페이지" className="rc-profile">
              <div className="rc-avatar">{name.charAt(0)}</div>
              <span className="rc-profilename">{name}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* HERO */}
      <section className="rc-herosec">
        <div className="rc-hero">
          <div className="rc-herocircle" />
          <div className="rc-heromascotwrap">
            <img src={mascot} alt="마스코트" className="rc-heromascot" />
            <span className="rc-herospark">
              <i className="ph-fill ph-sparkle" />
            </span>
          </div>
          <div className="rc-herotext">
            <div className="rc-herobadge">
              <i className="ph-fill ph-robot" />
              취약 문제 추천 AI
            </div>
            <h1 className="rc-herotitle">다시 풀어보면 좋을 문제만 콕! 골랐어요 🎯</h1>
            <p className="rc-herodesc">
              최근 오답과 헷갈린 문제를 분석해서, 지금 연습하면 가장 도움이 될 문제를 추천해요.
            </p>
          </div>
        </div>
      </section>

      {/* AI SUMMARY */}
      <section className="rc-summarysec">
        <div className="rc-summary">
          <span className="rc-summaryicon">
            <i className="ph-fill ph-chart-donut" />
          </span>
          <div className="rc-summarybody">
            <div className="rc-summarytitle">이번 주 분석 요약</div>
            <p className="rc-summarytext">{renderBold(summary)}</p>
          </div>
        </div>
      </section>

      {/* FILTER CHIPS */}
      <section className="rc-chipsec">
        <div className="rc-chips">
          {CHIPS.map((c) => (
            <button
              key={c.key}
              className={`rc-chip${filter === c.key ? ' rc-chip-on' : ''}`}
              onClick={() => setFilter(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </section>

      {/* RECOMMENDED LIST */}
      <section className="rc-listsec">
        <div className="rc-list">
          {visible.map((r) => (
            <div key={`${r.subject}-${r.title}`} className="rc-item">
              <span className="rc-itemicon" style={{ background: r.bg, color: r.color }}>
                <i className={r.icon} />
              </span>
              <div className="rc-itembody">
                <div className="rc-itemhead">
                  <span className="rc-itemtitle">{r.title}</span>
                  <span className="rc-itemsubject" style={{ color: r.color, background: r.bg }}>
                    {r.subject}
                  </span>
                  <span className={priClass(r.priority)}>
                    <i className="ph-fill ph-fire" />
                    {r.priority}
                  </span>
                </div>
                <div className="rc-itemreason">
                  <i className="ph-fill ph-lightbulb" />
                  {r.reason}
                </div>
              </div>
              <Link
                to={`${PATHS.STUDENT_GAME}?subject=${encodeURIComponent(r.subject)}&chapter=${r.chapter}`}
                className="rc-solve"
              >
                풀어보기 <i className="ph-bold ph-arrow-right" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* START ALL */}
      <section className="rc-startsec">
        <Link
          to={`${PATHS.STUDENT_GAME}?subject=${encodeURIComponent(startRec?.subject ?? '수학')}&chapter=${startRec?.chapter ?? 2}`}
          className="rc-startall"
        >
          <i className="ph-fill ph-play-circle" />
          추천 문제 이어서 모두 풀기
        </Link>
      </section>

      <ScreenTimeReminder />
    </div>
  );
}
