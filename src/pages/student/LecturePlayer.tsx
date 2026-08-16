import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import {
  API_ORIGIN,
  errorDetail,
  isActiveElsewhere,
  lectureApi,
  type HeartbeatState,
  type ExamState,
  type LectureDetail,
  type LectureItem,
  type LectureReviewsData,
  type LectureSession,
} from '../../api/lectures';
import { getFreshAccessToken } from '../../api/client';
import { MotionCollector, watchPointer } from '../../lib/motionSummary';
import CatchapWidget from '../../components/captcha/CatchapWidget';
import CollectCaptcha from '../../components/captcha/CollectCaptcha';
import { useCollectParticipant } from '../../hooks/useCollectParticipant';
import { useTheme } from '../../hooks/useTheme';
import wordmark from '../../assets/brand/catchap-wordmark.png';
import wordmarkWhite from '../../assets/brand/catchap-wordmark-white.png';
import {
  LECTURE_SUBJECTS,
  formatClock,
  formatDurationLabel,
} from './lectureSubjects';
import './LecturePlayer.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

const EDU_SITE_KEY = import.meta.env.VITE_CATCHAP_EDU_SITE_KEY as string | undefined;
const WIDGET_API = `${API_ORIGIN}/api/v1`;

const HEARTBEAT_MS = 10_000; // 하트비트 주기 — 서버 상한(시간당 720회)에 여유
const SPEEDS = [0.5, 1.0, 1.25, 1.5, 2.0]; // 배속 상한 2배(서버 속도검증과 일치)
const MAX_RATE = 2;
const SEEK_TOLERANCE_SEC = 1; // 본 데(watched_max)에서 이 이상 앞으로 seek하면 되돌린다
// 오답 상한 — 한 체크포인트에서 이만큼 연속 오답하면 그 대목을 되감아 다시 본다.
// 서버(lecture_service.MAX_CHECKPOINT_FAILS·REWIND_SEC)가 watched_max를 실제로 되감아
// 강제하고(그 전엔 새 문항 발급을 409로 막는다), 여기 값은 그와 맞춰 UI(되감기 seek)를 몬다.
const MAX_CHECKPOINT_FAILS = 3;
const REWIND_SEC = 30;

/** 배속 표기 — 1 → '1.0', 1.25 → '1.25', 0.5 → '0.5' */
function formatRate(r: number): string {
  return r.toFixed(2).replace(/0$/, '');
}

type Overlay =
  | { kind: 'conflict' } // 다른 곳에서 시청 중(409) — 이어보기 안내
  | { kind: 'dead'; message: string } // 세션 무효(403 등) — 다시 시작 안내
  | { kind: 'videoError' }; // 스트림 재생 실패(세션 교체로 403 등)

