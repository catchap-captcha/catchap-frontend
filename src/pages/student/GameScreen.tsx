import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { studentApi } from '../../api/students';
import { getFreshAccessToken } from '../../api/client';
import { playSfx } from '../../utils/feedback';
import { attachPointerTrace, type PointerTraceRecorder } from '../../utils/pointerTrace';
import ScreenTimeReminder from '../../components/motion/ScreenTimeReminder';
import CatchapWidget from '../../components/captcha/CatchapWidget';
import mascot from '../../assets/characters/catchap-logo.png';
import './GameScreen.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

// 우리 앱을 교육형 API의 1st-party 소비처로 붙일 때 쓰는 위젯 설정 (미설정 시 폴백)
const EDU_SITE_KEY = import.meta.env.VITE_CATCHAP_EDU_SITE_KEY as string | undefined;
const WIDGET_API = `${
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000'
}/api/v1`;

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
    key: '사회', solid: '#8B6BFF', soft: '#EAE2FF', slotBg: 'linear-gradient(160deg,#FAF8FF,#F1EBFF)', dash: '#D6C8FF',
    mascotGrad: 'linear-gradient(160deg,#DCD0FF,#CBBAFF)', progGrad: 'linear-gradient(90deg,#A98CFF,#8B6BFF)',
    gameTitle: '사회 이야기 퀴즈', gameSub: '이야기 읽고 답 고르기', gameIcon: 'ph-fill ph-scroll',
    catLabel: '이야기·사회', catIcon: 'ph-fill ph-scroll',
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
  '사회': { q: '한글을 만드신 임금님은? 👑', pre: '옛날 이야기를 떠올리며, 알맞은 ', hi: '답 카드', post: '를 눌러요.' },
  '생활': { q: '횡단보도에서 바른 행동은? 🚸', pre: '안전을 먼저 생각하며, 알맞은 ', hi: '행동 카드', post: '를 눌러요.' },
};

// TODO(api): 과목별 보상 별 개수 — API 실패 시 원본 REWARDS 유지
const REWARDS: Record<string, number> = { '국어': 3, '영어': 1, '수학': 4, '과학': 0, '사회': 2, '생활': 4 };

