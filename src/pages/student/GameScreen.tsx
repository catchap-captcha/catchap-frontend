import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { studentApi } from '../../api/students';
import { playSfx } from '../../utils/feedback';
import ScreenTimeReminder from '../../components/motion/ScreenTimeReminder';
import mascot from '../../assets/characters/catchap-logo.png';
import './GameScreen.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface SubjectPreset {
  key: string;
  solid: string;
  soft: string;
  slotBg: string;
  dash: string;
  mascotGrad: string;
  progGrad: string;
  gameTitle: string;
  gameSub: string;
  gameIcon: string;
  catLabel: string;
  catIcon: string;
  cheer: string;
  current: number;
  total: number;
  score: number;
  correct: number;
  wrong: number;
  streak: number;
}

// TODO(api): studentApi.gameState() 실패 시 원본 SUBJECTS 프리셋 그대로 유지
const FALLBACK: SubjectPreset[] = [
  {
    key: '국어', solid: '#FF5A4D', soft: '#FFE0DB', slotBg: 'linear-gradient(160deg,#FFFBF6,#FFF1EE)', dash: '#FFD6C4',
    mascotGrad: 'linear-gradient(160deg,#FFE6BE,#FFCFC9)', progGrad: 'linear-gradient(90deg,#FF8A5B,#FF5A4D)',
    gameTitle: '한글 낱말 찾기', gameSub: '그림 보고 낱말 고르기', gameIcon: 'ph-fill ph-text-aa',
    catLabel: '낱말·한글', catIcon: 'ph-fill ph-text-aa',
    cheer: '천천히, 잘 하고 있어요! 🐾',
    current: 3, total: 5, score: 210, correct: 2, wrong: 0, streak: 2,
  },
  {
    key: '영어', solid: '#FF922E', soft: '#FFEDD6', slotBg: 'linear-gradient(160deg,#FFFBF4,#FFF3E6)', dash: '#FFDDB8',
    mascotGrad: 'linear-gradient(160deg,#FFE6BE,#FFD8A6)', progGrad: 'linear-gradient(90deg,#FFB43C,#FF922E)',
    gameTitle: 'Word Match', gameSub: '그림 보고 영어 단어 고르기', gameIcon: 'ph-fill ph-translate',
    catLabel: 'Word·English', catIcon: 'ph-fill ph-translate',
    cheer: '한 문제씩 차근차근 가볼까요? ✨',
    current: 1, total: 5, score: 150, correct: 0, wrong: 0, streak: 0,
  },
  {
    key: '수학', solid: '#17B08C', soft: '#DFF6EE', slotBg: 'linear-gradient(160deg,#F6FFFB,#EAF9F3)', dash: '#BFEAD9',
    mascotGrad: 'linear-gradient(160deg,#C9F0E2,#B6E6D6)', progGrad: 'linear-gradient(90deg,#33C892,#17B0A0)',
    gameTitle: '숫자 세기', gameSub: '그림 세고 숫자 고르기', gameIcon: 'ph-fill ph-plus-minus',
    catLabel: '수·셈', catIcon: 'ph-fill ph-plus-minus',
    cheer: '집중력이 대단해요! 👏',
    current: 4, total: 5, score: 320, correct: 3, wrong: 0, streak: 3,
  },
  {
    key: '과학', solid: '#2E7BFF', soft: '#E1EDFF', slotBg: 'linear-gradient(160deg,#F6FAFF,#EAF2FF)', dash: '#C4DBFF',
    mascotGrad: 'linear-gradient(160deg,#CFE2FF,#BBD6FF)', progGrad: 'linear-gradient(90deg,#4AA6FF,#2E7BFF)',
    gameTitle: '과학 관찰 퀴즈', gameSub: '잘 보고 알맞은 답 고르기', gameIcon: 'ph-fill ph-flask',
    catLabel: '관찰·과학', catIcon: 'ph-fill ph-flask',
    cheer: '궁금한 걸 잘 찾아내고 있어요! 🔍',
    current: 1, total: 5, score: 40, correct: 0, wrong: 0, streak: 0,
  },
  {
    key: '역사', solid: '#8B6BFF', soft: '#EAE2FF', slotBg: 'linear-gradient(160deg,#FAF8FF,#F1EBFF)', dash: '#D6C8FF',
    mascotGrad: 'linear-gradient(160deg,#DCD0FF,#CBBAFF)', progGrad: 'linear-gradient(90deg,#A98CFF,#8B6BFF)',
    gameTitle: '역사 이야기 퀴즈', gameSub: '이야기 읽고 답 고르기', gameIcon: 'ph-fill ph-scroll',
    catLabel: '이야기·역사', catIcon: 'ph-fill ph-scroll',
    cheer: '옛날 이야기, 참 잘 기억하네요! 📜',
    current: 2, total: 5, score: 120, correct: 1, wrong: 0, streak: 1,
  },
  {
    key: '생활', solid: '#FF6DA6', soft: '#FFE3EF', slotBg: 'linear-gradient(160deg,#FFFAFC,#FFF0F5)', dash: '#FFCDE0',
    mascotGrad: 'linear-gradient(160deg,#FFD9E8,#FFC2D9)', progGrad: 'linear-gradient(90deg,#FF93BE,#FF6DA6)',
    gameTitle: '생활 안전 퀴즈', gameSub: '상황 보고 바른 행동 고르기', gameIcon: 'ph-fill ph-house-line',
    catLabel: '안전·생활', catIcon: 'ph-fill ph-house-line',
    cheer: '안전을 잘 챙기고 있어요! 🚸',
    current: 4, total: 5, score: 260, correct: 2, wrong: 1, streak: 1,
  },
];