export default function LecturePlayer() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  /* 파라미터 관용구: navigate state 우선, 쿼리(?id=) 딥링크는 최초 1회 주소창 정리 */
  const navState = (location.state ?? null) as { id?: string } | null;
  const lectureId = navState?.id ?? searchParams.get('id') ?? '';
  /* 행동데이터 수집 참여자(`?collect=`) — 바로 아래 이펙트가 주소창의 쿼리를 통째로 지우므로
     렌더 시점에 낚아채야 한다(훅이 처리). 값이 없으면 수집 위젯이 아예 안 붙는다. */
  const collectParticipant = useCollectParticipant();
  useEffect(() => {
    if (searchParams.get('id')) {
      navigate(location.pathname, { replace: true, state: { id: lectureId } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [meta, setMeta] = useState<LectureDetail | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errMsg, setErrMsg] = useState('');
  // 수강신청 게이트 — 코스 강의를 미신청 상태로 열면 서버가 403(not_enrolled)을 준다.
  // 그 코스 id를 담아 '수강신청하고 바로 보기' 화면을 띄운다(에러 대신 행동 유도).
  const [notEnrolled, setNotEnrolled] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [streamSrc, setStreamSrc] = useState<string | null>(null);

  /* 플레이어 상태 */
  const [playing, setPlaying] = useState(false);
  const [curTime, setCurTime] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [volOpen, setVolOpen] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const [rotated, setRotated] = useState(false); // 전체화면 안에서 가로로 돌렸는지(회전 버튼)
  const [isTouch] = useState(
    () =>
      typeof window !== 'undefined' &&
      (navigator.maxTouchPoints > 0 || window.matchMedia?.('(pointer: coarse)').matches === true),
  );
  const [watchedMax, setWatchedMax] = useState(0);
  const [doneCelebrated, setDoneCelebrated] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [hbWarn, setHbWarn] = useState(false); // 하트비트 저장 실패(네트워크) — 정직한 경고 배너
  const [tab, setTab] = useState<'list' | 'materials' | 'notes' | 'reviews'>('list');
  // 유휴 자동 숨김 — 재생 중 마우스가 멈추면 컨트롤 바(+상단 태그)를 감춘다(표준 플레이어 동작).
  const [idle, setIdle] = useState(false);
  // 강의 노트 — 타임스탬프 메모. 서버 저장 인프라가 없어 이 기기(localStorage)에만 담는다.
  // 실서비스(인프런·Udemy)의 '강의 노트'를 백엔드 없이 정직하게(개인·로컬 명시) 구현한 것.
  const [notes, setNotes] = useState<{ id: string; t: number; text: string }[]>([]);
  const [noteText, setNoteText] = useState('');
  // 수강 후기 — 서버 저장(lecture_reviews). 별점+텍스트, 수강생만 작성(upsert).
  const [reviews, setReviews] = useState<LectureReviewsData | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [myReviewText, setMyReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  /* 캡차 게이트 */
  const [gate, setGate] = useState<{ cp: number } | null>(null);
  const [gateKey, setGateKey] = useState(0); // 오답 시 위젯 재마운트(새 문제)
  const [gateWrong, setGateWrong] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null); // 전체화면 대상(플레이어 카드)
  const idleTimerRef = useRef<number | null>(null); // 유휴 컨트롤 숨김 타이머
  const gateHostRef = useRef<HTMLDivElement | null>(null);
  const sessionTokenRef = useRef<string | null>(null);
  const hadOwnSessionRef = useRef(false); // 이 탭에서 발급받은 세션이 있었나(강의 전환 시 자동 이어받기 판단)
  const watchedMaxRef = useRef(0);
  // 시청 완료(다시보기) 모드 — 서버 정본 status==='done'인 강의는 이미 시청검증을 통과했으므로
  // 재시청 땐 확인 문제(캡차)·앞으로-seek 제한을 푼다. 안 본 강의는 false라 검증이 그대로 걸린다.
  const reviewModeRef = useRef(false);
  const reviewHintedForRef = useRef(''); // 완료 안내 토스트를 강의당 1회만 띄우기 위한 가드
  const nextCpRef = useRef<number | null>(null);
  // (제거됨 0717) interacted/tab_hidden 자기신고 추적 — 면제·의심 가중이 서버에서
  // 걷혀 보낼 곳이 없다. 하트비트 본문은 position_sec 하나다.
  const beatingRef = useRef(false); // 하트비트 in-flight 가드
  const lastBeatAtRef = useRef(0);
  const gateRef = useRef<{ cp: number } | null>(null);
  const wrongCountRef = useRef(0); // 이 체크포인트에서 연속 오답 수 — 상한 도달 시 되감기
  const overlayRef = useRef<Overlay | null>(null);
  // 강의 전환 세대 토큰 — 이전 강의의 하트비트 응답이 늦게 도착해 새 강의 상태(watchedMax·
  // 게이트·오버레이)를 오염시키지 않게, 응답 적용 전에 세대 일치를 검사한다(skeptic 1-c).
  const genRef = useRef(0);
  const pendingSeekRef = useRef<number | null>(null); // 세션 교체 후 이어볼 위치
  const toastTimerRef = useRef<number | null>(null);
  gateRef.current = gate;
  overlayRef.current = overlay;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const applySession = useCallback((s: LectureSession) => {
    sessionTokenRef.current = s.session_token;
    hadOwnSessionRef.current = true;
    watchedMaxRef.current = s.watched_max_sec;
    setWatchedMax(s.watched_max_sec);
    nextCpRef.current = s.next_checkpoint_sec;
    // 이어보기 — 본 데(watched_max)에서 시작. 거의 끝(2초 이내)이거나 처음이면 0부터.
    if (s.watched_max_sec > 0 && s.watched_max_sec < s.duration_sec - 2) {
      pendingSeekRef.current = s.watched_max_sec;
    }
    setStreamSrc(`${API_ORIGIN}${s.stream_url}`);
  }, []);

  /* ---- 진입: 상세 + 세션 발급 ---- */
  useEffect(() => {
    if (!lectureId) {
      setPhase('error');
      setErrMsg('강의 정보가 없어요. 강의 목록에서 다시 들어와 주세요.');
      return;
    }
    let on = true;
    genRef.current += 1; // 이전 강의의 in-flight 하트비트 응답 무효화
    // 강의 전환 시 상태 리셋
    setMeta(null);
    setPhase('loading');
    setNotEnrolled(null);
    setOverlay(null);
    setStreamSrc(null);
    setGate(null);
    setGateWrong(false);
    setCurTime(0);
    setPlaying(false);
    setHbWarn(false);
    setDoneCelebrated(false);
    setTab('list');
    sessionTokenRef.current = null;
    nextCpRef.current = null;

    (async () => {
      try {
        const d = await lectureApi.detail(lectureId);
        if (!on) return;
        setMeta(d);
        watchedMaxRef.current = d.progress?.watched_max_sec ?? 0;
        setWatchedMax(watchedMaxRef.current);
        try {
          const s = await lectureApi.startSession(lectureId);
          if (!on) return;
          applySession(s);
          setPhase('ready');
        } catch (e) {
          if (!on) return;
          if (isActiveElsewhere(e)) {
            // 이 탭에서 방금 다른 강의를 보고 있었다면 그 세션이 걸린 것 — 조용히 이어받는다
            if (hadOwnSessionRef.current) {
              try {
                const s = await lectureApi.takeover(lectureId);
                if (!on) return;
                applySession(s);
                setPhase('ready');
                return;
              } catch {
                /* 이어받기 실패 → 아래 안내 오버레이로 */
              }
            }
            setPhase('ready');
            setOverlay({ kind: 'conflict' });
          } else {
            setPhase('error');
            setErrMsg(errorDetail(e, '재생을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.'));
          }
        }
      } catch (e) {
        if (!on) return;
        // 수강신청 게이트 — 미신청(403 not_enrolled)이면 에러 대신 수강신청 유도 화면으로
        const resp = (e as {
          response?: { status?: number; data?: { detail?: { reason?: string; course_id?: string } } };
        })?.response;
        if (resp?.status === 403 && resp.data?.detail?.reason === 'not_enrolled') {
          setNotEnrolled(resp.data.detail.course_id ?? '');
          return;
        }
        setPhase('error');
        setErrMsg(errorDetail(e, '강의를 불러오지 못했어요.'));
      }
    })();
    return () => {
      on = false;
    };
  }, [lectureId, applySession]);

  // 수강신청 결제 화면으로 — 결제를 완료하면 수강신청이 활성화된다(결제 후 이 강의로 돌아와 열람).
  const enrollAndEnter = () => {
    if (!notEnrolled) return;
    navigate(`${PATHS.STUDENT_CHECKOUT}?course=${notEnrolled}`);
  };

  /* ---- 하트비트 ---- */
  const openGate = useCallback((cp: number) => {
    const v = videoRef.current;
    if (v && !v.paused) v.pause();
    setGateWrong(false);
    wrongCountRef.current = 0; // 새 체크포인트 — 연속 오답 카운터 초기화
    setGateKey((k) => k + 1);
    setGate({ cp });
  }, []);

  const handleBeatState = useCallback(
    (st: HeartbeatState) => {
      watchedMaxRef.current = st.watched_max_sec;
      setWatchedMax(st.watched_max_sec);
      nextCpRef.current = st.next_checkpoint_sec;
      setHbWarn(false);
      if (st.status === 'done') {
        // 완주하는 순간부터 다시보기 모드 — 이 뒤로는 확인 문제를 띄우지 않는다.
        reviewModeRef.current = true;
        if (!doneCelebrated) {
          setDoneCelebrated(true);
          showToast('강의를 끝까지 다 봤어요! 🎉');
        }
      }
      if (st.checkpoint_due && !gateRef.current && !reviewModeRef.current) {
        openGate(st.next_checkpoint_sec ?? Math.floor(videoRef.current?.currentTime ?? 0));
      }
    },
    [doneCelebrated, openGate, showToast],
  );

  /** 하트비트 사이의 포인터 움직임을 모은다. 좌표는 이 안에서만 살아 있다. */
  const motionRef = useRef(new MotionCollector());

  // 재생 중일 때만 듣는다. 멈춰 있거나 캡차 게이트가 떠 있으면 볼 이유가 없다.
  useEffect(() => {
    if (phase !== 'ready') return;
    return watchPointer(motionRef.current);
  }, [phase]);

  const sendBeat = useCallback(async () => {
    const v = videoRef.current;
    const token = sessionTokenRef.current;
    if (!v || !token || beatingRef.current || overlayRef.current) return;
    beatingRef.current = true;
    lastBeatAtRef.current = Date.now();
    const gen = genRef.current; // 이 비트가 속한 강의 세대
    // 이 구간의 포인터 움직임을 숫자 몇 개로 접어 함께 보낸다. 좌표는 안 보낸다
    // (`lib/motionSummary.ts` 헤더 참고). 지금은 기록만 하고 판정에 쓰지 않는다 —
    // 정상 시청자의 분포를 먼저 알아야 기준을 정할 수 있다.
    const body = {
      position_sec: Math.floor(v.currentTime),
      motion: motionRef.current.take(),
    };
    try {
      const st = await lectureApi.heartbeat(lectureId, token, body);
      if (gen !== genRef.current) return; // 강의가 바뀐 뒤 도착한 stale 응답 — 버린다
      handleBeatState(st);
    } catch (e) {
      if (gen !== genRef.current) return; // stale 에러(이전 강의 409 등)로 오버레이 오발 금지
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        v.pause();
        setOverlay({ kind: 'conflict' });
      } else if (status === 403) {
        v.pause();
        setOverlay({ kind: 'dead', message: errorDetail(e, '시청 세션이 만료됐어요. 다시 시작해 주세요.') });
      } else {
        // 네트워크 등 — 진행 저장이 안 되고 있음을 숨기지 않는다(성공처럼 두지 않음)
        setHbWarn(true);
      }
    } finally {
      beatingRef.current = false;
    }
  }, [lectureId, handleBeatState]);

  useEffect(() => {
    if (phase !== 'ready') return;
    const t = window.setInterval(() => {
      const v = videoRef.current;
      if (!v || v.paused || gateRef.current || overlayRef.current) return;
      void sendBeat();
    }, HEARTBEAT_MS);
    return () => window.clearInterval(t);
  }, [phase, sendBeat]);

  /* ---- 캡차 게이트: catchap:answer 이벤트로 통과/오답 감지 ---- */
  useEffect(() => {
    if (!gate) return;
    const host = gateHostRef.current;
    if (!host) return;
    const onAnswer = (ev: Event) => {
      const d = (ev as CustomEvent).detail as
        | {
            correct?: boolean;
            /** 강의 게이트의 서버 정본 — verify가 통과 재예약·오답 되감기까지 반영해 돌려준다 */
            lecture?: {
              watched_max_sec?: number;
              next_checkpoint_sec?: number | null;
            } | null;
          }
        | undefined;
      // 서버 정본이 오면 로컬 미러를 즉시 동기화 — 되감기·재예약 판정의 기준값.
      const lec = d?.lecture ?? null;
      if (lec && typeof lec.watched_max_sec === 'number') {
        watchedMaxRef.current = lec.watched_max_sec;
        setWatchedMax(lec.watched_max_sec);
        nextCpRef.current = lec.next_checkpoint_sec ?? null;
      }
      if (d?.correct) {
        setGate(null);
        setGateWrong(false);
        showToast('통과! 이어서 볼게요 🐾');
        // 서버가 verify 시점에 다음 체크포인트를 재예약했다 — 즉시 하트비트로 정본 동기화 후 재생.
        // 재생 재개는 조건부: 동기화 하트비트가 409/403(오버레이)이나 새 checkpoint_due(게이트
        // 재개방)를 돌려줬다면 그 pause를 되돌리면 안 된다(skeptic 1-a — 오버레이 뒤 재생 구멍).
        void (async () => {
          await sendBeat();
          if (!gateRef.current && !overlayRef.current) {
            videoRef.current?.play().catch(() => {});
          }
        })();
      } else {
        // 오답 — 되감기 여부는 '서버 정본'으로 판정한다. 서버는 연속 오답이 상한에 닿는
        // 순간 watched_max를 cp 아래로 되감아 새 문항 발급을 409로 막는다. 로컬 오답
        // 카운터로 판정하면 새로고침·재진입 시 카운터만 0으로 리셋돼(서버 checkpoint_fails는
        // 유지) 서버만 되감은 순간을 놓치고, 재도전 위젯이 409 무한 반복에 갇힌다
        // (게이트가 열린 동안 하트비트 중단 + 닫기 버튼 없음 = 새로고침 전까지 교착 —
        // skeptic CONFIRMED). 카운터는 lecture 정본이 없는 구버전 위젯 폴백에만 쓴다.
        setGateWrong(true);
        wrongCountRef.current += 1;
        const cp = gateRef.current?.cp ?? 0;
        const rewound =
          lec && typeof lec.watched_max_sec === 'number'
            ? lec.watched_max_sec < cp // 서버가 되감았다 — cp 아래로 내려간 정본이 증거
            : wrongCountRef.current >= MAX_CHECKPOINT_FAILS; // 폴백(구버전 위젯 캐시)
        if (rewound) {
          wrongCountRef.current = 0;
          // 되감긴 위치는 서버 정본 우선 — 로컬 계산(cp-REWIND_SEC)은 폴백에서만 쓴다
          const back =
            lec && typeof lec.watched_max_sec === 'number'
              ? lec.watched_max_sec
              : Math.max(0, cp - REWIND_SEC);
          watchedMaxRef.current = back; // 앞으로-seek 가드가 안 튕기게 로컬 정본 동기화
          setWatchedMax(back);
          setGate(null);
          setGateWrong(false);
          const v = videoRef.current;
          if (v) {
            v.currentTime = back;
            if (!overlayRef.current) v.play().catch(() => {});
          }
          showToast('이 부분을 다시 보고 올게요 🔁');
        } else {
          window.setTimeout(() => {
            setGateWrong(false);
            setGateKey((k) => k + 1);
          }, 1400);
        }
      }
    };
    host.addEventListener('catchap:answer', onAnswer);
    return () => host.removeEventListener('catchap:answer', onAnswer);
  }, [gate, sendBeat, showToast]);

  /* ---- 이어보기(takeover) ---- */
  const [takingOver, setTakingOver] = useState(false);
  const doTakeover = async () => {
    if (takingOver) return;
    setTakingOver(true);
    try {
      const s = await lectureApi.takeover(lectureId);
      pendingSeekRef.current = Math.min(s.watched_max_sec, Math.max(0, s.duration_sec - 1));
      applySession(s);
      setOverlay(null);
      setHbWarn(false);
    } catch (e) {
      showToast(errorDetail(e, '이어보기에 실패했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setTakingOver(false);
    }
  };

  /* ---- 비디오 이벤트 ---- */
  const onLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    if (pendingSeekRef.current != null) {
      v.currentTime = pendingSeekRef.current;
      pendingSeekRef.current = null;
    }
  };
  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setCurTime(v.currentTime);
    // 체크포인트 도달 즉시(다음 정기 비트를 기다리지 않고) 서버에 확인 — 게이트가 늦지 않게
    const cp = nextCpRef.current;
    if (
      cp != null &&
      v.currentTime >= cp &&
      !gateRef.current &&
      !overlayRef.current &&
      !v.paused &&
      Date.now() - lastBeatAtRef.current > 1500
    ) {
      void sendBeat();
    }
  };
  const onSeeking = () => {
    const v = videoRef.current;
    if (!v) return;
    if (reviewModeRef.current) return; // 다시보기(시청 완료) — 하단 진행바로 자유 이동 허용
    // 안 본 구간 건너뛰기 차단 — 본 데(watched_max)까지만. 서버도 클램프하지만 UX로 먼저 막는다.
    if (v.currentTime > watchedMaxRef.current + SEEK_TOLERANCE_SEC) {
      v.currentTime = watchedMaxRef.current;
      showToast('아직 보지 않은 부분이에요! 본 데까지만 이동할 수 있어요');
    }
  };
  const onRateChange = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.playbackRate > MAX_RATE) {
      v.playbackRate = MAX_RATE;
      setSpeed(MAX_RATE);
      showToast('배속은 최대 2배까지만 지원해요');
    } else {
      setSpeed(v.playbackRate);
    }
  };
  const onEnded = () => {
    setPlaying(false);
    setIdle(false); // 종료 시 컨트롤 복원('pause' 이벤트가 항상 오진 않음)
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    void sendBeat(); // 마지막 위치 확정
  };
  const onVideoError = () => {
    // 세션 교체(403)·네트워크로 스트림이 끊긴 경우 — 실패를 숨기지 않고 안내
    if (!streamSrc) return;
    videoRef.current?.pause();
    setOverlay({ kind: 'videoError' });
  };

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v || overlay || gate) return;
    if (v.paused) v.play().catch(() => setOverlay({ kind: 'videoError' }));
    else v.pause();
  }, [overlay, gate]);

  /** 마우스 활동 시 컨트롤을 보이고, 재생 중이면 2.6초 뒤 다시 숨긴다.
   *  만료 시점에 실제 재생 중인지(video.paused)로 판단해 일시정지·게이트 중엔 계속 보이게 한다. */
  const bumpActivity = () => {
    setIdle(false);
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setIdle(true);
    }, 2600);
  };

  // 영상 영역 탭/클릭. 데스크톱(마우스)은 기존대로 클릭=재생/정지.
  // 터치 기기는 표준 모바일 영상 UX — 화면을 탭하면 컨트롤(재생바+가운데 재생버튼)을
  // 보였다/숨겼다 토글한다. 재생/정지는 가운데 재생버튼으로 한다.
  const onVideoTap = () => {
    if (overlay || gate) return;
    if (!isTouch) {
      togglePlay();
      return;
    }
    if (idle) {
      bumpActivity(); // 숨김 → 보이게 (+ 재생 중이면 잠시 뒤 자동 숨김)
    } else {
      setIdle(true); // 보임 → 숨기기
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    }
  };
  // 언마운트 시 유휴 타이머 정리
  useEffect(
    () => () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    },
    [],
  );

  const setRate = (r: number) => {
    const v = videoRef.current;
    setSpeedOpen(false);
    if (!v) return;
    v.playbackRate = Math.min(r, MAX_RATE);
  };

  const onVolume = (val: number) => {
    const v = videoRef.current;
    setVolume(val);
    setMuted(val === 0);
    if (v) {
      v.volume = val;
      v.muted = val === 0;
    }
  };
  const toggleMute = () => {
    const v = videoRef.current;
    const next = !muted;
    setMuted(next);
    if (v) v.muted = next;
  };

  // 화면 방향 잠금/해제 — 모바일 가로 전체화면용. 표준 미지원(iOS 등)에선 조용히 무시한다.
  const lockOrientation = (dir: 'landscape' | null) => {
    const orientation = window.screen?.orientation as
      | (ScreenOrientation & { lock?: (o: string) => Promise<void> })
      | undefined;
    try {
      if (dir) void orientation?.lock?.(dir).catch(() => {});
      else orientation?.unlock?.();
    } catch {
      /* 미지원 — 전체화면은 되고 방향만 안 바뀐다 */
    }
  };
  const toggleFullscreen = () => {
    const el = shellRef.current;
    const v = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    // iOS CSS 전체화면 종료 — 이 방식엔 fullscreenchange 이벤트가 없어 여기서 직접 처리.
    if (el?.classList.contains('lp-shell--iosfs')) {
      el.classList.remove('lp-shell--iosfs', 'lp-shell--rotated');
      document.body.style.overflow = '';
      setRotated(false);
      setIsFull(false);
      return;
    }
    if (document.fullscreenElement) {
      lockOrientation(null);
      setRotated(false);
      document.exitFullscreen().catch(() => {});
      return;
    }
    // iOS(iPhone/iPad)는 표준 전체화면이 기기 회전을 안 따라가고 방향 잠금(orientation.lock)도
    // 막혀 있다. 그래서 CSS로 화면을 꽉 채운다. 기본은 '자연 방향'(세로면 세로)이라 회전잠금을 켠
    // 사람은 세로 그대로 보고, 가로로 보고 싶으면 회전 버튼(toggleRotate)을 눌러 90도 돌린다.
    const isIOS =
      /iP(hone|od|ad)/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIOS && el) {
      el.classList.add('lp-shell--iosfs');
      document.body.style.overflow = 'hidden';
      setRotated(false);
      setIsFull(true);
      return;
    }
    if (el?.requestFullscreen) {
      // 표준(데스크톱·안드로이드 크롬): 전체화면만. 방향은 회전 버튼으로 제어(자동 가로 강제 안 함).
      el.requestFullscreen()
        .then(() => setRotated(false))
        .catch(() => showToast('전체화면을 사용할 수 없어요'));
    } else if (v?.webkitEnterFullscreen) {
      v.webkitEnterFullscreen();
    } else {
      showToast('전체화면을 사용할 수 없어요');
    }
  };

  // 회전 버튼 — 전체화면 안에서 가로↔세로 토글. iOS CSS 전체화면은 셸을 90도 돌리고,
  // 표준 전체화면(안드로이드 등)은 화면 방향 잠금을 건다. 다시 누르면 세로로 복귀.
  const toggleRotate = () => {
    const el = shellRef.current;
    if (!el) return;
    const next = !rotated;
    setRotated(next);
    if (el.classList.contains('lp-shell--iosfs')) {
      el.classList.toggle('lp-shell--rotated', next);
    } else {
      lockOrientation(next ? 'landscape' : null);
    }
  };
  useEffect(() => {
    const onFs = () => {
      const full = !!document.fullscreenElement;
      setIsFull(full);
      if (!full) {
        lockOrientation(null); // 종료 시 가로 잠금 해제 → 원래 세로로 복귀
        setRotated(false);
      }
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      document.body.style.overflow = ''; // 언마운트 시 iOS 가짜 전체화면 스크롤 잠금 해제
    };
  }, []);

  // 스페이스바로 재생/정지(표준 영상 플레이어). 입력창(메모·후기)에 포커스가 있으면 무시하고,
  // 그 외엔 기본 스크롤을 막고 재생을 토글한다. 컨트롤 버튼에 포커스가 있어도 space는 재생 토글로
  // 통일(preventDefault가 버튼 기본 활성화를 막는다 — YouTube 등과 동일).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (phase !== 'ready' || gateRef.current || overlayRef.current) return;
      e.preventDefault();
      togglePlay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, togglePlay]);

  // 다시보기 모드 동기화 — 서버 정본이 'done'이면(이미 완주·검증됨) 확인 문제·탐색 제한을 풀고,
  // 강의당 1회만 안내한다. 안 본 강의는 done=false라 시청검증이 그대로 유지된다.
  useEffect(() => {
    const done = meta?.progress?.status === 'done';
    reviewModeRef.current = done;
    if (done && reviewHintedForRef.current !== lectureId) {
      reviewHintedForRef.current = lectureId;
      showToast('시청을 완료한 강의예요 — 확인 문제 없이 원하는 부분을 다시 볼 수 있어요');
    }
  }, [meta, lectureId, showToast]);

  const onScrub = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = val; // onSeeking 가드가 안 본 구간을 되돌린다
  };

  /* ---- 자료 다운로드 (JWT 필요 — blob으로 받아 저장) ---- */
  const [downloading, setDownloading] = useState<string | null>(null);
  const downloadMaterial = async (matId: string, title: string, ext: string | null) => {
    if (downloading) return;
    setDownloading(matId);
    try {
      const res = await lectureApi.downloadMaterial(lectureId, matId);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}${ext ?? ''}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      showToast(errorDetail(e, '자료를 내려받지 못했어요.'));
    } finally {
      setDownloading(null);
    }
  };

  /* ---- 강의 노트 (localStorage, 강의별) ---- */
  const notesKey = lectureId ? `catchap:notes:${lectureId}` : '';
  useEffect(() => {
    if (!lectureId) return;
    try {
      const raw = localStorage.getItem(`catchap:notes:${lectureId}`);
      const parsed = raw ? JSON.parse(raw) : [];
      setNotes(Array.isArray(parsed) ? parsed : []);
    } catch {
      setNotes([]);
    }
    setNoteText('');
  }, [lectureId]);

  const persistNotes = (next: { id: string; t: number; text: string }[]) => {
    setNotes(next);
    try {
      if (notesKey) localStorage.setItem(notesKey, JSON.stringify(next));
    } catch {
      /* 저장 실패(용량 등) — 화면 상태는 유지, 조용히 무시 */
    }
  };
  const addNote = () => {
    const text = noteText.trim();
    if (!text) return;
    const t = Math.floor(videoRef.current?.currentTime ?? curTime);
    const id = (crypto?.randomUUID?.() ?? `${t}-${text.length}-${notes.length}`);
    persistNotes([...notes, { id, t, text }].sort((a, b) => a.t - b.t));
    setNoteText('');
  };
  const deleteNote = (id: string) => persistNotes(notes.filter((n) => n.id !== id));
  // 메모 지점으로 이동 — 본 데(watched_max)까지만(안 본 구간 건너뛰기 가드와 일관)
  const seekToNote = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.min(t, watchedMaxRef.current);
    showToast('메모 지점으로 이동했어요 🐾');
  };

  /* ---- 수강 후기 ---- */
  const loadReviews = useCallback(async () => {
    if (!lectureId) return;
    setReviewsLoading(true);
    try {
      const d = await lectureApi.reviews(lectureId);
      setReviews(d);
      setMyRating(d.mine?.rating ?? 0);
      setMyReviewText(d.mine?.text ?? '');
    } catch {
      setReviews(null);
    } finally {
      setReviewsLoading(false);
    }
  }, [lectureId]);
  // 후기 탭을 열면(또는 강의 바뀐 채 후기 탭이면) 목록을 불러온다
  useEffect(() => {
    if (tab === 'reviews') void loadReviews();
  }, [tab, loadReviews]);

  const submitReview = async () => {
    if (!myRating || submittingReview) return;
    setSubmittingReview(true);
    try {
      await lectureApi.upsertReview(lectureId, { rating: myRating, text: myReviewText.trim() });
      showToast('후기를 남겼어요 🐾');
      await loadReviews();
    } catch (e) {
      showToast(errorDetail(e, '후기를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setSubmittingReview(false);
    }
  };
  const deleteMyReview = async () => {
    try {
      await lectureApi.deleteReview(lectureId);
      setMyRating(0);
      setMyReviewText('');
      await loadReviews();
      showToast('후기를 삭제했어요');
    } catch (e) {
      showToast(errorDetail(e, '후기를 삭제하지 못했어요.'));
    }
  };

  /* ================= 렌더 ================= */
  const subject = meta?.subject ?? '국어';
  // 리뉴얼(2026-07-27): 강의실 accent를 앱 전체 모노크롬 톤과 통일 — 과목 아이콘만 유지하고
  // 색(color/soft/grad/band)은 전역 잉크 토큰으로 치환한다(과목별 코랄·블루 accent 제거).
  const subjectMeta = LECTURE_SUBJECTS[subject] ?? LECTURE_SUBJECTS['국어'];
  const theme = {
    ...subjectMeta,
    color: 'var(--brand)',
    soft: 'var(--brand-soft)',
    grad: 'var(--brand)',
    band: 'var(--brand-soft)',
  };
  const durationSec = meta?.duration_sec ?? 0;
  const orderNo = meta && meta.order_no > 0 ? meta.order_no : null;
  // 완강(시청 완료) 여부 — 서버 정본(status==='done') 또는 이번 세션에서 방금 완주했을 때.
  // 완강한 강의만 배속 조절을 허용한다(첫 시청은 1배속 고정 — 시청검증 취지와 일관).
  const isDone = meta?.progress?.status === 'done' || doneCelebrated;

  // ── 완주 → 수료 시험 안내 ──────────────────────────────────────────────────
  // 왜: 영상을 끝까지 봐도 다음에 뭘 해야 하는지 화면이 말해 주지 않았다. 사용자는
  // '수료' 메뉴를 스스로 찾아 들어가야 했고, 거기서도 시험 문항이 없는 코스는 목록에
  // 아예 안 떠서 "다 봤는데 왜 없지?"가 됐다(2026-08-16 신고).
  // 완주한 그 자리에서 다음 걸음을 보여 준다.
  const courseId = meta?.course_id ?? null;
  const [exam, setExam] = useState<ExamState | null>(null);
  useEffect(() => {
    // 이 강의를 완주했을 때만 물어본다 — 보는 중에는 필요 없는 호출이다.
    if (!courseId || !isDone) return;
    let alive = true;
    lectureApi
      .examState(courseId)
      .then((d) => alive && setExam(d))
      .catch(() => alive && setExam(null)); // 실패하면 카드를 감춘다(틀린 안내보다 무소식이 낫다)
    return () => {
      alive = false;
    };
  }, [courseId, isDone]);

  const numToc = (r: LectureItem, i: number) => (r.order_no > 0 ? r.order_no : i + 1);

  // 수강신청 게이트 — 미신청 상태로 코스 강의를 열면 여기로. 신청하면 바로 이 강의로 들어간다.
  if (notEnrolled) {
    return (
      <div className="lp-root">
        <TopBar subject={subject} title="강의실" />
        <div className="lp-enrollwrap">
          <div className="lp-enrollcard">
            <span className="lp-enrollicon"><i className="ph-fill ph-lock-key" /></span>
            <h1 className="lp-enrolltitle">이 강의는 수강신청을 해야 볼 수 있어요</h1>
            <p className="lp-enrolldesc">
              수강신청(결제)하면 이 코스의 모든 강의를 바로 볼 수 있어요.
            </p>
            <ul className="lp-enrollbenefits">
              <li>
                <span className="lp-enrollbi"><i className="ph-fill ph-monitor-play" /></span>
                <div>
                  <b>모든 강의 무제한 시청</b>
                  <span>코스에 포함된 전체 강의를 순서대로 학습해요.</span>
                </div>
              </li>
              <li>
                <span className="lp-enrollbi"><i className="ph-fill ph-squares-four" /></span>
                <div>
                  <b>확인문항으로 복습</b>
                  <span>강의를 완주하면 문제은행 연습이 열려요.</span>
                </div>
              </li>
              <li>
                <span className="lp-enrollbi"><i className="ph-fill ph-seal-check" /></span>
                <div>
                  <b>수료증 발급</b>
                  <span>전 강의 완주 후 수료 시험을 통과하면 수료돼요.</span>
                </div>
              </li>
            </ul>
            <div className="lp-enroll-actions">
              <button className="lp-enroll-btn" onClick={enrollAndEnter}>
                <i className="ph-bold ph-plus-circle" />
                수강신청하러 가기
              </button>
              <Link to={PATHS.STUDENT_LECTURES} className="lp-enroll-ghost">
                강의 목록으로
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="lp-root">
        <TopBar subject={subject} title="강의실" />
        <div className="lp-errwrap">
          <i className="ph-fill ph-warning-circle" />
          <p>{errMsg}</p>
          <Link to={PATHS.STUDENT_LECTURES} className="lp-errback">
            강의 목록으로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="lp-root">
      <TopBar subject={subject} title={meta?.title ?? ''} />

      <div className="lp-main">
        <div className="lp-left">
          {/* ===== 플레이어 ===== */}
          <div
            className={`lp-shell${idle ? ' lp-shell--idle' : ''}`}
            ref={shellRef}
            style={{ '--lp-c': 'var(--brand)' } as CSSProperties}
            onMouseMove={bumpActivity}
            onMouseLeave={() => {
              // 재생 중 커서가 플레이어를 벗어나면 즉시 숨긴다
              if (videoRef.current && !videoRef.current.paused) setIdle(true);
            }}
          >
            <span className="lp-shell-tag">
              <i className="ph-fill ph-video-camera" />
              {subject} 강의
            </span>

            {streamSrc ? (
              <video
                key={streamSrc}
                ref={videoRef}
                className="lp-video"
                src={streamSrc}
                preload="auto"
                playsInline
                onLoadedMetadata={onLoadedMetadata}
                onTimeUpdate={onTimeUpdate}
                onSeeking={onSeeking}
                onRateChange={onRateChange}
                onPlay={() => {
                  // 게이트/오버레이 중 재생 재개 차단 — togglePlay 밖의 재생 경로(미디어 키,
                  // PiP, 콘솔 play())도 여기서 즉시 되돌린다(skeptic 1-b).
                  if (gateRef.current || overlayRef.current) {
                    videoRef.current?.pause();
                    return;
                  }
                  setPlaying(true);
                  bumpActivity(); // 재생 시작 시 유휴 숨김 타이머 가동
                }}
                onPause={() => {
                  // 일시정지·정지면 컨트롤을 항상 보이게(유휴 해제 + 타이머 취소)
                  setPlaying(false);
                  setIdle(false);
                  if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
                }}
                disablePictureInPicture
                onEnded={onEnded}
                onError={onVideoError}
                onClick={onVideoTap}
              />
            ) : (
              <div className="lp-video lp-video-empty" />
            )}

            {/* 가운데 재생/일시정지 — 컨트롤이 보이는 동안에만 뜬다(모바일은 탭, 데스크톱은 마우스를
                올리면 컨트롤이 나타나며 같이 보인다). 재생/정지는 이 버튼으로. */}
            {phase === 'ready' && !idle && !gate && !overlay && (playing || curTime > 0) && (
              <button
                className="lp-centerplay"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                aria-label={playing ? '일시정지' : '재생'}
              >
                <i className={playing ? 'ph-fill ph-pause' : 'ph-fill ph-play'} />
              </button>
            )}

            {/* 재생 전 타이틀 오버레이 (목업: 아이콘 + n강 + 제목) */}
            {phase === 'ready' && !playing && curTime === 0 && !gate && !overlay && (
              <button className="lp-idle" onClick={togglePlay} aria-label="재생">
                <span className="lp-idle-icon">
                  <i className={theme.icon} />
                </span>
                {orderNo && <span className="lp-idle-num">{orderNo}강</span>}
                <span className="lp-idle-title">{meta?.title}</span>
              </button>
            )}
            {phase === 'loading' && (
              <div className="lp-idle">
                <span className="lp-idle-icon">
                  <i className="ph-fill ph-hourglass-medium" />
                </span>
                <span className="lp-idle-title">강의를 불러오는 중…</span>
              </div>
            )}

            {/* 컨트롤 바 */}
            {phase === 'ready' && (
              <div className="lp-controls">
                <input
                  className="lp-scrub"
                  type="range"
                  min={0}
                  max={Math.max(1, durationSec)}
                  step={1}
                  value={Math.min(curTime, durationSec)}
                  onChange={(e) => onScrub(Number(e.target.value))}
                  style={
                    {
                      '--lp-played': `${durationSec ? Math.min(100, (curTime / durationSec) * 100) : 0}%`,
                      '--lp-watched': `${durationSec ? Math.min(100, (watchedMax / durationSec) * 100) : 0}%`,
                    } as CSSProperties
                  }
                  aria-label="재생 위치"
                />
                <div className="lp-ctrlrow">
                  <button className="lp-playbtn" onClick={togglePlay} aria-label={playing ? '일시정지' : '재생'}>
                    <i className={playing ? 'ph-fill ph-pause' : 'ph-fill ph-play'} />
                  </button>
                  <span className="lp-time">
                    {formatClock(curTime)} / {formatDurationLabel(durationSec)}
                  </span>
                  <div className="lp-ctrlspace" />
                  <div className="lp-speedwrap">
                    <button
                      className={`lp-chipbtn${isDone ? '' : ' lp-chipbtn--locked'}`}
                      onClick={() => {
                        if (!isDone) {
                          showToast('완강하면 배속을 조절할 수 있어요');
                          return;
                        }
                        setSpeedOpen((o) => !o);
                      }}
                      aria-label="재생 속도"
                      title={isDone ? '재생 속도' : '완강 후 배속 조절 가능'}
                    >
                      {!isDone && <i className="ph-fill ph-lock-simple" />}
                      {formatRate(speed)}배속
                    </button>
                    {speedOpen && isDone && (
                      <div className="lp-speedmenu">
                        {SPEEDS.map((r) => (
                          <button
                            key={r}
                            className={`lp-speeditem${speed === r ? ' lp-on' : ''}`}
                            onClick={() => setRate(r)}
                          >
                            {formatRate(r)}배속
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div
                    className="lp-volwrap"
                    onMouseEnter={() => setVolOpen(true)}
                    onMouseLeave={() => setVolOpen(false)}
                  >
                    {volOpen && (
                      <input
                        className="lp-vol"
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={muted ? 0 : volume}
                        onChange={(e) => onVolume(Number(e.target.value))}
                        aria-label="음량"
                      />
                    )}
                    <button className="lp-iconbtn" onClick={toggleMute} aria-label="음소거">
                      <i
                        className={
                          muted || volume === 0
                            ? 'ph-fill ph-speaker-slash'
                            : 'ph-fill ph-speaker-high'
                        }
                      />
                    </button>
                  </div>
                  {isFull && isTouch && (
                    <button
                      className="lp-iconbtn"
                      onClick={toggleRotate}
                      aria-label={rotated ? '세로로 보기' : '가로로 보기'}
                      title={rotated ? '세로로 보기' : '가로로 보기'}
                    >
                      <i
                        className={rotated ? 'ph-fill ph-device-mobile' : 'ph-fill ph-arrows-clockwise'}
                      />
                    </button>
                  )}
                  <button className="lp-iconbtn" onClick={toggleFullscreen} aria-label="전체화면">
                    <i className={isFull ? 'ph-fill ph-corners-in' : 'ph-fill ph-corners-out'} />
                  </button>
                </div>
              </div>
            )}

            {/* ===== 캡차 게이트 오버레이 ===== */}
            {gate && (
              <div className="lp-gate">
                <div className="lp-gatecard">
                  <div className="lp-gatehead">
                    <span className="lp-gatechip">
                      <i className="ph-fill ph-seal-question" />
                      확인 문제
                    </span>
                    <h3 className="lp-gatetitle">잠깐! 지금까지 잘 보고 있었나요?</h3>
                    <p className="lp-gatedesc">문제를 맞히면 이어서 볼 수 있어요.</p>
                  </div>
                  {gateWrong && (
                    <div className="lp-gatewrong">
                      <i className="ph-fill ph-arrow-counter-clockwise" />
                      아쉬워요! 새 문제로 다시 도전해요
                    </div>
                  )}
                  <div ref={gateHostRef} className="lp-gatewidget">
                    {EDU_SITE_KEY ? (
                      <CatchapWidget
                        key={gateKey}
                        siteKey={EDU_SITE_KEY}
                        api={WIDGET_API}
                        subject={subject}
                        lecture={lectureId}
                        total={1}
                        auth={getFreshAccessToken}
                        size="full"
                      />
                    ) : (
                      <div className="lp-gatemiss">
                        위젯 설정(VITE_CATCHAP_EDU_SITE_KEY)이 없어 확인 문제를 불러올 수 없어요.
                        <br />
                        관리자에게 문의해 주세요. (임의 통과는 지원하지 않아요)
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ===== 동시 시청/세션 오버레이 ===== */}
            {overlay?.kind === 'conflict' && (
              <div className="lp-gate">
                <div className="lp-gatecard lp-conflictcard">
                  <span className="lp-conflict-ic">
                    <i className="ph-fill ph-devices" />
                  </span>
                  <h3 className="lp-gatetitle">다른 곳에서 시청 중이에요</h3>
                  <p className="lp-gatedesc">
                    이 계정으로 다른 기기(또는 탭)에서 강의를 보고 있어요.
                    <br />
                    여기서 계속하면 다른 쪽 재생은 멈춰요.
                  </p>
                  <div className="lp-gateactions">
                    <Link to={PATHS.STUDENT_LECTURES} className="lp-btn-ghost">
                      목록으로
                    </Link>
                    <button className="lp-btn-main" onClick={doTakeover} disabled={takingOver}>
                      <i className="ph-fill ph-play-circle" />
                      {takingOver ? '이어받는 중…' : '여기서 계속하기'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {overlay?.kind === 'dead' && (
              <div className="lp-gate">
                <div className="lp-gatecard lp-conflictcard">
                  <span className="lp-conflict-ic">
                    <i className="ph-fill ph-clock-countdown" />
                  </span>
                  <h3 className="lp-gatetitle">시청 세션이 끝났어요</h3>
                  <p className="lp-gatedesc">{overlay.message}</p>
                  <div className="lp-gateactions">
                    <button className="lp-btn-main" onClick={doTakeover} disabled={takingOver}>
                      <i className="ph-fill ph-arrow-clockwise" />
                      {takingOver ? '다시 시작 중…' : '다시 시작하기'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {overlay?.kind === 'videoError' && (
              <div className="lp-gate">
                <div className="lp-gatecard lp-conflictcard">
                  <span className="lp-conflict-ic">
                    <i className="ph-fill ph-plugs" />
                  </span>
                  <h3 className="lp-gatetitle">영상 재생이 끊겼어요</h3>
                  <p className="lp-gatedesc">
                    다른 곳에서 재생을 시작했거나 연결이 불안정해요.
                    <br />
                    여기서 이어보려면 아래 버튼을 눌러 주세요.
                  </p>
                  <div className="lp-gateactions">
                    <button className="lp-btn-main" onClick={doTakeover} disabled={takingOver}>
                      <i className="ph-fill ph-play-circle" />
                      {takingOver ? '이어받는 중…' : '여기서 이어보기'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {toast && <div className="lp-toast">{toast}</div>}
            {hbWarn && !overlay && (
              <div className="lp-hbwarn">
                <i className="ph-fill ph-wifi-slash" />
                시청 기록 저장이 불안정해요 — 네트워크를 확인해 주세요
              </div>
            )}
          </div>

          {/* ===== 행동데이터 수집(외부 CatChap Guard) =====
              `?collect=` 를 단 참여자에게만 붙는다. 위 캡차 게이트(확인 문제)는 우리 학습
              위젯이고 이건 별개 서비스의 수집 전용 위젯이다 — 게이트 안에 넣지 않는 이유는
              (1) 판정/수집을 섞지 않기 위해서, (2) 게이트는 체크포인트에서만 잠깐 뜨는데
              수집은 시청 내내 이어져야 데이터가 쌓이기 때문이다. */}
          <CollectCaptcha
            participant={collectParticipant}
            lectureId={lectureId}
            note="이 캡차는 영상 재생을 막지 않습니다. 위의 '확인 문제'와는 별개이고, 푸는 동안의 조작 데이터만 수집합니다."
          />

          {/* ===== 탭 ===== */}
          <div className="lp-tabs">
            {(
              [
                ['list', 'ph-fill ph-list-bullets', '강의 목록'],
                ['materials', 'ph-fill ph-folder-open', '자료실'],
                ['notes', 'ph-fill ph-pencil-line', '강의 노트'],
                ['reviews', 'ph-fill ph-chat-circle-dots', '수강 후기'],
              ] as const
            ).map(([key, icon, label]) => (
              <button
                key={key}
                className={`lp-tab${tab === key ? ' lp-tab-on' : ''}`}
                style={{ '--lp-c': 'var(--brand)' } as CSSProperties}
                onClick={() => setTab(key)}
              >
                <i className={icon} />
                {label}
              </button>
            ))}
          </div>

          {/* ===== 탭 내용 ===== */}
          {tab === 'list' && meta && (
            <div className="lp-info">
              <div className="lp-info-head">
                <span className="lp-info-ic" style={{ background: theme.soft, color: theme.color }}>
                  <i className={theme.icon} />
                </span>
                <div>
                  <h2 className="lp-info-title">
                    {orderNo ? `${orderNo}강 · ` : ''}
                    {meta.title}
                  </h2>
                  <span className="lp-info-time">{formatDurationLabel(durationSec)}</span>
                </div>
              </div>
              <p className="lp-info-desc">
                {meta.description ||
                  `선생님과 함께 '${meta.title}' 강의를 들어봐요. 오늘의 강의 한 편이면 충분해요!`}
              </p>
              <div className="lp-info-chips">
                <span className="lp-chip" style={{ color: theme.color, background: theme.soft }}>
                  <i className="ph-fill ph-seal-question" /> 확인 문제 {meta.question_count}개
                </span>
                <span className="lp-chip" style={{ color: theme.color, background: theme.soft }}>
                  <i className="ph-fill ph-eye" /> 시청 시간 {formatDurationLabel(watchedMax)}
                </span>
                {meta.progress?.status === 'done' && (
                  <span className="lp-chip lp-chip-done">
                    <i className="ph-fill ph-check-circle" /> 시청 완료
                  </span>
                )}
              </div>
            </div>
          )}

          {tab === 'materials' && (
            <div className="lp-info">
              {(meta?.materials ?? []).length === 0 ? (
                <div className="lp-tabempty">
                  <i className="ph-fill ph-folder-dashed" />
                  등록된 자료가 아직 없어요.
                </div>
              ) : (
                <div className="lp-mats">
                  {(meta?.materials ?? []).map((m) => (
                    <div key={m.id} className="lp-mat">
                      <span className="lp-mat-ic" style={{ background: theme.soft, color: theme.color }}>
                        <i className={m.kind === 'link' ? 'ph-fill ph-link' : 'ph-fill ph-file-arrow-down'} />
                      </span>
                      <div className="lp-mat-body">
                        <div className="lp-mat-title">{m.title}</div>
                        <div className="lp-mat-sub">
                          {m.kind === 'link'
                            ? '외부 링크'
                            : `파일${m.file_ext ? ` · ${m.file_ext.replace('.', '').toUpperCase()}` : ''}${
                                m.file_bytes ? ` · ${(m.file_bytes / 1024 / 1024).toFixed(1)}MB` : ''
                              }`}
                        </div>
                      </div>
                      {m.kind === 'link' ? (
                        <a
                          className="lp-mat-btn"
                          style={{ background: theme.color }}
                          href={m.url}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          열기 <i className="ph-bold ph-arrow-square-out" />
                        </a>
                      ) : (
                        <button
                          className="lp-mat-btn"
                          style={{ background: theme.color }}
                          disabled={downloading === m.id}
                          onClick={() => downloadMaterial(m.id, m.title, m.file_ext)}
                        >
                          {downloading === m.id ? '내려받는 중…' : '다운로드'}
                          <i className="ph-bold ph-download-simple" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'notes' && (
            <div className="lp-info">
              {/* 현재 재생 지점에 메모를 남긴다 — 클릭하면 그 지점으로 돌아가 복습 */}
              <div className="lp-noteadd">
                <span className="lp-notenow" style={{ color: theme.color, background: theme.soft }}>
                  <i className="ph-fill ph-clock" /> {formatClock(curTime)}
                </span>
                <input
                  className="lp-noteinput"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addNote();
                  }}
                  placeholder="이 지점에 남길 메모를 적어요"
                  maxLength={200}
                />
                <button
                  className="lp-notebtn"
                  style={{ background: theme.color }}
                  onClick={addNote}
                  disabled={!noteText.trim()}
                >
                  <i className="ph-bold ph-plus" /> 기록
                </button>
              </div>
              {notes.length === 0 ? (
                <div className="lp-tabempty">
                  <i className="ph-fill ph-pencil-line" />
                  아직 메모가 없어요. 영상을 보다가 기억할 지점을 기록해 두면, 눌러서 그 지점으로 바로
                  돌아올 수 있어요.
                </div>
              ) : (
                <ul className="lp-notelist">
                  {notes.map((n) => (
                    <li key={n.id} className="lp-note">
                      <button
                        className="lp-note-t"
                        style={{ color: theme.color, background: theme.soft }}
                        onClick={() => seekToNote(n.t)}
                        title="이 지점으로 이동"
                      >
                        <i className="ph-fill ph-play-circle" /> {formatClock(n.t)}
                      </button>
                      <span className="lp-note-text">{n.text}</span>
                      <button
                        className="lp-note-del"
                        onClick={() => deleteNote(n.id)}
                        aria-label="메모 삭제"
                      >
                        <i className="ph-bold ph-trash" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="lp-note-hint">
                <i className="ph-fill ph-info" /> 메모는 이 기기(브라우저)에만 저장돼요.
              </p>
            </div>
          )}

          {tab === 'reviews' && (
            <div className="lp-info">
              {reviewsLoading && !reviews ? (
                <div className="lp-tabempty">
                  <i className="ph-fill ph-hourglass-medium" /> 후기를 불러오는 중…
                </div>
              ) : (
                <>
                  {/* 요약 — 평균 별점 + 개수 + 분포 */}
                  <div className="lp-revsummary">
                    <div className="lp-revavg">
                      <span className="lp-revavg-num" style={{ color: theme.color }}>
                        {reviews && reviews.summary.count > 0 ? reviews.summary.avg.toFixed(1) : '—'}
                      </span>
                      <Stars value={Math.round(reviews?.summary.avg ?? 0)} color={theme.color} />
                      <span className="lp-revcount">후기 {reviews?.summary.count ?? 0}개</span>
                    </div>
                    {reviews && reviews.summary.count > 0 && (
                      <div className="lp-revdist">
                        {[5, 4, 3, 2, 1].map((s) => {
                          const c = reviews.summary.dist[String(s)] ?? 0;
                          const pct = reviews.summary.count ? (c / reviews.summary.count) * 100 : 0;
                          return (
                            <div key={s} className="lp-revdistrow">
                              <span className="lp-revdistlabel">{s}점</span>
                              <span className="lp-revdistbar">
                                <span
                                  className="lp-revdistfill"
                                  style={{ width: `${pct}%`, background: theme.color }}
                                />
                              </span>
                              <span className="lp-revdistn">{c}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 내 후기 작성/수정 */}
                  <div className="lp-revform">
                    <div className="lp-revform-head">
                      <span className="lp-revform-title">
                        {reviews?.mine ? '내 후기 수정' : '이 강의 후기 남기기'}
                      </span>
                      <Stars value={myRating} onChange={setMyRating} color={theme.color} interactive />
                    </div>
                    <textarea
                      className="lp-revtext"
                      value={myReviewText}
                      onChange={(e) => setMyReviewText(e.target.value)}
                      placeholder="이 강의는 어땠나요? 다른 학습자에게 도움이 될 후기를 남겨요. (선택)"
                      maxLength={1000}
                      rows={3}
                    />
                    <div className="lp-revform-actions">
                      {reviews?.mine && (
                        <button className="lp-revdel" onClick={deleteMyReview}>
                          <i className="ph-bold ph-trash" /> 삭제
                        </button>
                      )}
                      <button
                        className="lp-revsubmit"
                        style={{ background: theme.color }}
                        onClick={submitReview}
                        disabled={!myRating || submittingReview}
                      >
                        {submittingReview ? '저장 중…' : reviews?.mine ? '후기 수정' : '후기 등록'}
                      </button>
                    </div>
                    {!myRating && <p className="lp-revhint">별점을 선택하면 후기를 남길 수 있어요.</p>}
                  </div>

                  {/* 후기 목록 */}
                  {reviews && reviews.reviews.length > 0 ? (
                    <ul className="lp-revlist">
                      {reviews.reviews.map((r) => (
                        <li key={r.id} className={`lp-rev${r.mine ? ' lp-rev--mine' : ''}`}>
                          <div className="lp-rev-top">
                            <span className="lp-rev-author">{r.author}</span>
                            {r.mine && <span className="lp-rev-mine">내 후기</span>}
                            <Stars value={r.rating} color={theme.color} small />
                            <span className="lp-rev-date">{fmtReviewDate(r.created_at)}</span>
                          </div>
                          {r.text && <p className="lp-rev-text">{r.text}</p>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="lp-tabempty">
                      <i className="ph-fill ph-chat-circle-dots" />
                      아직 후기가 없어요. 첫 후기를 남겨보세요!
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ===== 강의 목차 사이드바 ===== */}
        <aside className="lp-side">
          {/* 수료 시험 카드 — 완주했을 때만. 세 갈래를 ★구분해서 말한다:
              ① 지금 응시 가능 ② 다른 강의가 남음 ③ 시험이 아직 준비되지 않음.
              ③을 침묵으로 두면 완주자가 원인을 모른 채 '수료' 메뉴를 헤맨다. */}
          {isDone && exam && !exam.passed && (
            <div
              className={`lp-examcta${exam.available ? ' lp-examcta--go' : ''}`}
              role={exam.available ? undefined : 'note'}
            >
              <span className="lp-examcta-ic">
                <i className={`ph-fill ${exam.available ? 'ph-seal-check' : 'ph-hourglass-medium'}`} />
              </span>
              {exam.available ? (
                <>
                  <div className="lp-examcta-body">
                    <b>수료 시험을 볼 수 있어요</b>
                    <span>
                      {exam.exam_size}문항 중 {exam.pass_need}문항 이상 맞히면 수료증이 발급돼요.
                    </span>
                  </div>
                  <button
                    type="button"
                    className="lp-examcta-btn"
                    onClick={() =>
                      navigate(`${PATHS.STUDENT_COURSE_EXAM}?course=${exam.course_id}`)
                    }
                  >
                    시험 보러가기
                  </button>
                </>
              ) : (
                <div className="lp-examcta-body">
                  <b>{exam.has_exam ? '아직 남은 강의가 있어요' : '수료 시험을 준비하고 있어요'}</b>
                  <span>
                    {exam.has_exam
                      ? `이 코스의 강의를 전부 완주하면 열려요. (${exam.lectures_done}/${exam.lectures_total} 완주)`
                      : '이 코스는 아직 시험 문항이 등록되지 않았어요. 준비되면 여기에서 바로 응시할 수 있어요.'}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="lp-side-head">
            <div className="lp-side-title">
              <i className="ph-fill ph-list-numbers" />
              강의 목차
            </div>
            <div className="lp-side-sub">
              {subject} · 전체 {meta?.toc?.length ?? 0}강 · 강의를 눌러 이동해요
            </div>
          </div>
          <div className="lp-side-list">
            {(meta?.toc ?? []).map((r, i) => {
              const isCur = r.id === lectureId;
              const isDone = r.progress?.status === 'done';
              return (
                <button
                  key={r.id}
                  className={`lp-tocitem${isCur ? ' lp-toc-cur' : ''}`}
                  style={{ '--lp-c': theme.color, '--lp-soft': theme.soft } as CSSProperties}
                  onClick={() => {
                    if (!isCur) navigate(PATHS.STUDENT_LECTURE, { state: { id: r.id } });
                  }}
                >
                  <span className={`lp-tocnum${isDone ? ' lp-tocnum-done' : ''}`}>
                    {isDone ? <i className="ph-bold ph-check" /> : numToc(r, i)}
                  </span>
                  <span className="lp-tocbody">
                    {isCur && <span className="lp-tocbadge">학습중</span>}
                    <span className="lp-toctitle">
                      {numToc(r, i)}강 {r.title}
                    </span>
                  </span>
                  <span className="lp-toctime">{formatDurationLabel(r.duration_sec)}</span>
                </button>
              );
            })}
            {meta && (meta.toc ?? []).length === 0 && (
              <div className="lp-tabempty">이 과목의 다른 강의가 아직 없어요.</div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/** 별점 표시/입력 — interactive면 클릭으로 1~5 선택, 아니면 읽기 전용(반올림 채움). */
function Stars({
  value,
  onChange,
  color,
  interactive,
  small,
}: {
  value: number;
  onChange?: (v: number) => void;
  color?: string;
  interactive?: boolean;
  small?: boolean;
}) {
  return (
    <span className={`lp-stars${small ? ' lp-stars--sm' : ''}${interactive ? ' lp-stars--btn' : ''}`}>
      {[1, 2, 3, 4, 5].map((s) => {
        const on = s <= value;
        const cls = on ? 'ph-fill ph-star' : 'ph-bold ph-star';
        if (interactive) {
          return (
            <button
              key={s}
              type="button"
              className="lp-star"
              style={on ? { color } : undefined}
              onClick={() => onChange?.(s)}
              aria-label={`${s}점`}
            >
              <i className={cls} />
            </button>
          );
        }
        return <i key={s} className={cls} style={on ? { color } : undefined} />;
      })}
    </span>
  );
}

/** 후기 날짜 — ISO → 'YYYY.MM.DD' (실패 시 빈 문자열) */
function fmtReviewDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/** 강의실 상단 바 — 강의 영상 전용 슬림 헤더. */
// 시청 몰입을 위해 사이트 공통 NAV(홈·강의·문제은행·나의 기록)를 걷어내고, 로고 왼쪽엔
// '학습 홈' 뒤로가기, 오른쪽엔 지금 보는 강의 경로(홈 > 과목 > 제목)만 남긴다(사용자 요청 2026-07-27).
function TopBar({ subject, title }: { subject: string; title: string }) {
  const { theme } = useTheme();
  return (
    <div className="lp-subbar">
      <div className="lp-subbar-inner">
        <Link to={PATHS.STUDENT_HOME} className="lp-back">
          <i className="ph-bold ph-arrow-left" />
          학습 홈
        </Link>
        <Link to={PATHS.STUDENT_HOME} className="lp-logo" aria-label="CATCHAP 홈">
          <img
            src={theme === 'dark' ? wordmarkWhite : wordmark}
            alt="CATCHAP"
            className="lp-logomark"
          />
        </Link>
        <div className="lp-crumb">
          <i className="ph-fill ph-house" />
          <i className="ph-bold ph-caret-right lp-crumb-sep" />
          <Link to={PATHS.STUDENT_LECTURES} className="lp-crumb-link">
            {subject}
          </Link>
          <i className="ph-bold ph-caret-right lp-crumb-sep" />
          <span className="lp-crumb-cur">{title}</span>
        </div>
      </div>
    </div>
  );
}
