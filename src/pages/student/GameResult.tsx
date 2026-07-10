import { useEffect, useState, type CSSProperties } from 'react';
import CountUp from '../../components/motion/CountUp';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { useAuth } from '../../hooks/useAuth';
import { studentApi } from '../../api/students';
import mascot from '../../assets/characters/catchap-logo.png';
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
  '국어': { solid: '#FF5A4D', soft: '#FFE0DB', cleared: 5, correct: 5, score: '+150', time: '2:40', streak: 5, ai: '글의 속뜻까지 잘 파악했어요! 낱말과 문장을 꼼꼼히 읽는 습관이 멋져요. 다음 단계도 잘 해낼 거예요! 🐾' },
  '영어': { solid: '#FF922E', soft: '#FFEDD6', cleared: 3, correct: 4, score: '+90', time: '2:10', streak: 3, ai: '영어 문장과 문법을 척척 풀었어요! 단어의 쓰임을 잘 이해했네요. 다음 단계도 잘 해낼 거예요! 🐾' },
  '수학': { solid: '#17B08C', soft: '#DFF6EE', cleared: 5, correct: 5, score: '+160', time: '3:05', streak: 5, ai: '계산과 도형 문제를 아주 정확하게 풀었어요! 차근차근 따지는 방법이 완벽했어요. 다음 단계도 도전해봐요! 🐾' },
  '과학': { solid: '#2E7BFF', soft: '#E1EDFF', cleared: 2, correct: 4, score: '+95', time: '2:20', streak: 3, ai: '관찰하고 탐구를 참 잘했어요! 원리를 꼼꼼히 살피는 눈이 멋져요. 다음엔 더 깊은 탐구에 도전해봐요! 🐾' },
  '사회': { solid: '#8B6BFF', soft: '#EAE2FF', cleared: 1, correct: 4, score: '+80', time: '2:05', streak: 3, ai: '우리 지역과 사회를 잘 이해하고 있네요! 지도와 공공기관 문제를 멋지게 풀었어요. 다음 단계로 가볼까요? 🐾' },
  '생활': { solid: '#FF6DA6', soft: '#FFE3EF', cleared: 1, correct: 4, score: '+110', time: '2:35', streak: 4, ai: '안전 규칙을 잘 지켰어요! 멈추고, 살피고, 건너기 — 참 잘 기억했어요. 다음 단계도 안전하게! 🐾' },
};

const MAP: Record<string, { color: string; soft: string; icon: string }> = {
  '국어': { color: '#FF5A4D', soft: '#FFE0DB', icon: 'ph-fill ph-book-open' },
  '영어': { color: '#FF922E', soft: '#FFEDD6', icon: 'ph-fill ph-translate' },
  '수학': { color: '#17B08C', soft: '#DFF6EE', icon: 'ph-fill ph-plus-minus' },
  '과학': { color: '#2E7BFF', soft: '#E1EDFF', icon: 'ph-fill ph-flask' },
  '사회': { color: '#8B6BFF', soft: '#EAE2FF', icon: 'ph-fill ph-scroll' },
  '생활': { color: '#FF6DA6', soft: '#FFE3EF', icon: 'ph-fill ph-house-line' },
};

const ORDER = ['국어', '영어', '수학', '과학', '사회', '생활'];

// TODO(api): 오늘 완료한 과목 — API 실패 시 원본 TODAY_DONE 유지
const TODAY_DONE = ['국어', '영어', '수학'];

const CONFETTI = [
  { left: '6%', bg: '#FF5A4D', delay: '0s' },
  { left: '14%', bg: '#FFB43C', delay: '.5s' },
  { left: '22%', bg: '#33C892', delay: '1.1s' },
  { left: '31%', bg: '#2E7BFF', delay: '.3s' },
  { left: '39%', bg: '#FF6DA6', delay: '1.6s' },
  { left: '47%', bg: '#8B6BFF', delay: '.8s' },
  { left: '55%', bg: '#FFB43C', delay: '.2s' },
  { left: '63%', bg: '#FF5A4D', delay: '1.3s' },
  { left: '71%', bg: '#17B08C', delay: '.6s' },
  { left: '79%', bg: '#2E7BFF', delay: '1.9s' },
  { left: '87%', bg: '#FF6DA6', delay: '1s' },
  { left: '94%', bg: '#FFB43C', delay: '.4s' },
];

