import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { useAuth } from '../../hooks/useAuth';
import { studentApi } from '../../api/students';
import mascot from '../../assets/characters/catchap-logo.png';
import './WrongNotes.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

type Cat = 'word' | 'num' | 'img' | 'safe' | 'soc' | 'eng';
type FilterKey = 'all' | Cat;

interface WrongItem {
  cat: Cat;
  question: string;
  wrong: string;
  answer: string;
  tip: string;
  date: string;
}

const CHIPS: { key: FilterKey; label: string; icon: string }[] = [
  { key: 'all', label: '전체', icon: 'ph-fill ph-squares-four' },
  { key: 'word', label: '낱말·한글', icon: 'ph-fill ph-text-aa' },
  { key: 'num', label: '수·연산', icon: 'ph-fill ph-plus-minus' },
  { key: 'img', label: '이미지 선택', icon: 'ph-fill ph-image' },
  { key: 'safe', label: '생활 안전', icon: 'ph-fill ph-shield-check' },
  { key: 'soc', label: '사회·문화', icon: 'ph-fill ph-scroll' },
  { key: 'eng', label: '영어·어휘', icon: 'ph-fill ph-translate' },
];

/** subject: "다시 풀기" → 게임화면 `?subject=` 매핑 (HANDOFF_ROUTE_MAP의 깨진 링크 통일 규칙) */
const TAG: Record<Cat, { label: string; icon: string; c: string; bg: string; subject: string }> = {
  word: { label: '낱말·한글', icon: 'ph-fill ph-text-aa', c: '#FF5A6E', bg: '#FFE3E9', subject: '국어' },
  num: { label: '수·연산', icon: 'ph-fill ph-plus-minus', c: '#FF922E', bg: '#FFEDE0', subject: '수학' },
  img: { label: '이미지 선택', icon: 'ph-fill ph-image', c: '#2E7BFF', bg: '#E6F0FF', subject: '과학' },
  safe: { label: '생활 안전', icon: 'ph-fill ph-shield-check', c: '#8B6BFF', bg: '#EDE6FF', subject: '생활' },
  soc: { label: '사회·문화', icon: 'ph-fill ph-scroll', c: '#17B08C', bg: '#DFF6EE', subject: '사회' },
  eng: { label: '영어·어휘', icon: 'ph-fill ph-translate', c: '#E0489E', bg: '#FCE4F1', subject: '영어' },
};

// TODO(api): studentApi.wrongNotes() 실패 시 원본 하드코딩 데이터 유지
const FALLBACK: WrongItem[] = [
  { cat: 'img', question: '고양이는 모두 몇 마리일까요?', wrong: '강아지도 골랐어요', answer: '고양이 3마리만', tip: '고양이는 귀가 뾰족하고 수염이 길어요. 귀 모양부터 살펴보면 쉬워요!', date: '오늘' },
  { cat: 'num', question: '7 + 5 = ?', wrong: '11', answer: '12', tip: '7에서 3을 더하면 10, 남은 2를 더하면 12! 10을 먼저 만들어 보세요.', date: '오늘' },
  { cat: 'word', question: '그림에 알맞은 받침은? (고ㅇ이)', wrong: 'ㅁ', answer: 'ㅇ (고양이)', tip: '"고양이"를 천천히 소리 내보면 "양"에서 ㅇ 받침이 들려요.', date: '어제' },
  { cat: 'word', question: '"바ㄷ" 에 알맞은 받침은?', wrong: 'ㅅ', answer: 'ㄷ (받다)', tip: '끝소리가 "ㄷ"으로 나는지 "ㅅ"으로 나는지 입 모양을 확인해요.', date: '어제' },
  { cat: 'safe', question: '횡단보도에서 바른 행동은?', wrong: '빨간불에 뛰기', answer: '초록불에 손들고 건너기', tip: '초록불에도 좌우를 살피고 손을 들어 운전자에게 알려요.', date: '2일 전' },
  { cat: 'img', question: '생선을 모두 골라요', wrong: '문어를 골랐어요', answer: '생선 2마리', tip: '생선은 지느러미와 비늘이 있어요. 문어는 다리가 많답니다!', date: '3일 전' },
];

/**
 * GET /students/me/wrong-notes 응답 → WrongItem[] 매핑.
 * 실제 응답 형태: { items: [{ id, cat, subject, question, wrong, answer, tip, date, reviewed, tag{...} }],
 *                 summary: { total, pending, reviewed, by_category }, tags: {...} }
 * 카드에 필요한 필드만 추출한다. (tag 색/아이콘은 cat 기준 TAG 테마와 동일해 디자인 값을 유지)
 */
