import { useEffect, useState, type CSSProperties } from 'react';
import CountUp from '../../components/motion/CountUp';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { useAuth } from '../../hooks/useAuth';
import { studentApi } from '../../api/students';
import DemoBadge from '../../components/common/DemoBadge';
import './GameResult.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ResultEntry {
  solid: string;
  soft: string;
  cleared: number;
  correct: number;
  /** API도 '+150' 형태의 문자열 */
  score: string;
  time: string;
  streak: number;
  ai: string;
  /** 문제 수 — API total, 미제공 시 5 */
  total?: number;
}

// TODO(api): studentApi.result() 실패 시 원본 SUBJECTS 하드코딩 데이터 유지
const FALLBACK: Record<string, ResultEntry> = {
  '국어': { solid: '#ea5443', soft: '#FFE0DB', cleared: 5, correct: 5, score: '+150', time: '2:40', streak: 5, ai: '글의 의미를 정확히 파악했습니다. 이 과목의 이해도가 높습니다.' },
  '영어': { solid: '#FF922E', soft: '#FFEDD6', cleared: 3, correct: 4, score: '+90', time: '2:10', streak: 3, ai: '문장과 문법을 잘 이해했습니다. 틀린 문항만 다시 확인해 보세요.' },
  '수학': { solid: '#17B08C', soft: '#DFF6EE', cleared: 5, correct: 5, score: '+160', time: '3:05', streak: 5, ai: '계산과 도형 문항을 정확하게 풀었습니다. 이 과목의 이해도가 높습니다.' },
  '과학': { solid: '#2E7BFF', soft: '#E1EDFF', cleared: 2, correct: 4, score: '+95', time: '2:20', streak: 3, ai: '원리를 잘 이해했습니다. 틀린 문항을 다시 확인해 보세요.' },
  '사회': { solid: '#8B6BFF', soft: '#EAE2FF', cleared: 1, correct: 4, score: '+80', time: '2:05', streak: 3, ai: '개념을 잘 이해했습니다. 오답을 복습하면 이해도가 올라갑니다.' },
  '생활': { solid: '#FF6DA6', soft: '#FFE3EF', cleared: 1, correct: 4, score: '+110', time: '2:35', streak: 4, ai: '핵심 내용을 잘 이해했습니다. 오답을 다시 확인해 보세요.' },
};

/* (은퇴 0719, Q 통합 3단계-c) 학습 지도용 MAP/ORDER/TODAY_DONE 상수 삭제 —
   6과목 완료 지도 카드가 사라지며 소비처가 없어졌다. */

/** GameScreen이 넘겨주는 이번 세션 로컬 집계 — 서버 재조회 없이 정확한 결과 표시 */
interface SessState {
  subject: string;
  chapter: number | null;
  bank?: boolean; // 전체학습 무한 문제은행 — 단계/완주 대신 '연습 요약'
  startStage: number | null;
  lastDoneStage: number;
  finished: boolean;
  answered: number;
  correct: number;
  wrong: number;
  timeMs: number;
  replay: boolean;
  coins: number;
  bumpFailed?: boolean;
  startedIso: string;
}