const QUESTIONS: Record<string, { q: string; pre: string; hi: string; post: string }> = {
  '국어': { q: '이 그림은 무슨 낱말일까요? 📖', pre: '그림을 잘 보고, 알맞은 ', hi: '낱말 카드', post: '를 눌러요.' },
  '영어': { q: '이 그림은 영어로 뭘까요? 🔤', pre: '그림을 잘 보고, 알맞은 ', hi: '영어 단어', post: '를 눌러요.' },
  '수학': { q: '별이 모두 몇 개일까요? ⭐', pre: '별을 하나씩 세고, 알맞은 ', hi: '숫자 카드', post: '를 눌러요.' },
  '과학': { q: '물에 둥둥 뜨는 것은? 💧', pre: '가볍고 물에 뜨는 것을 생각하며, 알맞은 ', hi: '답 카드', post: '를 눌러요.' },
  '역사': { q: '한글을 만드신 임금님은? 👑', pre: '옛날 이야기를 떠올리며, 알맞은 ', hi: '답 카드', post: '를 눌러요.' },
  '생활': { q: '횡단보도에서 바른 행동은? 🚸', pre: '안전을 먼저 생각하며, 알맞은 ', hi: '행동 카드', post: '를 눌러요.' },
};

// TODO(api): 과목별 보상 별 개수 — API 실패 시 원본 REWARDS 유지
const REWARDS: Record<string, number> = { '국어': 3, '영어': 1, '수학': 4, '과학': 0, '역사': 2, '생활': 4 };