export default function GameScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  /* 파라미터 소스: 내부 상태(navigate state) 우선, 없으면 쿼리스트링(딥링크·구버전 호환).
     이렇게 하면 앱 내 이동 시 주소창은 '/student/game' 만 깔끔히 보이고 파라미터는 노출 안 된다. */
  const navState = (location.state ?? null) as {
    subject?: string; chapter?: number; stage?: number; day?: number; replay?: boolean;
  } | null;
  const numQ = (k: string) => (searchParams.get(k) ? Number(searchParams.get(k)) : NaN);
  const pSubject = navState?.subject ?? searchParams.get('subject') ?? undefined;
  const pReplay = navState?.replay ?? (searchParams.get('replay') === '1');
  const pDay = navState?.day ?? numQ('day');
  const pChapter = navState?.chapter ?? numQ('chapter');
  const pStage = navState?.stage ?? numQ('stage');

  /* 원본 componentDidMount: subject → 없으면 hash → 기본 국어 */
  const [subjectIdx, setSubjectIdx] = useState(() => {
    let name = pSubject || '국어';
    try {
      if (!pSubject && window.location.hash) {
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
  // 복습 모드(replay): 전날 다시풀기·완료 후 재도전 — 기록은 남지만 오늘의퀴즈 상태·코인 보상 없음
  const isReplay = pReplay;

  /* ===== 교육형 위젯 세션 (전 과목 공통 — 실전 모드 대체) =====
     문항 발급·채점은 교육형 API가 담당하고, 위젯이 학생 토큰(data-auth)을 실어 보내
     서버가 채점 시점에 학습기록(코인·진도·오늘의퀴즈)을 적립한다.
     위젯 이벤트: 문항마다 catchap:answer, 세션(EDU_TOTAL문항) 완료 진행 시 catchap:finished. */
  // day=abc/0 같은 비정상 값은 무시 — NaN이 배너("NaN일차")로 새지 않게 1 이상 정수만 인정
  const dayParam = pDay;
  const day = Number.isInteger(dayParam) && dayParam >= 1 ? dayParam : undefined;
  // 전체학습 주간 챕터 모드: chapter&stage → 그 단계(2문항)를 같은 위젯으로 플레이.
  const chapterParam = pChapter;
  const chapter = Number.isInteger(chapterParam) && chapterParam >= 1 ? chapterParam : undefined;
  const stageParam = pStage;
  // 1~5만 인정 — 범위 밖(stage=99 등)은 무시해 진행바(총문항 계산)가 음수로 새지 않게
  const stage =
    Number.isInteger(stageParam) && stageParam >= 1 && stageParam <= 5 ? stageParam : undefined;
  const EDU_TOTAL = chapter ? 2 : 5; // 위젯 마운트 1회 세션: 챕터 한 단계=2문항, 오늘의퀴즈=5문항
  const CHAPTER_STAGES = 5; // 챕터 = 5단계 — 단계 완료 시 끊지 않고 다음 단계로 이어 간다
  // 챕터 연속 진행: URL의 stage는 시작 단계(없으면 1단계부터), 이후 단계는 상태로 전진(위젯 재마운트)
  const startStage = chapter ? (stage ?? 1) : stage;
  const [curStage, setCurStage] = useState<number | undefined>(startStage);

  // 주소창 정리 — 쿼리스트링(?subject=%EC..&chapter=..)으로 들어오면 최초 1회 clean path
  // '/student/game' 로 즉시 치환하고 파라미터는 navigate state로 보존한다(실서비스처럼 주소가 깔끔).
  useEffect(() => {
    const hasQuery = ['subject', 'chapter', 'stage', 'day', 'replay'].some(
      (k) => searchParams.get(k) != null,
    );
    if (hasQuery) {
      navigate(location.pathname, {
        replace: true,
        state: { subject: key, chapter, stage, day, replay: isReplay },
      });
    }
    // 최초 1회만 — strip 후 쿼리가 비므로 재실행되지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [stagesDone, setStagesDone] = useState(0); // 이번 세션에서 완료한 단계 수(시작 단계 기준 누적 아님 — 마지막 완료 단계 번호)
  const [stageBanner, setStageBanner] = useState<string | null>(null); // 비방해 전환 표시(토스트)
  const [quitAsk, setQuitAsk] = useState(false); // 그만하기 확인 팝업
  const [widgetStats, setWidgetStats] = useState({ answered: 0, correct: 0, wrong: 0, streak: 0 });
  // 인증이 풀려 채점은 되는데 적립(session 응답)이 빠지는 상태 — 조용히 유실되지 않게 경고
  const [authLost, setAuthLost] = useState(false);
  // 이벤트 리스너 안에서 최신 값을 읽기 위한 세션 가방(ref) — 스테일 클로저 방지
  const sessRef = useRef({
    answered: 0, correct: 0, wrong: 0,
    stagesDone: 0, coins: 0, sticker: false, stickerCoins: 0,
    bumpFailed: false, // 단계 저장(chapterStageComplete) 실패 — 결과 화면에 경고 표시
  });
  const navigatedRef = useRef(false); // 결과 이동 1회 가드(결과 보기 이중클릭 → 중복 내비 방지)
  useEffect(() => {
    setWidgetStats({ answered: 0, correct: 0, wrong: 0, streak: 0 });
    setAuthLost(false);
    setCurStage(startStage);
    setStagesDone(0);
    setStageBanner(null);
    sessRef.current = {
      answered: 0, correct: 0, wrong: 0, stagesDone: 0, coins: 0,
      sticker: false, stickerCoins: 0, bumpFailed: false,
    };
    navigatedRef.current = false;
  }, [key, chapter, stage]);

  /* 포인터 궤적 캡처 (#captcha-mount 영역) — 폴백(데모) 모드 완료 저장용.
     위젯 모드는 위젯 스크립트가 자체 캡처해 verify로 보낸다. */
  const mountRef = useRef<HTMLDivElement | null>(null);
  const tracerRef = useRef<PointerTraceRecorder | null>(null);
  useEffect(() => {
    if (!mountRef.current) return;
    const rec = attachPointerTrace(mountRef.current);
    tracerRef.current = rec;
    return () => {
      rec.detach();
      tracerRef.current = null;
    };
  }, []);
  useEffect(() => {
    tracerRef.current?.reset();
  }, [key]);

  /* 세션 시작 시각 — 결과 화면 풀이 시간·지난 기록 비교(before) 계산용 */
  const startedAt = useRef<number>(Date.now());
  useEffect(() => {
    startedAt.current = Date.now();
  }, [key, chapter, stage]);

  /* 결과 화면 이동 — 이번 세션 로컬 집계를 state로 실어 보낸다(서버 재조회 타이밍 무관) */
  const goResult = useCallback(
    (finished: boolean) => {
      if (navigatedRef.current) return; // finished 이중 발화 시 결과 페이지 중복 적재 방지
      navigatedRef.current = true;
      const bag = sessRef.current;
      // 주소창 정리 — 쿼리 없이 clean path. subject는 sess.subject에, day는 state로 넘긴다.
      navigate(PATHS.STUDENT_RESULT, {
        state: {
          day: day ?? null,
          sess: {
            subject: key,
            chapter: chapter ?? null,
            startStage: startStage ?? null,
            lastDoneStage: bag.stagesDone, // 완료한 마지막 단계(0=하나도 못 끝냄)
            finished, // true=끝까지(5단계 or 오늘의퀴즈 세션) 완료, false=그만하기 중도 종료
            answered: bag.answered,
            correct: bag.correct,
            wrong: bag.wrong,
            timeMs: Math.max(0, Date.now() - startedAt.current),
            replay: isReplay,
            coins: bag.coins,
            sticker: bag.sticker,
            stickerCoins: bag.stickerCoins,
            bumpFailed: bag.bumpFailed,
            startedIso: new Date(startedAt.current).toISOString(),
          },
        },
      });
    },
    [key, day, chapter, stage, isReplay, navigate],
  );

  /* 위젯 이벤트 배선 — 사이드패널 통계·효과음·단계 연속 진행·완료 시 결과 화면 이동 */
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const onAnswer = (e: Event) => {
      const d = (e as CustomEvent).detail as
        | { correct?: boolean; session?: { coins_earned?: number; sticker_awarded?: boolean; sticker_coins?: number } }
        | undefined;
      playSfx(d?.correct ? 'correct' : 'wrong');
      // session이 빠졌다 = 서버가 학생 인증을 못 받아 적립이 안 됨 (로그인 만료 등)
      setAuthLost(!d?.session);
      const bag = sessRef.current;
      bag.answered += 1;
      if (d?.correct) bag.correct += 1;
      else bag.wrong += 1;
      if (d?.session) {
        bag.coins += d.session.coins_earned ?? 0;
        if (d.session.sticker_awarded) {
          bag.sticker = true;
          bag.stickerCoins += d.session.sticker_coins ?? 0;
          // 6과목 완주 순간 — 방해 없는 토스트로 축하 (자정에 초기화되는 오늘의 스티커)
          setStageBanner(`🌟 오늘의 스티커 획득! 6과목 모두 완료 (+${d.session.sticker_coins ?? 0}코인)`);
          window.setTimeout(() => setStageBanner(null), 3000);
        }
      }
      setWidgetStats((st) => ({
        answered: st.answered + 1,
        correct: st.correct + (d?.correct ? 1 : 0),
        wrong: st.wrong + (d?.correct ? 0 : 1),
        streak: d?.correct ? st.streak + 1 : 0,
      }));
    };
    const onFinished = () => {
      playSfx('reward'); // 세션/단계 완주 팡파르 — 설정 '효과음' on일 때만
      // 챕터 모드: 단계 완료를 저장하고, 5단계 전이면 끊지 않고 다음 단계로 이어 간다.
      if (chapter && curStage) {
        const done = curStage;
        sessRef.current.stagesDone = done;
        setStagesDone(done);
        // 복습(이미 완주한 챕터 재도전)은 진행 커서를 건드리지 않는다
        if (!isReplay) {
          studentApi.chapterStageComplete({ subject: key, chapter, stage: done }).catch(() => {
            sessRef.current.bumpFailed = true; // 결과 화면에 '진행 저장 불안정' 경고 표시
          });
        }
        if (done < CHAPTER_STAGES) {
          // 비방해 전환 표시 후 다음 단계 위젯으로 재마운트 — 학생은 그대로 이어서 푼다
          setStageBanner(`✨ ${done}단계 완료! ${done + 1}단계로 넘어가요`);
          window.setTimeout(() => setStageBanner(null), 2200);
          setCurStage(done + 1);
          return;
        }
        goResult(true); // 5단계 완주 → 결과 화면
        return;
      }
      goResult(true); // 오늘의퀴즈(일차) 세션 완료 → 결과 화면
    };
    el.addEventListener('catchap:answer', onAnswer);
    el.addEventListener('catchap:finished', onFinished);
    return () => {
      el.removeEventListener('catchap:answer', onAnswer);
      el.removeEventListener('catchap:finished', onFinished);
    };
  }, [key, day, chapter, stage, curStage, isReplay, navigate, goResult]);

  /* 완료 클릭 → 실제 학습기록 저장(오늘의퀴즈 done·코인·진도·연속도전 반영) 후 결과로 이동.
     저장 실패 시에는 결과/코인 화면으로 넘어가지 않고 실패를 노출한다(거짓 완료 금지). */
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const finishSession = () => {
    if (saving) return;
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

    setSaving(true);
    setSaveError(false);
    // 행동 데이터(포인터 궤적)는 세션 마지막 저장에만 1건 싣는다
    const behavior = {
      solve_time_ms: solveMs,
      retry_count: 0,
      ...(tracerRef.current?.snapshot() ?? {}),
    };
    // 저장 실패를 삼키지 않는다 — 하나라도 실패하면 체인이 reject → 결과 화면으로 넘기지 않음
    const chain = outcomes.reduce<Promise<unknown>>((prev, result, i) => {
      const last = i === outcomes.length - 1;
      return prev.then(() =>
        studentApi.saveAttempt({
          subject: s.key,
          result,
          score: last ? (typeof s.score === 'number' ? s.score : 0) : 0,
          solve_time_ms: last ? solveMs : 0,
          retry_count: 0,
          completed: last && !isReplay, // 마지막에만 오늘의퀴즈 완료 처리 (복습은 제외)
          replay: isReplay, // 복습: 상태·코인 반영 안 함
          ...(last ? { behavior } : {}),
        }),
      );
    }, Promise.resolve());

    chain
      .then(() => {
        navigate(PATHS.STUDENT_RESULT, { state: { subject: s.key } });
      })
      .catch(() => {
        // 저장 실패 → 완료/코인 화면으로 넘어가지 않고 재시도 유도
        setSaving(false);
        setSaveError(true);
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

  /* 위젯 모드: 이 세션에서 푼 문항 수 기준 진행 표시 (풀이 중 문항 = answered+1)
     챕터 모드는 시작 단계~5단계까지 연속 진행이라 총 문항 = 남은 단계 수 × 2 */
  const sessionTotal =
    chapter && startStage ? (CHAPTER_STAGES - startStage + 1) * 2 : EDU_TOTAL;
  const curNo = EDU_SITE_KEY ? Math.min(widgetStats.answered + 1, sessionTotal) : s.current;
  const curTotal = EDU_SITE_KEY ? sessionTotal : s.total;
  const pct = Math.round(((EDU_SITE_KEY ? widgetStats.answered : s.current) / curTotal) * 100);
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
          {EDU_SITE_KEY ? (
            /* 위젯 모드: 그만하기 = 확인 팝업 → 여기까지 결과 보기 (그냥 증발하지 않음) */
            <button type="button" className="gs-quit" onClick={() => setQuitAsk(true)}>
              <i className="ph-bold ph-x" />
              그만하기
            </button>
          ) : (
            <Link to={PATHS.STUDENT_HOME} className="gs-quit">
              <i className="ph-bold ph-x" />
              그만하기
            </Link>
          )}
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
                문제 {curNo} / {curTotal}
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

          {/* 위젯 모드(EDU_SITE_KEY): 실제 문제는 위젯이 보여주므로
              바깥 제목은 정적 문항 대신 게임 제목만 노출해 이중 질문을 피한다. */}
          <h1 className="gs-question">{EDU_SITE_KEY ? s.gameTitle : qd.q}</h1>
          <p className="gs-subline">
            {EDU_SITE_KEY ? (
              <>
                아래 <span className="gs-subhi">{s.key}</span> 문제를 풀어봐요.
              </>
            ) : (
              <>
                {qd.pre}
                <span className="gs-subhi">{qd.hi}</span>
                {qd.post}
              </>
            )}
          </p>
          {EDU_SITE_KEY && day != null && (
            <div className={`gs-live-daybar${isReplay ? ' gs-live-daybar--replay' : ''}`}>
              <i className={isReplay ? 'ph-fill ph-arrow-counter-clockwise' : 'ph-fill ph-calendar-star'} />
              {day}일차 커리큘럼{isReplay ? ' · 복습(코인 없음)' : ' · 오늘 과제'}
            </div>
          )}
          {EDU_SITE_KEY && chapter != null && (
            /* 챕터 연속 진행 표시 — 완료 단계는 채움, 현재 단계는 테두리 강조 */
            <div className="gs-stagebar">
              <span className="gs-stagebar-label">{chapter}챕터</span>
              {Array.from({ length: CHAPTER_STAGES }, (_, i) => {
                const no = i + 1;
                const cls =
                  no <= stagesDone
                    ? ' gs-stageseg-done'
                    : no === curStage
                      ? ' gs-stageseg-cur'
                      : '';
                return (
                  <span key={no} className={`gs-stageseg${cls}`}>
                    {no}
                  </span>
                );
              })}
              {isReplay && <span className="gs-stagebar-replay">복습 · 코인 없음</span>}
            </div>
          )}
          {authLost && (
            <div className="gs-authwarn">
              <i className="ph-fill ph-warning-circle" />
              로그인이 풀려서 코인·진도가 저장되지 않고 있어요.
              <Link to={PATHS.LOGIN} className="gs-authwarn-link">다시 로그인</Link>
            </div>
          )}

          {/* ▼▼▼ CAPTCHA API MOUNT SLOT — 실제 게임 챌린지가 이 컨테이너 안에 렌더링됩니다 ▼▼▼ */}
          <div
            id="captcha-mount"
            ref={mountRef}
            data-captcha-slot="true"
            data-subject={s.key}
            data-question={curNo}
            className="gs-mount"
          >
            <span className="gs-mount-tagright">
              문제 {curNo}/{curTotal}
            </span>
            {stageBanner && (
              /* 비방해 전환/축하 토스트 — 위젯 조작을 막지 않는다(pointer-events 없음) */
              <div className="gs-stagebanner">{stageBanner}</div>
            )}
            {EDU_SITE_KEY ? (
              /* 1st-party 임베드 — 우리 앱이 교육형 API(위젯)를 직접 소비.
                 학생 토큰(auth)을 실어 서버가 채점 시점에 코인·진도·오늘의퀴즈를 적립하고,
                 행동데이터(behavior_summaries)도 학생 귀속으로 수집한다. */
              <CatchapWidget
                siteKey={EDU_SITE_KEY}
                api={WIDGET_API}
                subject={s.key}
                size="full"
                className="gs-mount-widget"
                auth={getFreshAccessToken}
                day={day}
                chapter={chapter}
                stage={curStage}
                replay={isReplay}
                total={EDU_TOTAL}
              />
            ) : (
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
            )}
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
                맞힌 문제 <span className="gs-statval gs-statval-ok">{EDU_SITE_KEY ? widgetStats.correct : s.correct}</span>
              </div>
              <div className="gs-statrow">
                <span className="gs-staticon gs-staticon-no">
                  <i className="ph-fill ph-x-circle" />
                </span>
                틀린 문제 <span className="gs-statval gs-statval-no">{EDU_SITE_KEY ? widgetStats.wrong : s.wrong}</span>
              </div>
              <div className="gs-statrow">
                <span className="gs-staticon gs-staticon-streak">
                  <i className="ph-fill ph-lightning" />
                </span>
                연속 정답 <span className="gs-statval gs-statval-streak">{EDU_SITE_KEY ? widgetStats.streak : s.streak}</span>
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

      {/* BOTTOM ACTION BAR — 폴백(데모) 모드 전용. 위젯 모드에선 진행·완료를
          위젯 풋터(다음 문제/결과 보기)가 담당하고 적립은 서버가 하므로 바가 필요 없다. */}
      {!EDU_SITE_KEY && (
        <div className="gs-bottombar">
          <div className="gs-bottombar-inner">
            <div className="gs-status">
              {s.key} · {s.current}/{s.total}문제 진행 중
            </div>
            <div className="gs-actions">
              <div className="gs-finishwrap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                {saveError && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#E23D3D', fontWeight: 700, fontSize: 13 }}>
                    <i className="ph-fill ph-warning-circle" />
                    저장에 실패했어요. 다시 시도해 주세요.
                  </span>
                )}
                <button className="gs-confirm" onClick={finishSession} disabled={saving}>
                  {saving ? '저장 중…' : saveError ? '다시 시도' : isLast ? '결과 보기' : '다음 문제'}{' '}
                  <i className="ph-fill ph-arrow-right" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 그만하기 확인 팝업 — 푼 문제가 있으면 '여기까지 결과 보기'로, 없으면 그냥 나가기 */}
      {quitAsk && (
        <div className="gs-quitpop-back" onClick={() => setQuitAsk(false)}>
          <div className="gs-quitpop" onClick={(e) => e.stopPropagation()}>
            <div className="gs-quitpop-icon">🏁</div>
            <div className="gs-quitpop-title">여기서 그만할까요?</div>
            <div className="gs-quitpop-msg">
              {widgetStats.answered > 0
                ? `지금까지 ${widgetStats.answered}문제를 풀었어요. 결과를 보여드릴게요!`
                : '아직 푼 문제가 없어요. 다음에 또 만나요!'}
            </div>
            <div className="gs-quitpop-btns">
              <button type="button" className="gs-quitpop-stay" onClick={() => setQuitAsk(false)}>
                계속 풀기
              </button>
              {widgetStats.answered > 0 ? (
                <button type="button" className="gs-quitpop-go" onClick={() => goResult(false)}>
                  결과 보기
                </button>
              ) : (
                <button
                  type="button"
                  className="gs-quitpop-go"
                  onClick={() => navigate(PATHS.STUDENT_HOME)}
                >
                  나가기
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <ScreenTimeReminder />
    </div>
  );
}