function fmtTime(ms: number): string {
  const sec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

export default function GameResult() {
  const { me } = useAuth();
  const [apiNick, setApiNick] = useState<string | null>(null);
  const name = (me?.name ?? apiNick ?? '하은').trim() || '하은';
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  // 파라미터 소스: navigate state 우선(주소창 깔끔), 없으면 쿼리(딥링크 폴백)
  const navState = location.state as {
    sess?: SessState; day?: number | string | null; subject?: string;
  } | null;
  // 이번 세션 집계(GameScreen state) — 있으면 서버 집계보다 우선(챕터/중도종료도 정확)
  const sess = (navState?.sess ?? null) as SessState | null;
  const dayVal = navState?.day ?? searchParams.get('day') ?? null;
  // 복습 비교: 지난 기록 정답률(이번 세션 시작 이전 시도만)
  const [lastAccuracy, setLastAccuracy] = useState<number | null>(null);
  useEffect(() => {
    if (!sess?.replay || !sess.chapter) return;
    studentApi
      .chapterHistory(sess.subject, sess.chapter, sess.startedIso)
      .then((d: any) => {
        if (typeof d?.accuracy === 'number') setLastAccuracy(d.accuracy);
      })
      .catch(() => {});
    // sess는 네비게이션 시점에 고정된 값 — 마운트 시 1회면 충분
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* subject: sess/state → 쿼리 → hash → 기본 국어 */
  const [subjectKey] = useState(() => {
    try {
      const fromState = sess?.subject ?? navState?.subject;
      if (fromState && FALLBACK[fromState]) return fromState;
      const q = searchParams.get('subject');
      if (q && FALLBACK[q]) return q;
      if (window.location.hash) {
        const h = decodeURIComponent(window.location.hash.slice(1));
        if (FALLBACK[h]) return h;
      }
    } catch {
      /* 원본과 동일: 파싱 실패 무시 */
    }
    return '국어';
  });

  // 주소창 정리 — 쿼리로 들어오면 clean path로 치환하고 파라미터는 state로 보존
  useEffect(() => {
    if (searchParams.get('subject') != null || searchParams.get('day') != null) {
      navigate(location.pathname, {
        replace: true,
        state: { sess, day: dayVal, subject: subjectKey },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [data, setData] = useState<Record<string, ResultEntry>>(FALLBACK);
  // 서버 실집계 없음(예시값) 여부 — 세션(sess)도 없이 이 값이면 화면 전체가 데모라 명시한다.
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    let mounted = true;
    studentApi
      .result(subjectKey)
      .then((d: any) => {
        if (!mounted || !d) return;
        /* GET /students/me/result 응답: score는 '+150' 문자열, AI 코멘트 필드명은 ai */
        setData((prev) => {
          const cur = prev[subjectKey] ?? prev['국어'];
          return {
            ...prev,
            [subjectKey]: {
              ...cur,
              cleared: typeof d.cleared === 'number' ? d.cleared : cur.cleared,
              correct: typeof d.correct === 'number' ? d.correct : cur.correct,
              score: typeof d.score === 'string' ? d.score : cur.score,
              time: typeof d.time === 'string' ? d.time : cur.time,
              streak: typeof d.streak === 'number' ? d.streak : cur.streak,
              ai: typeof d.ai === 'string' ? d.ai : typeof d.ai_comment === 'string' ? d.ai_comment : cur.ai,
              total: typeof d.total === 'number' ? d.total : cur.total,
            },
          };
        });
        /* (은퇴 0719) today_done·subject_order(오늘의 학습 지도)는 서버에서 키째 사라짐 */
        if (typeof d.nickname === 'string' && d.nickname) setApiNick(d.nickname);
        setDemo(!!d.demo); // 실집계 없음(예시값) — 세션도 없으면 화면에 데모 명시
      })
      .catch(() => {
        // 서버 실패 + 세션 없음 = 화면 전체가 FALLBACK(예시값) → 데모로 명시(가짜 성공 방지)
        if (!sess) setDemo(true);
      });
    return () => {
      mounted = false;
    };
  }, [subjectKey]);

  const server = data[subjectKey] ?? data['국어'];
  // 이번 세션 집계가 있으면 그것으로 표시(정답/문항수/시간/획득코인) — 챕터·중도종료도 정확
  const s = sess
    ? {
        ...server,
        correct: sess.correct,
        total: Math.max(1, sess.answered),
        time: fmtTime(sess.timeMs),
        score: sess.replay ? '+0' : `+${sess.coins}`,
      }
    : server;
  const total = s.total ?? 5;

  /* (은퇴 0719, Q 통합 3단계-c) '오늘의 학습 지도'(6과목 완료 지도·다음 과목 추천) 제거 —
     과목당 완료 개념이 퀴즈와 함께 은퇴됐다. 다음 행동 안내는 '문제은행으로' CTA 하나. */
  const pct = Math.round((s.correct / total) * 100);
  const circ = 339.29;
  const offset = (circ * (1 - pct / 100)).toFixed(2);

  // 문제 다시 보기 — 이번 세션에 '실제로 푼' 문항만(맞음 초록 + 틀림 빨강).
  // 세션 정보 없으면(직접 진입) 서버 집계 기준 total칸으로 폴백.
  const review = sess
    ? [
        ...Array<boolean>(Math.max(0, sess.correct)).fill(false),
        ...Array<boolean>(Math.max(0, sess.wrong)).fill(true),
      ]
    : Array.from({ length: total }, (_, i) => i + 1 > s.correct);
  const answeredCount = sess ? sess.correct + sess.wrong : total;
  const isBank = !!sess?.bank; // 전체학습 무한 문제은행 세션
  const isChapter = !!sess?.chapter && !isBank; // bank는 5단계 챕터 UI를 쓰지 않는다

  // 다시 하기: 일차(day) 플레이였으면 같은 일차로, 아니면 같은 과목 오늘의 Q(bank)로.
  const dayParam = dayVal; // state 우선(strip 후에도 유지) — '같은 일차로 다시' 링크가 안 깨지게
  const gameHref = dayParam
    ? `${PATHS.STUDENT_GAME}?subject=${encodeURIComponent(subjectKey)}&day=${encodeURIComponent(String(dayParam))}&replay=1`
    : `${PATHS.STUDENT_GAME}?subject=${encodeURIComponent(subjectKey)}&bank=1`;
  // (은퇴 0719) '다음 미완료 과목' 추천 폐지 — 기본 다음 행동은 오늘의 Q 계속
  const primaryHref = `${PATHS.STUDENT_GAME}?subject=${encodeURIComponent(subjectKey)}&bank=1`;

  // 성적 티어 — 이번에 푼 문항 정답률(pct) 기준으로 멘트·아이콘·색을 바꾼다.
  // (다 맞힌 아이와 다 틀린 아이에게 같은 "참 잘했어요"를 주지 않는다. 단, 저성적도
  //  기죽지 않게 격려 + 복습 유도 톤으로.) 답한 문항이 없으면(직접 진입 등) 중립.
  // 세션(방금 실제로 플레이)은 있는데 한 문제도 안 풀고 끝냈으면(그만하기 즉시 종료 등)
  // 칭찬('none' 폴백=서버 고정 멘트)이 아니라 중립 멘트('empty')를 준다 — 0문항에 "참 잘했어요" 금지.
  const perf: 'perfect' | 'great' | 'good' | 'try' | 'zero' | 'empty' | 'none' =
    answeredCount === 0 ? (sess ? 'empty' : 'none')
      : pct === 100 ? 'perfect'
        : pct >= 80 ? 'great'
          : pct >= 50 ? 'good'
            : pct > 0 ? 'try'
              : 'zero';
  const PERF: Record<string, { title: string; icon: string; color: string; soft: string; ai: string; sub: string; ribbon: string }> = {
    perfect: {
      title: `${name}님, 전 문항을 맞혔습니다`, icon: 'ph-fill ph-trophy', color: 'var(--ok)', soft: 'var(--ok-soft)',
      ribbon: '전 문항 정답', sub: '한 문항도 틀리지 않았어요. 이 과목의 이해도가 높습니다.',
      ai: '전 문항을 맞혔습니다. 이 과목의 이해도가 높습니다.',
    },
    great: {
      title: `${name}님, 수고하셨어요`, icon: 'ph-fill ph-check-circle', color: 'var(--brand-ink)', soft: 'var(--brand-soft)',
      ribbon: '우수', sub: '대부분 맞혔어요. 틀린 문항만 다시 확인하면 됩니다.',
      ai: '대부분 맞혔습니다. 틀린 문항만 다시 확인하면 이해도가 높은 수준입니다.',
    },
    good: {
      title: `${name}님, 수고하셨어요`, icon: 'ph-fill ph-thumbs-up', color: 'var(--brand-ink)', soft: 'var(--brand-soft)',
      ribbon: '양호', sub: '절반 이상 맞혔어요. 오답을 복습하면 이해도가 올라갑니다.',
      ai: '절반 이상 맞혔습니다. 오답 노트로 틀린 문항을 복습해 보세요.',
    },
    try: {
      title: `${name}님, 수고하셨어요`, icon: 'ph-fill ph-arrow-clockwise', color: 'var(--brand-ink)', soft: 'var(--brand-soft)',
      ribbon: '복습 필요', sub: '복습이 필요한 문항이 있어요. 오답을 다시 확인해 보세요.',
      ai: '복습이 필요한 문항이 많습니다. 오답을 다시 확인해 보세요.',
    },
    zero: {
      title: `${name}님, 수고하셨어요`, icon: 'ph-fill ph-arrow-clockwise', color: 'var(--brand-ink)', soft: 'var(--brand-soft)',
      ribbon: '복습 필요', sub: '이번엔 정답이 없었어요. 해설을 확인하고 다시 풀어 보세요.',
      ai: '이번엔 정답이 없었습니다. 해설을 확인한 뒤 다시 풀어 보세요.',
    },
    empty: {
      title: `${name}님, 수고하셨어요`, icon: 'ph-fill ph-hand-waving', color: 'var(--brand-ink)', soft: 'var(--brand-soft)',
      ribbon: '', sub: '아직 푼 문항이 없어요. 다음에 한 문항씩 풀어 보세요.',
      ai: '이번엔 문항을 풀기 전에 종료했습니다. 다음에 이어서 풀어 보세요.',
    },
    none: {
      title: `${name}님, 수고하셨어요`, icon: 'ph-fill ph-trophy', color: 'var(--brand-ink)', soft: 'var(--brand-soft)',
      ribbon: '', sub: '', ai: s.ai,
    },
  };
  const perfInfo = PERF[perf];

  // 결과 화면 액센트는 과목색이 아니라 애플 블루로 통일(다크 시 CSS 토큰이 자동 스왑).
  const themeVars = { '--gr-solid': 'var(--brand)', '--gr-soft': 'var(--brand-soft)' } as CSSProperties;

  return (
    <div className="gr-root" style={themeVars}>
      {/* 컨페티 제거(디게임화) — 성인 톤의 담백한 결과 화면 */}
      <div className="gr-content">
        {/* 세션(방금 푼 실기록)도 없고 서버 실집계도 없으면 화면 전체가 예시값 — 데모로 명시.
            (방금 푼 세션 sess가 있으면 표시 수치는 실데이터라 배지를 띄우지 않는다.) */}
        {!sess && <DemoBadge show={demo} variant="banner" />}
        {/* HERO */}
        <div className="gr-hero">
          <div className="gr-herochip">
            <i className={isBank ? 'ph-fill ph-infinity' : 'ph-fill ph-check-circle'} />
            {isBank
              ? `${subjectKey} ${sess?.chapter ?? ''}주차 연습`
              : isChapter
                ? `${subjectKey} ${sess?.chapter}챕터 ${
                    sess?.finished
                      ? '완주!'
                      : (sess?.lastDoneStage ?? 0) > 0
                        ? `${sess?.lastDoneStage}단계까지`
                        : '도전'
                  }${sess?.replay ? ' · 복습' : ''}`
                : `${subjectKey} 완료!`}
          </div>
          {/* 마스코트 이미지 제거(디게임화) — 성취 리본으로 결과 상태만 담백하게 표시 */}
          {perfInfo.ribbon && (
            <span className="gr-perfribbon" style={{ background: perfInfo.soft, color: perfInfo.color }}>
              <i className={perfInfo.icon} /> {perfInfo.ribbon}
            </span>
          )}
          <h1 className="gr-title">{perfInfo.title}</h1>
          <p className="gr-herosub">
            {isBank
              ? `${sess?.chapter ?? ''}주차 문제를 ${answeredCount}개 풀었어요. 안 푼 문제부터 차근차근, 언제든 이어서 연습할 수 있어요!`
              : isChapter
                ? sess?.finished
                  ? `${sess?.chapter}챕터 다섯 단계를 모두 완료했어요.`
                  : (sess?.lastDoneStage ?? 0) > 0
                    ? `${sess?.lastDoneStage}단계까지 완료했어요. 다음에 이어서 하면 됩니다.`
                    : '풀던 단계는 다음에 이어서 할 수 있어요.'
                : perf !== 'none'
                  ? perfInfo.sub
                  : `${subjectKey} 학습을 마쳤어요.`}
          </p>
          {isChapter && (
            /* 챕터 5단계 진행 뱃지 — 완료 단계 채움 (bank 무한모드는 미표시) */
            <div className="gr-stagebadges">
              {Array.from({ length: 5 }, (_, i) => (
                <span
                  key={i}
                  className={`gr-stagebadge${i + 1 <= sess.lastDoneStage ? ' gr-stagebadge-on' : ''}`}
                >
                  {i + 1 <= sess.lastDoneStage ? <i className="ph-fill ph-check" /> : i + 1}
                </span>
              ))}
            </div>
          )}
          {sess?.bumpFailed && (
            /* 단계 저장 실패를 성공처럼 감추지 않는다 — 이어하기 위치가 다를 수 있음을 고지 */
            <div className="gr-savewarn">
              ⚠️ 진행 저장이 불안정했어요. 다음에 이어하기 위치가 다를 수 있어요.
            </div>
          )}
          {sess?.replay && lastAccuracy != null && (
            /* 복습: 지난 기록 vs 이번 비교 한 줄 */
            <div className="gr-compareline">
              지난 기록 {lastAccuracy}% →{' '}
              <b>이번 {Math.round((sess.correct / Math.max(1, sess.answered)) * 100)}%</b>
              {(() => {
                const now = Math.round((sess.correct / Math.max(1, sess.answered)) * 100);
                return now > lastAccuracy
                  ? ' 늘었어요.'
                  : now === lastAccuracy
                    ? ' 지난 기록과 같아요.'
                    : ' 다시 풀어 보세요.';
              })()}
            </div>
          )}
        </div>

        {/* SCORE CARD */}
        <div className="gr-scorecard">
          <div className="gr-ringwrap">
            <svg width="180" height="180" viewBox="0 0 120 120" className="gr-ringsvg">
              <circle cx="60" cy="60" r="54" fill="none" stroke="var(--brand-soft)" strokeWidth="12" />
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray="339.29"
                className="gr-ringfg"
                style={{ '--dash': offset, strokeDashoffset: offset } as CSSProperties}
              />
            </svg>
            <div className="gr-ringcenter">
              <div className="gr-pct">
                {pct}
                <span>%</span>
              </div>
              <div className="gr-pctlabel">정답률</div>
            </div>
          </div>
          <div className="gr-stats">
            <div className="gr-stat">
              <span className="gr-staticon gr-staticon-correct">
                <i className="ph-fill ph-check-circle" />
              </span>
              <div>
                <div className="gr-statnum">
                  <CountUp value={s.correct} />
                  <span>/{answeredCount}</span>
                </div>
                <div className="gr-statlabel">맞힌 문제</div>
              </div>
            </div>
            <div className="gr-stat">
              <span className="gr-staticon gr-staticon-score">
                <i className="ph-fill ph-star" />
              </span>
              <div>
                <div className="gr-statnum"><CountUp value={s.score} /></div>
                <div className="gr-statlabel">획득 점수</div>
              </div>
            </div>
            <div className="gr-stat">
              <span className="gr-staticon gr-staticon-time">
                <i className="ph-fill ph-clock" />
              </span>
              <div>
                <div className="gr-statnum">{s.time}</div>
                <div className="gr-statlabel">걸린 시간</div>
              </div>
            </div>
            <div className="gr-stat">
              <span className="gr-staticon gr-staticon-streak">
                <i className="ph-fill ph-fire" />
              </span>
              <div>
                <div className="gr-statnum"><CountUp value={s.streak} /></div>
                <div className="gr-statlabel">최고 연속 정답</div>
              </div>
            </div>
          </div>
        </div>

        {/* 전체 학습(챕터) 결과: 6과목 지도 대신 '이 챕터 5단계 진행'을 보여준다. */}
        {isChapter && sess && (
          <div className="gr-mapcard">
            <div className="gr-maphead">
              <div className="gr-maphead-left">
                <span className="gr-mapicon">
                  <i className="ph-fill ph-steps" />
                </span>
                <div>
                  <h3 className="gr-maptitle">{subjectKey} {sess.chapter}챕터 진행</h3>
                  <p className="gr-mapsub">
                    {sess.finished
                      ? '다섯 단계를 모두 완료했어요.'
                      : `${sess.lastDoneStage}/5단계 완료 — 이어서 하면 돼요`}
                  </p>
                </div>
              </div>
              <span
                className="gr-todaybadge"
                style={{
                  background: sess.finished ? '#DFF6ED' : 'var(--brand-soft)',
                  color: sess.finished ? '#17B08C' : 'var(--brand-ink)',
                }}
              >
                <i className={sess.finished ? 'ph-fill ph-check-circle' : 'ph-fill ph-flag'} />
                {sess.finished ? '챕터 완주' : `남은 단계 ${5 - sess.lastDoneStage}개`}
              </span>
            </div>
            <div className="gr-stagerow">
              {Array.from({ length: 5 }, (_, i) => {
                const no = i + 1;
                const isDone = no <= sess.lastDoneStage;
                const isNext = !sess.finished && no === sess.lastDoneStage + 1;
                return (
                  <div key={no} className="gr-stagenode">
                    <div
                      className={`gr-stagecircle${isDone ? ' gr-stagecircle-done' : isNext ? ' gr-stagecircle-next' : ''}`}
                      style={isDone ? { background: 'var(--brand)', borderColor: 'var(--brand)' } : isNext ? { borderColor: 'var(--brand)', color: 'var(--brand-ink)' } : {}}
                    >
                      {isDone ? <i className="ph-fill ph-check" /> : no}
                    </div>
                    <span className="gr-stagelabel">{no}단계</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* (은퇴 0719, Q 통합 3단계-c) '오늘의 학습 지도'(6과목 완료 지도) 카드 삭제 —
            과목당 완료 개념이 퀴즈와 함께 은퇴됐고, 다음 행동은 오늘의 Q CTA가 안내한다. */}

        {/* AI COMMENT */}
        <div className="gr-aicard">
          <div className="gr-aihead">
            <div className="gr-aiavatar">
              <i className="ph-fill ph-robot" />
            </div>
            <div>
              <div className="gr-ainame">AI 학습 피드백</div>
              <div className="gr-airole">이번 학습 요약</div>
            </div>
          </div>
          {/* AI 한마디도 성적에 맞춰 — 서버 코멘트는 과목별 고정(성적 무반영)이라, 실제로
              푼 세션이면 정답률 기반 멘트를 우선한다(다 틀린 아이에게 칭찬만 하지 않게). */}
          <p className="gr-aitext">{perf !== 'none' ? perfInfo.ai : s.ai}</p>
          {/* AI선생님 페이지 은퇴(0718) — 더보기 링크 제거, 한마디 카드는 유지 */}
        </div>

        {/* QUESTION REVIEW — 이번에 실제로 푼 문항만(맞음/틀림). 중도 종료면 푼 만큼만 표시. */}
        {answeredCount > 0 && (
          <div className="gr-reviewcard">
            <div className="gr-reviewhead">
              <div className="gr-reviewhead-left">
                <h3 className="gr-reviewtitle">문제 다시 보기</h3>
                <span className="gr-reviewcount">
                  이번에 푼 {answeredCount}문제 · 맞음 {sess ? sess.correct : s.correct} · 틀림{' '}
                  {sess ? sess.wrong : Math.max(0, total - s.correct)}
                </span>
              </div>
              <Link to={PATHS.STUDENT_WRONG_NOTES} className="gr-wronglink">
                오답만 모아보기 →
              </Link>
            </div>
            <div className="gr-reviewchips">
              {review.map((isWrong, i) => (
                <span
                  key={i}
                  className={`gr-reviewchip ${isWrong ? 'gr-reviewchip-wrong' : 'gr-reviewchip-ok'}`}
                >
                  <i className={isWrong ? 'ph-fill ph-x' : 'ph-fill ph-check'} />
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ACTIONS */}
        {isBank ? (
          /* 전체학습 무한 문제은행 — 같은 주차 계속 풀거나 문제은행으로 */
          <div className="gr-actions">
            <Link
              to={`${PATHS.STUDENT_GAME}?subject=${encodeURIComponent(subjectKey)}${sess?.chapter ? `&chapter=${sess.chapter}` : ''}&bank=1`}
              className="gr-btn-secondary"
            >
              <i className="ph-fill ph-infinity" />
              이어서 더 풀기
            </Link>
            <Link to={PATHS.STUDENT_ALL_LEARNING} className="gr-btn-primary">
              <i className="ph-fill ph-arrow-right" />
              문제은행으로
            </Link>
          </div>
        ) : isChapter && sess?.chapter ? (
          sess.finished ? (
            /* 5단계 완주: 한 번 더(복습) 또는 다음 학습 */
            <div className="gr-actions">
              <Link
                to={`${PATHS.STUDENT_GAME}?subject=${encodeURIComponent(subjectKey)}&chapter=${sess.chapter}&stage=1&replay=1`}
                className="gr-btn-secondary"
              >
                <i className="ph-fill ph-arrow-counter-clockwise" />
                한 번 더 풀기 (복습)
              </Link>
              <Link to={PATHS.STUDENT_ALL_LEARNING} className="gr-btn-primary">
                <i className="ph-fill ph-arrow-right" />
                문제은행으로
              </Link>
            </div>
          ) : (
            /* 중도 종료: 첫 미완료 단계부터 이어서 */
            <div className="gr-actions">
              <Link to={PATHS.STUDENT_ALL_LEARNING} className="gr-btn-secondary">
                <i className="ph-fill ph-squares-four" />
                문제은행으로
              </Link>
              <Link
                to={`${PATHS.STUDENT_GAME}?subject=${encodeURIComponent(subjectKey)}&chapter=${sess.chapter}&stage=${Math.min(5, sess.lastDoneStage + 1)}${sess.replay ? '&replay=1' : ''}`}
                className="gr-btn-primary"
              >
                <i className="ph-fill ph-play" />
                {Math.min(5, sess.lastDoneStage + 1)}단계 이어서 하기
              </Link>
            </div>
          )
        ) : (
          <div className="gr-actions">
            <Link to={gameHref} className="gr-btn-secondary">
              <i className="ph-fill ph-arrow-counter-clockwise" />
              다시 하기
            </Link>
            {/* 오늘의퀴즈 은퇴(Q 통합 2단계) — 다른 과목 선택은 문제은행(오늘의 Q)에서 */}
            <Link to={PATHS.STUDENT_ALL_LEARNING} className="gr-btn-secondary">
              <i className="ph-fill ph-stack" />
              문제은행으로
            </Link>
            <Link to={primaryHref} className="gr-btn-primary">
              <i className="ph-fill ph-arrow-right" />
              오늘의 Q 계속하기
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
