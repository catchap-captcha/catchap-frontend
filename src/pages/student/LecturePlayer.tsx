import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import {
  API_ORIGIN,
  errorDetail,
  isActiveElsewhere,
  lectureApi,
  type HeartbeatState,
  type LectureDetail,
  type LectureItem,
  type LectureSession,
} from '../../api/lectures';
import { getFreshAccessToken } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import CatchapWidget from '../../components/captcha/CatchapWidget';
import mascot from '../../assets/characters/catchap-logo.png';
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
  const { me } = useAuth();

  /* 파라미터 관용구: navigate state 우선, 쿼리(?id=) 딥링크는 최초 1회 주소창 정리 */
  const navState = (location.state ?? null) as { id?: string } | null;
  const lectureId = navState?.id ?? searchParams.get('id') ?? '';
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
  const [enrolling, setEnrolling] = useState(false);
  const [reloadKey, setReloadKey] = useState(0); // 수강신청 후 강의 로드를 다시 트리거
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
  }, [lectureId, applySession, reloadKey]);

  // 수강신청하고 바로 이 강의로 — 신청 성공 후 로드를 다시 트리거(게이트 통과)
  const enrollAndEnter = async () => {
    if (!notEnrolled || enrolling) return;
    setEnrolling(true);
    try {
      await lectureApi.enrollCourse(notEnrolled);
      setNotEnrolled(null);
      setPhase('loading');
      setReloadKey((k) => k + 1);
    } catch (e) {
      setPhase('error');
      setErrMsg(errorDetail(e, '수강신청에 실패했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setEnrolling(false);
    }
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
      if (st.status === 'done' && !doneCelebrated) {
        setDoneCelebrated(true);
        showToast('강의를 끝까지 다 봤어요! 🎉');
      }
      if (st.checkpoint_due && !gateRef.current) {
        openGate(st.next_checkpoint_sec ?? Math.floor(videoRef.current?.currentTime ?? 0));
      }
    },
    [doneCelebrated, openGate, showToast],
  );

  const sendBeat = useCallback(async () => {
    const v = videoRef.current;
    const token = sessionTokenRef.current;
    if (!v || !token || beatingRef.current || overlayRef.current) return;
    beatingRef.current = true;
    lastBeatAtRef.current = Date.now();
    const gen = genRef.current; // 이 비트가 속한 강의 세대
    const body = { position_sec: Math.floor(v.currentTime) };
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

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v || overlay || gate) return;
    if (v.paused) v.play().catch(() => setOverlay({ kind: 'videoError' }));
    else v.pause();
  };

  /** 마우스 활동 시 컨트롤을 보이고, 재생 중이면 2.6초 뒤 다시 숨긴다.
   *  만료 시점에 실제 재생 중인지(video.paused)로 판단해 일시정지·게이트 중엔 계속 보이게 한다. */
  const bumpActivity = () => {
    setIdle(false);
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setIdle(true);
    }, 2600);
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

  const toggleFullscreen = () => {
    const el = shellRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen().catch(() => showToast('전체화면을 사용할 수 없어요'));
    }
  };
  useEffect(() => {
    const onFs = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

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

  /* ================= 렌더 ================= */
  const subject = meta?.subject ?? '국어';
  const theme = LECTURE_SUBJECTS[subject] ?? LECTURE_SUBJECTS['국어'];
  const durationSec = meta?.duration_sec ?? 0;
  const orderNo = meta && meta.order_no > 0 ? meta.order_no : null;
  const name = (me?.name ?? '학생').trim() || '학생';

  const numToc = (r: LectureItem, i: number) => (r.order_no > 0 ? r.order_no : i + 1);

  // 수강신청 게이트 — 미신청 상태로 코스 강의를 열면 여기로. 신청하면 바로 이 강의로 들어간다.
  if (notEnrolled) {
    return (
      <div className="lp-root">
        <TopBar subject={subject} title="강의실" name={name} />
        <div className="lp-errwrap">
          <i className="ph-fill ph-lock-simple" />
          <p>이 강의는 <b>수강신청</b>을 해야 볼 수 있어요.</p>
          <p className="lp-enroll-sub">수강신청하면 이 코스의 모든 강의를 바로 볼 수 있어요(무료·언제든 취소 가능).</p>
          {/* 세로 배치 — '수강신청하고 바로 보기' 아래에 '강의 목록으로' */}
          <div className="lp-enroll-actions">
            <button className="lp-enroll-btn" onClick={enrollAndEnter} disabled={enrolling}>
              <i className="ph-bold ph-plus-circle" />
              {enrolling ? '수강신청 중…' : '수강신청하고 바로 보기'}
            </button>
            <Link to={PATHS.STUDENT_LECTURES} className="lp-errback">
              강의 목록으로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="lp-root">
        <TopBar subject={subject} title="강의실" name={name} />
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
      <TopBar subject={subject} title={meta?.title ?? ''} name={name} />

      <div className="lp-main">
        <div className="lp-left">
          {/* ===== 플레이어 ===== */}
          <div
            className={`lp-shell${idle ? ' lp-shell--idle' : ''}`}
            ref={shellRef}
            style={{ '--lp-c': theme.color } as CSSProperties}
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
                preload="metadata"
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
                onClick={togglePlay}
              />
            ) : (
              <div className="lp-video lp-video-empty" />
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
                    <button className="lp-chipbtn" onClick={() => setSpeedOpen((o) => !o)}>
                      {formatRate(speed)}배속
                    </button>
                    {speedOpen && (
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
                style={{ '--lp-c': theme.color } as CSSProperties}
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
                  <i className="ph-fill ph-eye" /> 본 데까지 {formatDurationLabel(watchedMax)}
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
              <div className="lp-tabempty">
                <i className="ph-fill ph-chat-circle-dots" />
                수강 후기는 준비 중이에요. 곧 만나요 🐾
              </div>
            </div>
          )}
        </div>

        {/* ===== 강의 목차 사이드바 ===== */}
        <aside className="lp-side">
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

/** 강의실 상단 바 — 목업의 슬림 헤더(← 학습 홈 / 로고 / 경로 / 프로필) */
function TopBar({ subject, title, name }: { subject: string; title: string; name: string }) {
  return (
    <div className="lp-topbar">
      <div className="lp-topbar-inner">
        <Link to={PATHS.STUDENT_HOME} className="lp-back">
          <i className="ph-bold ph-arrow-left" />
          학습 홈
        </Link>
        <Link to={PATHS.STUDENT_HOME} className="lp-brand">
          <img src={mascot} alt="CatChap" className="lp-brand-img" />
          <span className="lp-brand-name">CatChap</span>
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
        <div className="lp-topspace" />
        <Link to={PATHS.STUDENT_MYPAGE} className="lp-profile">
          <span className="lp-profile-avatar">{name.slice(0, 1)}</span>
          <span className="lp-profile-name">{name}님</span>
        </Link>
      </div>
    </div>
  );
}