/** GameScreen이 넘겨주는 이번 세션 로컬 집계 — 서버 재조회 없이 정확한 결과 표시 */
interface SessState {
  subject: string;
  chapter: number | null;
  startStage: number | null;
  lastDoneStage: number;
  finished: boolean;
  answered: number;
  correct: number;
  wrong: number;
  timeMs: number;
  replay: boolean;
  coins: number;
  sticker: boolean;
  stickerCoins: number;
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
  const [todayDone, setTodayDone] = useState<string[]>(TODAY_DONE);
  const [order, setOrder] = useState<string[]>(ORDER);

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
        if (Array.isArray(d.today_done)) {
          setTodayDone(d.today_done.filter((k: any) => typeof k === 'string'));
        }
        /* 오늘의 학습 지도 과목 순서 — 스타일(MAP)에 있는 과목만 반영 */
        if (Array.isArray(d.subject_order)) {
          const so = d.subject_order.filter((k: any) => typeof k === 'string' && MAP[k]);
          if (so.length) setOrder(so);
        }
        if (typeof d.nickname === 'string' && d.nickname) setApiNick(d.nickname);
      })
      .catch(() => {
        // TODO(api): 백엔드 미구현/실패 시 FALLBACK 유지
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
        score: sess.replay ? '+0' : `+${sess.coins + sess.stickerCoins}`,
      }
    : server;
  const total = s.total ?? 5;

  /* ---- 오늘의 학습 지도 (원본 renderVals 그대로) ---- */
  const doneSet: Record<string, boolean> = {};
  todayDone.forEach((k) => {
    doneSet[k] = true;
  });
  // 방금 과목을 완료로 칠하는 건 '오늘의퀴즈 세션을 끝까지 마쳤을 때'만 —
  // 중도 종료·챕터 세션까지 칠하면 학습 지도(6과목)가 부풀고 다음 과목 추천이 어긋난다.
  if (!sess || (sess.finished && !sess.chapter && !sess.replay)) doneSet[subjectKey] = true;
  const doneCount = order.filter((k) => doneSet[k]).length;
  const allDoneToday = doneCount >= order.length;
  const nextUndone = order.find((k) => !doneSet[k]) || null;

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
  const isChapter = !!sess?.chapter;

  // 다시 하기 = 복습 모드(replay=1): 기록은 남되 오늘의퀴즈 상태·코인 중복 반영 없음.
  // 일차 플레이였으면 같은 일차(day)로 다시 들어간다.
  const dayParam = dayVal; // state 우선(strip 후에도 유지) — '같은 일차로 다시' 링크가 안 깨지게
  const gameHref = `${PATHS.STUDENT_GAME}?subject=${encodeURIComponent(subjectKey)}${
    dayParam ? `&day=${encodeURIComponent(String(dayParam))}` : ''
  }&replay=1`;
  const primaryHref = allDoneToday
    ? PATHS.STUDENT_HOME
    : `${PATHS.STUDENT_CHAPTERS}?subject=${encodeURIComponent(nextUndone || subjectKey)}`;

  const themeVars = { '--gr-solid': s.solid, '--gr-soft': s.soft } as CSSProperties;

  return (
    <div className="gr-root" style={themeVars}>
      {/* CONFETTI */}
      <div className="gr-confetti-layer">
        {CONFETTI.map((c, i) => (
          <span
            key={i}
            className="gr-confetti"
            style={{ left: c.left, background: c.bg, animationDelay: c.delay }}
          />
        ))}
      </div>

      <div className="gr-content">
        {/* HERO */}
        <div className="gr-hero">
          <div className="gr-herochip">
            <i className="ph-fill ph-confetti" />
            {sess?.chapter
              ? `${subjectKey} ${sess.chapter}챕터 ${
                  sess.finished
                    ? '완주!'
                    : sess.lastDoneStage > 0
                      ? `${sess.lastDoneStage}단계까지`
                      : '도전'
                }${sess.replay ? ' · 복습' : ''}`
              : allDoneToday
                ? '오늘의 학습 끝!'
                : `${subjectKey} 완료!`}
          </div>
          <div className="gr-mascotwrap">
            <img src={mascot} alt="마스코트" className="gr-mascotimg" />
            <span className="gr-trophy">
              <i className="ph-fill ph-trophy" />
            </span>
          </div>
          <h1 className="gr-title">참 잘했어요, {name}! 🎉</h1>
          <p className="gr-herosub">
            {sess?.chapter
              ? sess.finished
                ? `${sess.chapter}챕터 다섯 단계를 끝까지 해냈어요! 정말 대단해요 🏆`
                : sess.lastDoneStage > 0
                  ? `${sess.lastDoneStage}단계까지 완료했어요. 다음에 이어서 하면 돼요!`
                  : '풀던 단계는 다음에 이어서 할 수 있어요!'
              : allDoneToday
                ? `오늘 하루 학습을 다 마쳤어요! 여섯 과목을 모두 끝낸 ${name}, 정말 대단해요 🏆`
                : `${subjectKey} 챕터를 멋지게 끝냈어요. 오늘도 한 뼘 더 자랐네요!`}
          </p>
          {sess?.chapter != null && (
            /* 챕터 5단계 진행 뱃지 — 완료 단계 채움 */
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
          {sess?.sticker && (
            <div className="gr-stickerline">
              🌟 오늘의 스티커 획득! 6과목 모두 완료 (+{sess.stickerCoins}코인)
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
                  ? ' 늘었어요! 🎉'
                  : now === lastAccuracy
                    ? ' 지난 기록 그대로예요!'
                    : ' 다시 도전해봐요!';
              })()}
            </div>
          )}
        </div>

        {/* SCORE CARD */}
        <div className="gr-scorecard">
          <div className="gr-ringwrap">
            <svg width="180" height="180" viewBox="0 0 120 120" className="gr-ringsvg">
              <circle cx="60" cy="60" r="54" fill="none" stroke="#FFEDE4" strokeWidth="12" />
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
                      ? '다섯 단계를 모두 끝냈어요! 🏆'
                      : `${sess.lastDoneStage}/5단계 완료 — 이어서 하면 돼요`}
                  </p>
                </div>
              </div>
              <span
                className="gr-todaybadge"
                style={{
                  background: sess.finished ? '#DFF6ED' : s.soft,
                  color: sess.finished ? '#17B08C' : s.solid,
                }}
              >
                <i className={sess.finished ? 'ph-fill ph-check-circle' : 'ph-fill ph-flag'} />
                {sess.finished ? '챕터 완주! 🎉' : `남은 단계 ${5 - sess.lastDoneStage}개`}
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
                      style={isDone ? { background: s.solid, borderColor: s.solid } : isNext ? { borderColor: s.solid, color: s.solid } : {}}
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

        {/* 오늘의 퀴즈 결과: 6과목 학습 지도. (챕터 결과에는 표시하지 않는다) */}
        {!isChapter && (
        <div className="gr-mapcard">
          <div className="gr-maphead">
            <div className="gr-maphead-left">
              <span className="gr-mapicon">
                <i className="ph-fill ph-map-trifold" />
              </span>
              <div>
                <h3 className="gr-maptitle">오늘의 학습 지도</h3>
                <p className="gr-mapsub">6과목 중 {doneCount}개 완료</p>
              </div>
            </div>
            <span
              className="gr-todaybadge"
              style={{
                background: allDoneToday ? '#DFF6ED' : s.soft,
                color: allDoneToday ? '#17B08C' : s.solid,
              }}
            >
              <i className={allDoneToday ? 'ph-fill ph-check-circle' : 'ph-fill ph-flag'} />
              {allDoneToday ? '오늘의 학습 끝! 🎉' : `남은 과목 ${order.length - doneCount}개`}
            </span>
          </div>
          <div className="gr-mapnodes">
            {order.map((subject, i) => {
              const m = MAP[subject];
              const isHero = subject === subjectKey;
              const isDone = !!doneSet[subject] && !isHero;
              return (
                <div key={subject} className="gr-mapnode">
                  <div
                    className="gr-mapline"
                    style={{
                      borderTopColor: doneSet[subject] ? m.color : '#E4DCD0',
                      display: i === 0 ? 'none' : 'block',
                    }}
                  />
                  {isHero ? (
                    <div
                      className="gr-node gr-node-hero"
                      style={{
                        background: m.color,
                        boxShadow: `0 0 0 5px ${m.soft}, 0 12px 22px -8px ${m.color}`,
                      }}
                    >
                      <i className="ph-fill ph-trophy" />
                    </div>
                  ) : isDone ? (
                    <div className="gr-node gr-node-done" style={{ background: m.color }}>
                      <i className="ph-fill ph-check" />
                    </div>
                  ) : (
                    <div className="gr-node gr-node-todo">
                      <i className={m.icon} />
                    </div>
                  )}
                  <span
                    className="gr-maplabel"
                    style={{ color: isHero ? m.color : isDone ? '#5A5248' : '#B0A79B' }}
                  >
                    {subject}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        )}

        {/* AI COMMENT */}
        <div className="gr-aicard">
          <div className="gr-aihead">
            <div className="gr-aiavatar">
              <i className="ph-fill ph-robot" />
            </div>
            <div>
              <div className="gr-ainame">AI 선생님 냥냥이</div>
              <div className="gr-airole">오늘의 한마디</div>
            </div>
          </div>
          <p className="gr-aitext">{s.ai}</p>
          <Link to={PATHS.STUDENT_AI_TEACHER} className="gr-ailink">
            AI 선생님과 더 이야기하기 <i className="ph-bold ph-arrow-right" />
          </Link>
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
        {sess?.chapter ? (
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
                전체 학습으로
              </Link>
            </div>
          ) : (
            /* 중도 종료: 첫 미완료 단계부터 이어서 */
            <div className="gr-actions">
              <Link to={PATHS.STUDENT_ALL_LEARNING} className="gr-btn-secondary">
                <i className="ph-fill ph-squares-four" />
                전체 학습으로
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
            <Link to={PATHS.STUDENT_ALL_LEARNING} className="gr-btn-secondary">
              <i className="ph-fill ph-squares-four" />
              다른 학습 하기
            </Link>
            <Link to={primaryHref} className="gr-btn-primary">
              <i className={allDoneToday ? 'ph-fill ph-house' : 'ph-fill ph-arrow-right'} />
              {allDoneToday ? '홈으로 가기' : '다음 과목 하러 가기'}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
