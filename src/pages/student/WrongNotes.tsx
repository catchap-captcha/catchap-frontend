import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { studentApi } from '../../api/students';
import mascot from '../../assets/characters/catchap-logo.png';
import './WrongNotes.css';
import { StudentNav } from '../../layouts/StudentLayout';

/* eslint-disable @typescript-eslint/no-explicit-any */

type Cat = 'word' | 'num' | 'img' | 'safe' | 'soc' | 'eng';
type FilterKey = 'all' | Cat;

interface WrongItem {
  cat: Cat;
  subject?: string; // 실제 과목명(국어/수학/…) — 카드 표시는 이걸 쓴다(없으면 카테고리→과목 폴백)
  question: string;
  /** 틀린 횟수 — SRS wrong 상자의 wrong_count(결정 ④: '내 답' 텍스트 기록은 은퇴) */
  wrongCount: number;
  answer: string;
  tip: string;
  date: string;
}

// 필터 칩 — 카테고리는 과목과 1:1이라 라벨을 실제 과목명으로(오답노트 과목 정합)
const CHIPS: { key: FilterKey; label: string; icon: string }[] = [
  { key: 'all', label: '전체', icon: 'ph-fill ph-squares-four' },
  { key: 'word', label: '국어', icon: 'ph-fill ph-text-aa' },
  { key: 'num', label: '수학', icon: 'ph-fill ph-plus-minus' },
  { key: 'img', label: '과학', icon: 'ph-fill ph-flask' },
  { key: 'safe', label: '생활', icon: 'ph-fill ph-shield-check' },
  { key: 'soc', label: '사회', icon: 'ph-fill ph-scroll' },
  { key: 'eng', label: '영어', icon: 'ph-fill ph-translate' },
];

/** subject: "다시 풀기" → 게임화면 `?subject=` 매핑 (HANDOFF_ROUTE_MAP의 깨진 링크 통일 규칙) */
const TAG: Record<Cat, { label: string; icon: string; c: string; bg: string; subject: string }> = {
  word: { label: '낱말·한글', icon: 'ph-fill ph-text-aa', c: '#FF5A6E', bg: '#FFE3E9', subject: '국어' },
  num: { label: '수·연산', icon: 'ph-fill ph-plus-minus', c: '#FF922E', bg: '#FFEDE0', subject: '수학' },
  img: { label: '과학', icon: 'ph-fill ph-flask', c: '#2E7BFF', bg: '#E6F0FF', subject: '과학' },
  safe: { label: '생활 안전', icon: 'ph-fill ph-shield-check', c: '#8B6BFF', bg: '#EDE6FF', subject: '생활' },
  soc: { label: '사회·문화', icon: 'ph-fill ph-scroll', c: '#17B08C', bg: '#DFF6EE', subject: '사회' },
  eng: { label: '영어·어휘', icon: 'ph-fill ph-translate', c: '#E0489E', bg: '#FCE4F1', subject: '영어' },
};

/**
 * GET /students/me/wrong-notes 응답 → WrongItem[] 매핑 ('틀린 문제' 뷰 — Q 통합 결정 ④).
 * 응답 형태: { items: [{ id, cat, subject, question, answer, tip, date, wrong_count }],
 *             summary: { total, by_category }, tags: {...} }
 * 목록은 SRS wrong 상자의 뷰라 다시 맞히면 서버에서 자동으로 빠진다(복습완료 개념 은퇴).
 */
function mapWrongNotes(d: any): { items: WrongItem[]; total: number } {
  const list = Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : [];
  const items = list
    .filter(
      (it: any) => it && typeof it.cat === 'string' && it.cat in TAG && typeof it.question === 'string',
    )
    .map(
      (it: any): WrongItem => ({
        cat: it.cat as Cat,
        subject: typeof it.subject === 'string' && it.subject ? it.subject : TAG[it.cat as Cat].subject,
        question: it.question,
        wrongCount: typeof it.wrong_count === 'number' ? it.wrong_count : 1,
        answer: it.answer ?? '',
        tip: it.tip ?? '',
        date: it.date ?? '',
      }),
    );
  const total = typeof d?.summary?.total === 'number' ? d.summary.total : items.length;
  return { items, total };
}