export default function GameScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  /* 원본 componentDidMount: ?subject= 쿼리 → 없으면 hash → 기본 국어 */
  const [subjectIdx, setSubjectIdx] = useState(() => {
    let name = '국어';
    try {
      const q = searchParams.get('subject');
      if (q) name = q;
      else if (window.location.hash) {
        const h = decodeURIComponent(window.location.hash.slice(1));
        if (h) name = h;
      }
    } catch {
      /* 원본과 동일: 파싱 실패 무시 */
    }
    const i = FALLBACK.findIndex((s) => s.key === name);
    return i >= 0 ? i : 0;
  });

  const [subjects, setSubjects] = useState<SubjectPreset[]>(FALLBACK);
  /* API reward: {have, goal} — 실패 시 REWARDS(have)/5(goal) 유지 */
  const [rewards, setRewards] = useState<Record<string, { have: number; goal: number }>>(() =>
    Object.fromEntries(Object.entries(REWARDS).map(([k, v]) => [k, { have: v, goal: 5 }])),
  );
  /* API question: {q, hi, pre, post} — 실패 시 원본 QUESTIONS 유지 */
  const [questions, setQuestions] = useState(QUESTIONS);

  const s = subjects[subjectIdx];
  const key = s.key;

  /* 세션 시작 시각 — 완료 시 실제 풀이 시간(solve_time_ms) 계산용 */
  const startedAt = useRef<number>(Date.now());
  useEffect(() => {
    startedAt.current = Date.now();
  }, [key]);

  /* 완료 클릭 → 실제 학습기록 저장(오늘의퀴즈 done·코인·진도·연속도전 반영) 후 결과로 이동.
     저장 실패해도 결과 화면 이동은 원본 흐름 그대로 유지한다. */
  const finishSession = () => {
    playSfx('correct');
    const solveMs = Math.max(0, Date.now() - startedAt.current);
    // 실제 정오답을 문항별로 기록 → 정답률 집계가 정확해짐(항상 correct 저장 문제 해소).
    // 마지막 저장에만 completed:true(오늘의퀴즈 done) + 점수/풀이시간을 싣는다.
    const correct = typeof s.correct === 'number' ? s.correct : 0;
    const wrong = typeof s.wrong === 'number' ? s.wrong : 0;
    const outcomes: ('correct' | 'incorrect')[] = [
      ...Array<'correct'>(correct).fill('correct'),
      ...Array<'incorrect'>(wrong).fill('incorrect'),
    ];
    if (outcomes.length === 0) outcomes.push('correct'); // 데이터 없으면 최소 1건(완료 표시용)

    const chain = outcomes.reduce<Promise<unknown>>((prev, result, i) => {
      const last = i === outcomes.length - 1;
      return prev.then(() =>
        studentApi
          .saveAttempt({
            subject: s.key,
            result,
            score: last ? (typeof s.score === 'number' ? s.score : 0) : 0,
            solve_time_ms: last ? solveMs : 0,
            retry_count: 0,
            completed: last, // 마지막에만 오늘의퀴즈 완료 처리
          })
          .catch(() => {
            /* 저장 실패해도 흐름 유지 */
          }),
      );
    }, Promise.resolve());

    chain.finally(() => {
      navigate(`${PATHS.STUDENT_RESULT}?subject=${encodeURIComponent(s.key)}`);
    });
  };

  useEffect(() => {
    let mounted = true;
    studentApi
      .gameState(key)
      .then((d: any) => {
        if (!mounted || !d) return;
        /* GET /students/me/game-state 응답: current/total/score/correct/wrong/streak,
         * cheer, gameTitle/gameSub/catLabel, meta{color,soft}, question{q,hi,pre,post}, reward{have,goal} */
        setSubjects((prev) =>
          prev.map((sub) =>
            sub.key !== key
              ? sub
              : {
                  ...sub,
                  current: typeof d.current === 'number' ? d.current : sub.current,
                  total: typeof d.total === 'number' ? d.total : sub.total,
                  score: typeof d.score === 'number' ? d.score : sub.score,
                  correct: typeof d.correct === 'number' ? d.correct : sub.correct,
                  wrong: typeof d.wrong === 'number' ? d.wrong : sub.wrong,
                  streak: typeof d.streak === 'number' ? d.streak : sub.streak,
                  cheer: typeof d.cheer === 'string' ? d.cheer : sub.cheer,
                  gameTitle: typeof d.gameTitle === 'string' ? d.gameTitle : sub.gameTitle,
                  gameSub: typeof d.gameSub === 'string' ? d.gameSub : sub.gameSub,
                  catLabel: typeof d.catLabel === 'string' ? d.catLabel : sub.catLabel,
                  solid: typeof d.meta?.color === 'string' ? d.meta.color : sub.solid,
                  soft: typeof d.meta?.soft === 'string' ? d.meta.soft : sub.soft,
                },
          ),
        );
        const have =
          typeof d.reward?.have === 'number'
            ? d.reward.have
            : typeof d.reward_have === 'number'
              ? d.reward_have
              : null;
        const goal = typeof d.reward?.goal === 'number' ? d.reward.goal : null;
        if (have !== null || goal !== null) {
          setRewards((prev) => {
            const cur = prev[key] ?? { have: 0, goal: 5 };
            return { ...prev, [key]: { have: have ?? cur.have, goal: goal ?? cur.goal } };
          });
        }
        if (d.question && typeof d.question.q === 'string') {
          setQuestions((prev) => ({
            ...prev,
            [key]: {
              q: d.question.q,
              pre: typeof d.question.pre === 'string' ? d.question.pre : '',
              hi: typeof d.question.hi === 'string' ? d.question.hi : '',
              post: typeof d.question.post === 'string' ? d.question.post : '',
            },
          }));
        }
      })
      .catch(() => {
        // TODO(api): 백엔드 미구현/실패 시 원본 프리셋 유지
      });
    return () => {
      mounted = false;
    };
  }, [key]);

  const pct = Math.round((s.current / s.total) * 100);
  const isLast = s.current >= s.total;

  const rewardGoal = rewards[s.key]?.goal ?? 5;
  const rewardHave = Math.max(0, Math.min(rewardGoal, rewards[s.key]?.have ?? 0));
  const rewardMsg =
    rewardHave >= rewardGoal
      ? '와! 새 스티커를 받았어요 🎉'
      : `별 ${rewardGoal - rewardHave}개만 더 모으면 새 스티커! 🎁`;

  const qd = questions[s.key] ?? { q: '', pre: '', hi: '', post: '' };

  const themeVars = {
    '--gs-solid': s.solid,
    '--gs-soft': s.soft,
    '--gs-slot-bg': s.slotBg,
    '--gs-dash': s.dash,
    '--gs-mascot-grad': s.mascotGrad,
    '--gs-prog-grad': s.progGrad,
  } as CSSProperties;

  return (
    <div className="gs-root" style={themeVars}>
      {/* TOP BAR */}
      <div className="gs-topbar">
        <div className="gs-topbar-inner">
          <Link to={PATHS.STUDENT_HOME} className="gs-quit">
            <i className="ph-bold ph-x" />
            그만하기
          </Link>
          <div className="gs-gamehead">
            <span className="gs-gameicon">
              <i className={s.gameIcon} />
            </span>
            <div className="gs-gametext">
              <div className="gs-gametitle">{s.gameTitle}</div>
              <div className="gs-gamesub">{s.gameSub}</div>
            </div>
          </div>
          <div className="gs-progress">
            <div className="gs-progress-labels">
              <span>
                문제 {s.current} / {s.total}
              </span>
              <span className="gs-progress-pct">{pct}%</span>
            </div>
            <div className="gs-progress-track">
              <div className="gs-progress-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="gs-scorechip">
            <i className="ph-fill ph-star" />
            <span>{s.score}</span>
          </div>
        </div>
        {/* SUBJECT SWITCHER */}
        <div className="gs-tabs">
          {subjects.map((sub, i) =>
            i === subjectIdx ? (
              <button
                key={sub.key}
                onClick={() => setSubjectIdx(i)}
                className="gs-tab gs-tab-active"
                style={{ background: sub.solid, boxShadow: `0 8px 16px -8px ${sub.solid}` }}
              >
                <i className={sub.gameIcon} />
                {sub.key}
              </button>
            ) : (
              <button key={sub.key} onClick={() => setSubjectIdx(i)} className="gs-tab gs-tab-inactive">
                <i className={sub.gameIcon} />
                {sub.key}
              </button>
            ),
          )}
        </div>
      </div>

      {/* PLAY AREA */}
      <div className="gs-play">
        <div className="gs-main">
          <div className="gs-main-head">
            <span className="gs-catchip">
              <i className={s.catIcon} />
              {s.catLabel}
            </span>
            <span className="gs-guard">
              <span className="gs-guard-dotwrap">
                <span className="gs-guard-dot" />
              </span>
              <span className="gs-guard-label">Guard 추적 중</span>
            </span>
          </div>

          <h1 className="gs-question">{qd.q}</h1>
          <p className="gs-subline">
            {qd.pre}
            <span className="gs-subhi">{qd.hi}</span>
            {qd.post}
          </p>

          {/* ▼▼▼ CAPTCHA API MOUNT SLOT — 실제 게임 챌린지가 이 컨테이너 안에 렌더링됩니다 ▼▼▼ */}
          <div
            id="captcha-mount"
            data-captcha-slot="true"
            data-subject={s.key}
            data-question={s.current}
            className="gs-mount"
          >
            <span className="gs-mount-tagleft">#captcha-mount</span>
            <span className="gs-mount-tagright">
              문제 {s.current}/{s.total}
            </span>
            <div className="gs-mount-body">
              <span className="gs-mount-icon">
                <i className="ph-fill ph-puzzle-piece" />
              </span>
              <span className="gs-mount-title">API 캡챠 위젯 자리</span>
              <span className="gs-mount-desc">
                실제 챌린지(그림 고르기·퍼즐 등)는 CatChap Guard API가
                <br />이 컨테이너에 쏙 넣어줘요. <code>#captcha-mount</code>
              </span>
            </div>
          </div>
          {/* ▲▲▲ CAPTCHA API MOUNT SLOT ▲▲▲ */}
        </div>

        {/* SIDE PANEL */}
        <div className="gs-side">
          <div className="gs-mascotcard">
            <div className="gs-mascotfloat">
              <img src={mascot} alt="마스코트" className="gs-mascotimg" />
            </div>
            <div className="gs-cheer">{s.cheer}</div>
          </div>
          <div className="gs-card">
            <div className="gs-card-title">이번 판 진행</div>
            <div className="gs-statlist">
              <div className="gs-statrow">
                <span className="gs-staticon gs-staticon-ok">
                  <i className="ph-fill ph-check-circle" />
                </span>
                맞힌 문제 <span className="gs-statval gs-statval-ok">{s.correct}</span>
              </div>
              <div className="gs-statrow">
                <span className="gs-staticon gs-staticon-no">
                  <i className="ph-fill ph-x-circle" />
                </span>
                틀린 문제 <span className="gs-statval gs-statval-no">{s.wrong}</span>
              </div>
              <div className="gs-statrow">
                <span className="gs-staticon gs-staticon-streak">
                  <i className="ph-fill ph-lightning" />
                </span>
                연속 정답 <span className="gs-statval gs-statval-streak">{s.streak}</span>
              </div>
            </div>
          </div>

          <div className="gs-card">
            <div className="gs-reward-head">
              <div className="gs-reward-title">다음 보상까지</div>
              <span className="gs-reward-sticker">
                <i className="ph-fill ph-gift" />새 스티커
              </span>
            </div>
            <div className="gs-reward-slots">
              {Array.from({ length: rewardGoal }, (_, i) => (
                <span
                  key={i}
                  className={`gs-reward-slot ${i < rewardHave ? 'gs-reward-slot-on' : 'gs-reward-slot-off'}`}
                >
                  <i className="ph-fill ph-star" />
                </span>
              ))}
            </div>
            <div className="gs-reward-msg">{rewardMsg}</div>
          </div>
        </div>
      </div>

      {/* BOTTOM ACTION BAR */}
      <div className="gs-bottombar">
        <div className="gs-bottombar-inner">
          <div className="gs-status">
            {s.key} · {s.current}/{s.total}문제 진행 중
          </div>
          <div className="gs-actions">
            <button className="gs-confirm" onClick={finishSession}>
              {isLast ? '결과 보기' : '다음 문제'} <i className="ph-fill ph-arrow-right" />
            </button>
          </div>
        </div>
      </div>

      <ScreenTimeReminder />
    </div>
  );
}
