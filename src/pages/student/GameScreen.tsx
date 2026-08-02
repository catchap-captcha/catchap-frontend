import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { studentApi } from '../../api/students';
import { getFreshAccessToken } from '../../api/client';
import { playSfx } from '../../utils/feedback';
import { attachPointerTrace, type PointerTraceRecorder } from '../../utils/pointerTrace';
import CatchapWidget from '../../components/captcha/CatchapWidget';
import { useTheme } from '../../hooks/useTheme';
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
    key: '국어', solid: '#ea5443', soft: '#FFE0DB', slotBg: 'linear-gradient(160deg,#FFFBF6,#FFF1EE)', dash: '#FFD6C4',
    mascotGrad: 'linear-gradient(160deg,#FFE6BE,#FFCFC9)', progGrad: 'linear-gradient(90deg,#FF8A5B,#ea5443)',
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

/** SRS 다음 복습일 표시 — "7월 21일 (내일)" 형태. 파싱 실패 시 빈 문자열(표시 생략). */
function fmtNextReview(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  const md = `${d.getMonth() + 1}월 ${d.getDate()}일`;
  if (diff <= 0) return `${md} (오늘)`;
  if (diff === 1) return `${md} (내일)`;
  return `${md} (${diff}일 후)`;
}

export default function GameScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  /* 파라미터 소스: 내부 상태(navigate state) 우선, 없으면 쿼리스트링(딥링크·구버전 호환).
     이렇게 하면 앱 내 이동 시 주소창은 '/student/game' 만 깔끔히 보이고 파라미터는 노출 안 된다. */
  const navState = (location.state ?? null) as {
    subject?: string; chapter?: number; stage?: number; day?: number; replay?: boolean; bank?: boolean;
    course?: string;
  } | null;
  const numQ = (k: string) => (searchParams.get(k) ? Number(searchParams.get(k)) : NaN);
  const pSubject = navState?.subject ?? searchParams.get('subject') ?? undefined;
  const pReplay = navState?.replay ?? (searchParams.get('replay') === '1');
  const pDay = navState?.day ?? numQ('day');
  const pChapter = navState?.chapter ?? numQ('chapter');
  const pStage = navState?.stage ?? numQ('stage');
  // 전체학습 문제은행 모드 — 안 푼>틀린>맞춘 우선 출제, 코인·오늘의퀴즈 미반영
  const pBank = navState?.bank ?? (searchParams.get('bank') === '1');
  // 코스 Q(3단계-b) — bank와 함께 오면 그 코스 강의 유래 문항만(수료 시험 훈련장)
  const pCourse = navState?.course ?? (searchParams.get('course') || undefined);

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
  /* API reward: {have, goal} — 디게임화(0723)로 화면 표시는 제거됐고 상태 로드만 유지(값 미사용) */
  const [, setRewards] = useState<Record<string, { have: number; goal: number }>>(() =>
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
  // 전체학습 = 문제은행(bank) 무한 모드(사용자 결정 0714): 주차(chapter)는 목차로 유지하되
  // 그 안에서 안 푼>틀린>푼 우선으로 '단계 없이' 무한 출제 — 위젯이 세션 총량 없이 계속
  // '다음 문제'를 낸다(2문항마다 '결과 보기'로 끊기던 문제 해소). 종료는 '그만하기'뿐.
  // (Q 통합 3단계-c) 은행이 기본 모드 — 챕터(구 5단계)·일차(day) 지정이 없는 진입은 전부
  // 오늘의 Q다(퀴즈 세션 은퇴로 비-bank 자유 세션이라는 것이 더 이상 없음). ?subject=만 있는
  // 옛 딥링크·북마크도 자연스럽게 Q로 흡수된다.
  const bankMode = pBank || (!chapter && !day);
  const infinite = bankMode; // 세션 총량 없음(무한)
  // 코스 Q 활성 조건: 코스는 과목 고정이라, 탭으로 진입 과목을 벗어나면 코스 범위도 벗어난
  // 것으로 보고 일반 오늘의 Q로 자연 전환한다(서버는 코스가 정본이라 과목 탭만 바꾸면
  // 계속 코스 문항이 나와 혼란 — 진입 URL엔 늘 코스의 과목이 함께 실린다).
  const courseId = bankMode && pCourse && key === (pSubject ?? key) ? pCourse : undefined;
  const EDU_TOTAL = chapter && !bankMode ? 2 : 5; // 챕터 단계=2문항, 오늘의퀴즈=5문항(bank는 미사용)
  const CHAPTER_STAGES = 5; // (구)챕터 5단계 — bank 모드에선 안 씀
  // 챕터 연속 진행: URL의 stage는 시작 단계(없으면 1단계부터), 이후 단계는 상태로 전진(위젯 재마운트)
  const startStage = chapter && !bankMode ? (stage ?? 1) : stage;
  const [curStage, setCurStage] = useState<number | undefined>(startStage);

  /* (은퇴 0719, Q 통합 3단계-c) 오늘의퀴즈 이어하기(resumeOffset·dailyQuiz 조회) 삭제 —
     퀴즈 세션 자체가 은퇴됐다(비-챕터·비-일차 진입은 아래 bankMode 기본값으로 전부 Q). */
  const skipToday = 0;

  // 주소창 정리 — 쿼리스트링(?subject=%EC..&chapter=..)으로 들어오면 최초 1회 clean path
  // '/student/game' 로 즉시 치환하고 파라미터는 navigate state로 보존한다(실서비스처럼 주소가 깔끔).
  useEffect(() => {
    const hasQuery = ['subject', 'chapter', 'stage', 'day', 'replay', 'bank', 'course'].some(
      (k) => searchParams.get(k) != null,
    );
    if (hasQuery) {
      navigate(location.pathname, {
        replace: true,
        state: { subject: key, chapter, stage, day, replay: isReplay, bank: pBank, course: pCourse },
      });
    }
    // 최초 1회만 — strip 후 쿼리가 비므로 재실행되지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [stagesDone, setStagesDone] = useState(0); // 이번 세션에서 완료한 단계 수(시작 단계 기준 누적 아님 — 마지막 완료 단계 번호)
  const [stageBanner, setStageBanner] = useState<string | null>(null); // 비방해 전환 표시(토스트)
  const [quitAsk, setQuitAsk] = useState(false); // 그만하기 확인 팝업
  const { theme } = useTheme(); // 위젯 리마운트 키 — 아래 CatchapWidget 주석 참고
  const [widgetStats, setWidgetStats] = useState({ answered: 0, correct: 0, wrong: 0, streak: 0 });
  /** 이번 세션에서 틀린 문제(최신순, 최대 5개) — 사이드바 '직전에 틀린 문제' 카드가 쓴다.
   *  큐가 알아서 다시 내주긴 하지만, 방금 뭘 틀렸는지 눈으로 확인할 방법이 없었다. */
  const [wrongList, setWrongList] = useState<{ no: number; prompt: string }[]>([]);
  /* 문제은행 SRS 큐(설계 question-bank-scale-design.md) — 오늘 큐 소진(catchap:bankdone) 시
     완료 화면, '미리 복습하기'는 위젯을 early로 재마운트해 휴면 문항을 잇는다. */
  const [bankDone, setBankDone] = useState<{ nextReviewAt: string | null } | null>(null);
  /* 오늘의 Q 일일 목표(1세트=10문제, 퀴즈 통합 1단계) — 입장 시점의 오늘 완료 수(base)에
     이번 세션 응답을 더해 진행을 그린다. ref로 들고 리스너 스테일 클로저를 피한다. */
  const goalRef = useRef<{ base: number; goal: number; celebrated: boolean } | null>(null);
  const [goalView, setGoalView] = useState<{ done: number; goal: number } | null>(null);
  useEffect(() => {
    if (!bankMode || !EDU_SITE_KEY) return;
    let on = true;
    studentApi
      .qToday()
      .then((d: any) => {
        if (!on || typeof d?.goal !== 'number') return;
        goalRef.current = { base: d.done_today ?? 0, goal: d.goal, celebrated: !!d.goal_met };
        setGoalView({ done: Math.min(d.done_today ?? 0, d.goal), goal: d.goal });
      })
      .catch(() => {}); // 실패 시 목표 표시만 생략(플레이는 정상)
    return () => {
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankMode]);
  const [earlyReview, setEarlyReview] = useState(false);
  /* 세트 단위(10문항) 중간 요약 — 무한처럼 느껴지던 은행 플레이에 단위감을 준다 */
  const BANK_SET_SIZE = 10;
  const [setBreak, setSetBreak] = useState<{ set: number; correct: number; total: number } | null>(null);
  // 인증이 풀려 채점은 되는데 적립(session 응답)이 빠지는 상태 — 조용히 유실되지 않게 경고
  const [authLost, setAuthLost] = useState(false);
  // 이벤트 리스너 안에서 최신 값을 읽기 위한 세션 가방(ref) — 스테일 클로저 방지
  const sessRef = useRef({
    answered: 0, correct: 0, wrong: 0,
    stagesDone: 0, coins: 0,
    bumpFailed: false, // 단계 저장(chapterStageComplete) 실패 — 결과 화면에 경고 표시
    setAnswered: 0, setCorrect: 0, // 은행 세트(10문항) 단위 카운터 — 세트 요약에 쓰고 리셋
  });
  const navigatedRef = useRef(false); // 결과 이동 1회 가드(결과 보기 이중클릭 → 중복 내비 방지)
  useEffect(() => {
    setWidgetStats({ answered: 0, correct: 0, wrong: 0, streak: 0 });
    setWrongList([]);
    setAuthLost(false);
    setCurStage(startStage);
    setStagesDone(0);
    setStageBanner(null);
    sessRef.current = {
      answered: 0, correct: 0, wrong: 0, stagesDone: 0, coins: 0,
      bumpFailed: false,
      // 은행 세트 카운터도 리셋 — 빠뜨리면 undefined+1=NaN으로 세트 요약이 영영 안 뜬다(0719 실증)
      setAnswered: 0, setCorrect: 0,
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
            bank: bankMode, // 전체학습 무한 문제은행 — 결과 화면이 단계/완주 대신 '연습 요약'을 보임
            startStage: startStage ?? null,
            lastDoneStage: bag.stagesDone, // 완료한 마지막 단계(0=하나도 못 끝냄)
            finished, // true=끝까지(5단계 or 오늘의퀴즈 세션) 완료, false=그만하기 중도 종료
            answered: bag.answered,
            correct: bag.correct,
            wrong: bag.wrong,
            timeMs: Math.max(0, Date.now() - startedAt.current),
            replay: isReplay,
            coins: bag.coins,
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
        | {
            correct?: boolean;
            /** 방금 푼 문제의 문제 텍스트 — 사이드바 '직전에 틀린 문제'가 쓴다.
             *  구버전 위젯은 안 보내므로 없으면 그 항목은 목록에서 생략한다. */
            prompt?: string;
            // (은퇴 0719) 퀴즈 보상 키(quiz_bonus·sticker_*)는 서버 응답에서 키째 사라짐
            session?: { coins_earned?: number };
          }
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
      }
      setWidgetStats((st) => ({
        answered: st.answered + 1,
        correct: st.correct + (d?.correct ? 1 : 0),
        wrong: st.wrong + (d?.correct ? 0 : 1),
        streak: d?.correct ? st.streak + 1 : 0,
      }));
      // 틀린 문제만 최신순으로 쌓아 사이드바에서 되짚어 본다(최대 5개).
      // 문제 텍스트를 못 받으면(구버전 위젯) 빈 항목을 만들지 않고 건너뛴다.
      if (!d?.correct && d?.prompt) {
        const text = d.prompt;
        setWrongList((prev) => [{ no: bag.answered, prompt: text }, ...prev].slice(0, 5));
      }
      // 은행 모드 세트 단위감 — 10문항마다 중간 요약(계속/그만)을 띄운다
      if (bankMode) {
        bag.setAnswered += 1;
        if (d?.correct) bag.setCorrect += 1;
        if (bag.setAnswered >= BANK_SET_SIZE) {
          setSetBreak({
            set: Math.max(1, Math.round(bag.answered / BANK_SET_SIZE)),
            correct: bag.setCorrect,
            total: bag.setAnswered,
          });
          bag.setAnswered = 0;
          bag.setCorrect = 0;
        }
        // 일일 목표(오늘의 Q) 진행 갱신 + 달성 순간 1회 축하(비방해 토스트)
        const g = goalRef.current;
        if (g) {
          const doneNow = g.base + bag.answered;
          setGoalView({ done: Math.min(doneNow, g.goal), goal: g.goal });
          if (!g.celebrated && doneNow >= g.goal) {
            g.celebrated = true;
            setStageBanner('오늘 목표 달성 — 연속 학습일이 쌓였어요');
            window.setTimeout(() => setStageBanner(null), 3500);
          }
        }
      }
    };
    /* 문제은행 '오늘 완료' — 위젯이 큐 소진을 알리면(서버 all_done) 완료 화면을 띄운다.
       에러가 아니라 상태다(무한 재순환 폐지 — 설계 question-bank-scale-design.md). */
    const onBankDone = (e: Event) => {
      const d = (e as CustomEvent).detail as { next_review_at?: string | null } | undefined;
      setBankDone({ nextReviewAt: d?.next_review_at ?? null });
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
          setStageBanner(`${done}단계 완료 — ${done + 1}단계로 넘어갑니다`);
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
    el.addEventListener('catchap:bankdone', onBankDone);
    return () => {
      el.removeEventListener('catchap:answer', onAnswer);
      el.removeEventListener('catchap:finished', onFinished);
      el.removeEventListener('catchap:bankdone', onBankDone);
    };
  }, [key, day, chapter, stage, curStage, isReplay, navigate, goResult, bankMode]);

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
    chapter && startStage && !bankMode ? (CHAPTER_STAGES - startStage + 1) * 2 : EDU_TOTAL;
  // 이어하기: 카운터는 '오늘 전체'(skipToday 포함) 기준 — 3/5까지 풀고 새로고침하면 4/5부터.
  // bank(무한)는 총량이 없으므로 '푼 문제 수'만 센다.
  const curNo = EDU_SITE_KEY
    ? (infinite ? widgetStats.answered + 1 : Math.min(skipToday + widgetStats.answered + 1, sessionTotal))
    : s.current;
  const curTotal = EDU_SITE_KEY ? sessionTotal : s.total;
  const pct = infinite
    ? 0
    : Math.round(((EDU_SITE_KEY ? skipToday + widgetStats.answered : s.current) / curTotal) * 100);
  const isLast = s.current >= s.total;

  const qd = questions[s.key] ?? { q: '', pre: '', hi: '', post: '' };

  /* 화면 스코프 토큰 — 값이 밝은 색으로만 박혀 있어 다크 모드에서 위젯 슬롯이 흰 판으로
     남았다(위젯 글자가 다크 팔레트로 바뀌자 흰 배경 위 흰 글자가 됐다). 테마별로 나눈다. */
  const themeVars = (
    theme === 'dark'
      ? {
          '--gs-solid': '#f0f0f0',
          '--gs-soft': 'rgba(255,255,255,0.10)',
          '--gs-slot-bg': '#15181d',
          '--gs-dash': 'rgba(255,255,255,0.26)',
          '--gs-mascot-grad': 'linear-gradient(160deg,#33383f,#22262b)',
          '--gs-prog-grad': 'linear-gradient(90deg,#c9cdd4,#f0f0f0)',
        }
      : {
          '--gs-solid': '#1a1a1a',
          '--gs-soft': '#f0f0f0',
          '--gs-slot-bg': '#fafafa',
          '--gs-dash': 'rgba(26,26,26,0.28)',
          '--gs-mascot-grad': 'linear-gradient(160deg,#e6e6e6,#d2d2d2)',
          '--gs-prog-grad': 'linear-gradient(90deg,#3a3a3c,#1a1a1a)',
        }
  ) as CSSProperties;

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
          {infinite ? (
            /* 무한 문제은행 — '푼 문제 수'는 왼쪽에, '무한 연습' 안내는 상단바 오른쪽 끝으로 */
            <>
              <div className="gs-progress gs-progress--infinite">
                <span className="gs-progress-count">{curNo}번째 문제</span>
              </div>
              <span className="gs-infinite">∞ 무한 연습</span>
            </>
          ) : (
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
          )}
        </div>
        {/* SUBJECT SWITCHER */}
        <div className="gs-tabs">
          {subjects.map((sub, i) =>
            i === subjectIdx ? (
              <button
                key={sub.key}
                onClick={() => setSubjectIdx(i)}
                className="gs-tab gs-tab-active"
                style={{ background: 'var(--brand)', boxShadow: '0 8px 16px -8px var(--brand)' }}
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
          {EDU_SITE_KEY && chapter != null && bankMode && (
            /* 챕터 스코프 문제은행 — 주차 목차 유지, 그 주차 안에서 SRS 우선(복습 폴백) */
            <div className={`gs-live-daybar${isReplay ? ' gs-live-daybar--replay' : ''}`}>
              <i className="ph-fill ph-infinity" />
              {chapter}주차 · 복습→틀린→새 문제 순{isReplay ? ' · 복습' : ''}
            </div>
          )}
          {EDU_SITE_KEY && chapter == null && bankMode && (
            /* 과목 전체 SRS 큐 — 사용자 대면 명칭은 '오늘의 Q'(0719 사용자 결정). 비우면 '오늘 완료'.
               코스 Q(course)는 같은 큐를 그 코스 강의 유래 문항으로만 좁힌 것. */
            <div className="gs-live-daybar">
              <i className={earlyReview ? 'ph-fill ph-arrow-counter-clockwise' : 'ph-fill ph-stack'} />
              {earlyReview
                ? '미리 복습 중 · 만기가 가까운 문제부터'
                : courseId
                  ? '코스 Q · 이 코스 강의의 문제만'
                  : '오늘의 Q · 복습→틀린→새 문제 순'}
              {goalView && (
                <span className="gs-daybar-goal">
                  오늘 목표 {goalView.done}/{goalView.goal}
                  {goalView.done >= goalView.goal ? ' 달성' : ''}
                </span>
              )}
            </div>
          )}
          {EDU_SITE_KEY && chapter != null && !bankMode && (
            /* (구)챕터 5단계 진행 표시 — bank 전환 전 경로 호환 */
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
            /* 위젯이 실제로 붙는 슬롯은 실선(내용이 든 카드), 위젯 키가 없어 자리표시만
               띄우는 경우에만 점선(진짜 빈 슬롯) — 점선은 '아직 안 채워짐'의 관용구라
               위젯이 들어와 있는데 쓰면 로딩 실패처럼 보인다. */
            className={`gs-mount${EDU_SITE_KEY ? '' : ' gs-mount--slot'}`}
          >
            {stageBanner && (
              /* 비방해 전환/축하 토스트 — 위젯 조작을 막지 않는다(pointer-events 없음) */
              <div className="gs-stagebanner">{stageBanner}</div>
            )}
            {bankMode && bankDone && (
              /* 오늘의 큐 소진 — 완료를 축하하고 다음 복습일을 알린다(무한 재순환 폐지).
                 '미리 복습하기'는 위젯을 early로 재마운트해 휴면 문항을 이어서 낸다. */
              <div className="gs-bankoverlay">
                <div className="gs-bankcard">
                  <b className="gs-bankcard-title">오늘 분량을 모두 마쳤습니다</b>
                  <p className="gs-bankcard-desc">
                    복습할 문제도, 틀린 문제도, 새 문제도 지금은 없습니다.
                    {bankDone.nextReviewAt && fmtNextReview(bankDone.nextReviewAt) ? (
                      <>
                        <br />다음 복습: <b>{fmtNextReview(bankDone.nextReviewAt)}</b>
                      </>
                    ) : null}
                  </p>
                  <div className="gs-bankcard-actions">
                    <button
                      className="gs-bankcard-btn gs-bankcard-btn--sub"
                      onClick={() => {
                        setBankDone(null);
                        setEarlyReview(true); // 위젯 재마운트 → early=true로 휴면 복습
                      }}
                    >
                      <i className="ph-bold ph-arrow-counter-clockwise" /> 미리 복습하기
                    </button>
                    <button
                      className="gs-bankcard-btn"
                      onClick={() => {
                        if (sessRef.current.answered > 0) goResult(true);
                        else navigate(PATHS.STUDENT_ALL_LEARNING);
                      }}
                    >
                      오늘은 여기까지 <i className="ph-bold ph-arrow-right" />
                    </button>
                  </div>
                </div>
              </div>
            )}
            {bankMode && setBreak && !bankDone && (
              /* 세트(10문항) 중간 요약 — 무한처럼 느껴지던 플레이에 단위감(계속/그만) */
              <div className="gs-bankoverlay">
                <div className="gs-bankcard">
                  <b className="gs-bankcard-title">{setBreak.set}세트 완료</b>
                  <p className="gs-bankcard-desc">
                    {setBreak.total}문제 중 <b>{setBreak.correct}개</b> 맞혔습니다.
                  </p>
                  <div className="gs-bankcard-actions">
                    <button className="gs-bankcard-btn gs-bankcard-btn--sub" onClick={() => goResult(true)}>
                      그만하기
                    </button>
                    <button className="gs-bankcard-btn" onClick={() => setSetBreak(null)}>
                      계속 풀기 <i className="ph-bold ph-arrow-right" />
                    </button>
                  </div>
                </div>
              </div>
            )}
            {EDU_SITE_KEY ? (
              /* 1st-party 임베드 — 우리 앱이 교육형 API(위젯)를 직접 소비.
                 학생 토큰(auth)을 실어 서버가 채점 시점에 학습기록·SRS 상태를 적립하고,
                 행동데이터(behavior_summaries)도 학생 귀속으로 수집한다. */
              <CatchapWidget
                /* 테마가 바뀌면 key가 바뀌어 위젯이 다시 마운트된다 — 위젯은 색을 인라인
                   스타일로 박기 때문에, 다시 그리지 않으면 이미 그려진 문항이 옛 팔레트로
                   남는다(라이트 카드 위에 다크 글자 같은 상태). */
                key={`w-${theme}`}
                siteKey={EDU_SITE_KEY}
                api={WIDGET_API}
                subject={s.key}
                size="full"
                className="gs-mount-widget"
                auth={getFreshAccessToken}
                day={day}
                chapter={chapter}
                stage={bankMode ? undefined : curStage}
                replay={isReplay}
                bank={bankMode}
                early={earlyReview}
                course={courseId}
                total={infinite ? undefined : EDU_TOTAL - skipToday}
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
          <div className="gs-card">
            {/* 아이콘 타일 3개를 세로로 쌓던 목록을 3열 숫자 그리드로 바꿨다 — 타일이 값보다
                커서 시선이 장식에 먼저 갔고, 세로로 길어 카드가 비어 보였다. 숫자를 앞세우고
                색은 값에만 남긴다(맞힘 초록·틀림 빨강·연속 골드). 위에 정답률 요약을 둬서
                세 숫자를 한 문장으로 읽게 한다. */}
            <div className="gs-card-title">이번 학습 진행</div>
            {(() => {
              const ok = EDU_SITE_KEY ? widgetStats.correct : s.correct;
              const no = EDU_SITE_KEY ? widgetStats.wrong : s.wrong;
              const st = EDU_SITE_KEY ? widgetStats.streak : s.streak;
              const solved = ok + no;
              const rate = solved > 0 ? Math.round((ok / solved) * 100) : null;
              return (
                <>
                  <div className="gs-statsum">
                    <span className="gs-statsum-num">{rate == null ? '–' : `${rate}%`}</span>
                    <span className="gs-statsum-label">
                      정답률
                      <small>{solved === 0 ? '아직 푼 문제가 없어요' : `${solved}문제 풀이`}</small>
                    </span>
                  </div>
                  <div className="gs-statgrid">
                    <div className="gs-stat">
                      <span className="gs-stat-num gs-stat-num--ok">{ok}</span>
                      <span className="gs-stat-label">맞힘</span>
                    </div>
                    <div className="gs-stat">
                      <span className="gs-stat-num gs-stat-num--no">{no}</span>
                      <span className="gs-stat-label">틀림</span>
                    </div>
                    <div className="gs-stat">
                      <span className="gs-stat-num gs-stat-num--streak">{st}</span>
                      <span className="gs-stat-label">연속 정답</span>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* 직전에 틀린 문제 — 이번 세션에서 틀린 문항을 최신순으로 되짚는다.
              큐가 '복습→틀린→새 문제 순'이라 어차피 다시 나오지만, 방금 무엇을 틀렸는지
              눈으로 확인할 방법이 없어서 넣었다. 문제 텍스트는 위젯이 catchap:answer로 준다. */}
          <div className="gs-card">
            <div className="gs-card-title">직전에 틀린 문제</div>
            {wrongList.length === 0 ? (
              <p className="gs-wrong-empty">
                아직 틀린 문제가 없어요.
                <small>틀리면 여기에 모아 두고, 큐가 다시 내줍니다.</small>
              </p>
            ) : (
              <ul className="gs-wrong-list">
                {wrongList.map((w) => (
                  <li key={`${w.no}-${w.prompt}`} className="gs-wrong-item">
                    <span className="gs-wrong-no">문제{w.no}</span>
                    <span className="gs-wrong-text">{w.prompt}</span>
                  </li>
                ))}
              </ul>
            )}
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
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--danger)', fontWeight: 700, fontSize: 13 }}>
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

      {/* 그만하기 확인 팝업 — 결과 화면은 생략하고 홈으로. 푼 문제는 문항마다 서버가
          이미 저장했으므로(코인·진도·오늘의퀴즈) 그냥 나가도 유실 없다. 결과 화면은
          '오늘치(5문항) 완료' 때만 뜬다(catchap:finished → goResult(true)). */}
      {quitAsk && (
        <div className="gs-quitpop-back" onClick={() => setQuitAsk(false)}>
          <div className="gs-quitpop" onClick={(e) => e.stopPropagation()}>
            <div className="gs-quitpop-title">여기서 그만하시겠습니까?</div>
            <div className="gs-quitpop-msg">
              {widgetStats.answered > 0
                ? `지금까지 푼 ${widgetStats.answered}문제는 저장했어요. 결과를 보고 마칠까요?`
                : '아직 푼 문제가 없어요. 다음에 또 만나요!'}
            </div>
            <div className="gs-quitpop-btns">
              <button type="button" className="gs-quitpop-stay" onClick={() => setQuitAsk(false)}>
                계속 풀기
              </button>
              {widgetStats.answered > 0 ? (
                /* 그만하기 → 결과 선택: 여기까지 푼 만큼(중도 종료)의 결과 화면으로 이동 */
                <button
                  type="button"
                  className="gs-quitpop-go"
                  onClick={() => {
                    setQuitAsk(false);
                    goResult(false);
                  }}
                >
                  여기까지 결과 보기
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
            {widgetStats.answered > 0 && (
              /* 결과 화면 없이 곧장 나가기 — 푼 문제는 이미 문항마다 서버 저장됨 */
              <button
                type="button"
                onClick={() => navigate(PATHS.STUDENT_HOME)}
                style={{
                  marginTop: 12, background: 'none', border: 'none', color: 'var(--ink-3)',
                  fontWeight: 700, fontSize: 13, cursor: 'pointer', textDecoration: 'underline',
                }}
              >
                결과 없이 그냥 나가기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