function mapWrongNotes(d: any): {
  items: WrongItem[] | null;
  pending: number | null;
  reviewed: number | null;
} {
  const list = Array.isArray(d) ? d : Array.isArray(d.items) ? d.items : null;
  let items: WrongItem[] | null = null;
  if (list) {
    const valid = list.filter(
      (it: any) => it && typeof it.cat === 'string' && it.cat in TAG && typeof it.question === 'string',
    );
    if (valid.length) {
      items = valid.map((it: any): WrongItem => ({
        cat: it.cat as Cat,
        question: it.question,
        wrong: it.wrong ?? '',
        answer: it.answer ?? '',
        tip: it.tip ?? '',
        date: it.date ?? '',
      }));
    }
  }
  const s = d?.summary ?? {};
  const pending =
    typeof s.pending === 'number'
      ? s.pending
      : typeof s.total === 'number'
        ? s.total
        : items
          ? items.length
          : null;
  // 복습 완료 수: wrong_answers.reviewed 실데이터
  const reviewed = typeof s.reviewed === 'number' ? s.reviewed : null;
  return { items, pending, reviewed };
}

export default function WrongNotes() {
  const { me } = useAuth();
  const [items, setItems] = useState<WrongItem[]>(FALLBACK);
  const [pendingCount, setPendingCount] = useState(6);
  const [reviewedCount, setReviewedCount] = useState(14);
  const [filter, setFilter] = useState<FilterKey>('all');

  useEffect(() => {
    let mounted = true;
    studentApi
      .wrongNotes()
      .then((d: any) => {
        if (!mounted || !d) return;
        const mapped = mapWrongNotes(d);
        if (mapped.items) setItems(mapped.items);
        if (typeof mapped.pending === 'number') setPendingCount(mapped.pending);
        if (typeof mapped.reviewed === 'number') setReviewedCount(mapped.reviewed);
      })
      .catch(() => {
        // TODO(api): 백엔드 미구현/실패 시 FALLBACK 유지
      });
    return () => {
      mounted = false;
    };
  }, []);

  const name = (me?.name ?? '하은').trim() || '하은';
  const visible = items.filter((i) => filter === 'all' || i.cat === filter);
  // 오답 모아 풀기: 현재 필터 과목(전체면 첫 오답 과목, 없으면 생활)으로 복습 세션 진입
  const solveAllSubject =
    filter !== 'all' ? TAG[filter].subject : visible[0] ? TAG[visible[0].cat].subject : '생활';
  // 복습 진행률 = 복습 완료 / (복습 완료 + 남은 문제)
  const reviewTotal = reviewedCount + pendingCount;
  const reviewPct = reviewTotal > 0 ? Math.round((reviewedCount / reviewTotal) * 100) : 0;

  return (
    <div className="wn-root">
      {/* NAV — 원본 오답노트 NAV(1160px, 알림 버튼 없음)라 학습 홈 공용 NAV와 구조가 달라 자체 구현 */}
      <div className="wn-navbar">
        <div className="wn-navinner">
          <Link to={PATHS.STUDENT_HOME} className="wn-logo">
            <img src={mascot} alt="CatChap" className="wn-logoimg" />
            <div className="wn-logotext">
              <span className="wn-logotitle">CatChap</span>
              <span className="wn-logosub">놀면서 배우는 캡챠 학습</span>
            </div>
          </Link>
          <nav className="wn-menu">
            <Link to={PATHS.STUDENT_HOME} className="wn-navlink">
              홈
            </Link>
            <Link to={PATHS.STUDENT_ALL_LEARNING} className="wn-navlink">
              전체 학습
            </Link>
            <Link to={PATHS.STUDENT_CONCEPTS} className="wn-navlink">
              개념 설명
            </Link>
            <Link to={PATHS.STUDENT_AI_TEACHER} className="wn-navlink">
              AI 선생님
            </Link>
            <Link to={PATHS.STUDENT_RECORDS} className="wn-navlink">
              나의 기록
            </Link>
          </nav>
          <div className="wn-navright">
            <Link to={PATHS.STUDENT_SEARCH} title="검색" className="wn-iconbtn">
              <i className="ph-bold ph-magnifying-glass" />
            </Link>
            <Link to={PATHS.STUDENT_PROFILE} title="마이페이지" className="wn-profile">
              <div className="wn-avatar">{name.charAt(0)}</div>
              <span className="wn-profilename">{name}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* HEADER */}
      <section className="wn-head">
        <div className="wn-headrow">
          <span className="wn-headicon">
            <i className="ph-fill ph-notebook" />
          </span>
          <div>
            <h1 className="wn-title">오답 노트</h1>
            <p className="wn-subtitle">틀린 문제를 다시 풀면 실력이 쑥쑥 자라요</p>
          </div>
        </div>

        {/* summary + progress */}
        <div className="wn-summary">
          <div className="wn-sumitem">
            <span className="wn-sumicon wn-sumicon-x">
              <i className="ph-fill ph-x-circle" />
            </span>
            <div>
              <div className="wn-sumval">
                {pendingCount}<span className="wn-sumunit">개</span>
              </div>
              <div className="wn-sumlabel">복습할 문제</div>
            </div>
          </div>
          <div className="wn-sumdivider" />
          <div className="wn-sumitem">
            <span className="wn-sumicon wn-sumicon-ok">
              <i className="ph-fill ph-check-circle" />
            </span>
            <div>
              <div className="wn-sumval">
                {reviewedCount}<span className="wn-sumunit">개</span>
              </div>
              <div className="wn-sumlabel">복습 완료</div>
            </div>
          </div>
          <div className="wn-progress">
            <div className="wn-progresshead">
              <span>복습 진행률</span>
              <span className="wn-progresspct">{reviewPct}%</span>
            </div>
            <div className="wn-progressbar">
              <div className="wn-progressfill" style={{ width: `${reviewPct}%` }} />
            </div>
          </div>
          <Link
            to={`${PATHS.STUDENT_GAME}?subject=${encodeURIComponent(solveAllSubject)}&replay=1`}
            className="wn-solveall"
          >
            <i className="ph-fill ph-arrows-clockwise" />오답 모아 풀기
          </Link>
        </div>

        {/* filter chips */}
        <div className="wn-chips">
          {CHIPS.map((c) => (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              className={`wn-chip${filter === c.key ? ' wn-chip-on' : ''}`}
            >
              <i className={c.icon} />
              {c.label}
            </button>
          ))}
        </div>
      </section>

      {/* WRONG ANSWER LIST */}
      <section className="wn-grid">
        {visible.map((q) => {
          const t = TAG[q.cat];
          return (
            <div key={q.question} className="wn-card">
              <div className="wn-cardhead">
                <span className="wn-tag" style={{ background: t.bg, color: t.c }}>
                  <i className={t.icon} />
                  {t.label}
                </span>
                <span className="wn-date">{q.date}</span>
              </div>
              <div className="wn-question">{q.question}</div>
              <div className="wn-answers">
                <div className="wn-wrongbox">
                  <span className="wn-wrongmark">
                    <i className="ph-bold ph-x" />
                  </span>
                  <span className="wn-wronglabel">내 답</span>
                  <span className="wn-wrongval">{q.wrong}</span>
                </div>
                <div className="wn-rightbox">
                  <span className="wn-rightmark">
                    <i className="ph-bold ph-check" />
                  </span>
                  <span className="wn-rightlabel">정답</span>
                  <span className="wn-rightval">{q.answer}</span>
                </div>
              </div>
              <div className="wn-tip">
                <i className="ph-fill ph-lightbulb" />
                <p>{q.tip}</p>
              </div>
              <div className="wn-actions">
                {/* 복습 모드(replay=1): 기록은 남지만 오늘의퀴즈 상태·코인 중복 반영 없음 */}
                <Link
                  to={`${PATHS.STUDENT_GAME}?subject=${encodeURIComponent(t.subject)}&replay=1`}
                  className="wn-retry"
                >
                  <i className="ph-fill ph-arrow-counter-clockwise" />다시 풀기
                </Link>
                <button className="wn-explain">
                  <i className="ph-fill ph-robot" />설명 듣기
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {/* ENCOURAGING FOOTER */}
      <section className="wn-footwrap">
        <div className="wn-foot">
          <div className="wn-footimg">
            <img src={mascot} alt="" />
          </div>
          <div className="wn-foottext">
            <h3>틀려도 괜찮아요!</h3>
            <p>오답은 실력이 자라는 씨앗이에요. 다시 풀어보면 어느새 완벽하게 알게 될 거예요. 🌱</p>
          </div>
        </div>
      </section>
    </div>
  );
}