export default function WrongNotes() {
  const [items, setItems] = useState<WrongItem[]>([]);
  const [loaded, setLoaded] = useState(false); // 실패 시 가짜 데이터 대신 정직한 빈/에러 상태
  const [filter, setFilter] = useState<FilterKey>('all');

  useEffect(() => {
    let mounted = true;
    studentApi
      .wrongNotes()
      .then((d: any) => {
        if (!mounted) return;
        setItems(mapWrongNotes(d).items);
        setLoaded(true);
      })
      .catch(() => {
        if (mounted) setLoaded(true); // 실패 → 빈 목록(데모 오답을 실데이터처럼 보이지 않게)
      });
    return () => {
      mounted = false;
    };
  }, []);

  const visible = items.filter((i) => filter === 'all' || i.cat === filter);
  // 다시 풀기 = 오늘의 Q로 — 틀린 문항이 어차피 최우선 출제라 별도 복습 모드가 필요 없다
  const solveAllSubject =
    filter !== 'all' ? TAG[filter].subject : visible[0] ? TAG[visible[0].cat].subject : '국어';

  return (
    <div className="wn-root">
      {/* NAV — 원본 오답노트 NAV(1160px, 알림 버튼 없음)라 학습 홈 공용 NAV와 구조가 달라 자체 구현 */}
      {/* NAV — 공용 StudentNav로 통일(사용자 결정 0714) */}
      <StudentNav />

      {/* HEADER */}
      <section className="wn-head">
        <div className="wn-headrow">
          <span className="wn-headicon">
            <i className="ph-fill ph-notebook" />
          </span>
          <div>
            <h1 className="wn-title">틀린 문제</h1>
            <p className="wn-subtitle">다시 맞히면 목록에서 자동으로 사라져요 — 오늘의 Q가 틀린 문제부터 내줘요</p>
          </div>
        </div>

        {/* summary — SRS wrong 상자의 뷰라 '복습 완료/진행률' 개념이 없다(맞히면 이탈) */}
        <div className="wn-summary">
          <div className="wn-sumitem">
            <span className="wn-sumicon wn-sumicon-x">
              <i className="ph-fill ph-x-circle" />
            </span>
            <div>
              <div className="wn-sumval">
                {items.length}<span className="wn-sumunit">개</span>
              </div>
              <div className="wn-sumlabel">다시 만날 문제</div>
            </div>
          </div>
          <Link
            to={`${PATHS.STUDENT_GAME}?subject=${encodeURIComponent(solveAllSubject)}&bank=1`}
            className="wn-solveall"
          >
            <i className="ph-fill ph-arrows-clockwise" />오늘의 Q에서 다시 풀기
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

      {/* WRONG ANSWER LIST — SRS wrong 상자 뷰(비면 그 자체가 좋은 소식) */}
      {loaded && visible.length === 0 && (
        <section className="wn-footwrap">
          <div className="wn-empty">
            <i className="ph-fill ph-confetti" />
            <h3>지금 틀린 문제가 없어요!</h3>
            <p>문제를 풀다 틀리면 여기에 모여요. 다시 맞히면 자동으로 사라진답니다.</p>
          </div>
        </section>
      )}
      <section className="wn-grid">
        {visible.map((q) => {
          const t = TAG[q.cat];
          return (
            <div key={q.question} className="wn-card">
              <div className="wn-cardhead">
                {/* 태그 = 실제 과목명(q.subject) — 카테고리 라벨('이미지 선택' 등)이 아니라
                    정확한 과목이 보이게. 색·아이콘은 카테고리 테마 유지. */}
                <span className="wn-tag" style={{ background: t.bg, color: t.c }}>
                  <i className={t.icon} />
                  {q.subject || t.subject}
                </span>
                <span className="wn-date">{q.date}</span>
              </div>
              <div className="wn-question">{q.question}</div>
              <div className="wn-answers">
                {/* '내 답' 텍스트는 결정 ④로 은퇴 — SRS wrong_count(틀린 횟수)로 대체 */}
                <div className="wn-wrongbox">
                  <span className="wn-wrongmark">
                    <i className="ph-bold ph-x" />
                  </span>
                  <span className="wn-wronglabel">틀린 횟수</span>
                  <span className="wn-wrongval">{q.wrongCount}번</span>
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
                {/* Q(bank=1)로 진입 — SRS가 틀린 문항을 최우선 출제하므로 별도 복습 모드 불필요 */}
                <Link
                  to={`${PATHS.STUDENT_GAME}?subject=${encodeURIComponent(t.subject)}&bank=1`}
                  className="wn-retry"
                >
                  <i className="ph-fill ph-arrow-counter-clockwise" />다시 풀기
                </Link>
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
