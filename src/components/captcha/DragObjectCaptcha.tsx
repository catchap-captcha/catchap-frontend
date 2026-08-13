import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';

import { client } from '../../api/client';
import { API_ORIGIN } from '../../api/lectures';
import {
  createGuardChallenge, guardAssetSrc, type GuardVerification,
  verifyGuardChallenge, GuardBehaviorSender, GuardRetryLater,
} from '../../lib/catchapGuard';
import './DragObjectCaptcha.css';

/**
 * 메인 캡차(사람 확인) — ms '다중 객체 드래그' 위젯을 원본 구조 그대로 옮긴 것.
 *
 * 왜 이렇게(팀 학습용): 처음 이식할 때 우리가 UI를 새로 짰다가 두 가지를 잘못했다.
 *  (1) 백엔드가 내려주는 drop_zone 좌표로 **사진 위에** 점선 상자를 그렸다. 그런데 ms 원본
 *      프론트(src/main.jsx)는 그 좌표를 아예 쓰지 않는다 — 정답존은 사진 바깥의 별도 패널이다.
 *      사진 위에 그리니 객체와 겹치고("이미 정답존 안에 있는 객체"), 위치도 사진 내용과 무관해
 *      이상하게 보였다.
 *  (2) 객체 자리에 오려낸 조각(preview_url)을 덧그렸다. 원본은 그 자리에 **투명한 집기 영역**만
 *      두고, 객체는 사진에 원래 그려진 것을 그대로 보게 한다. 조각 이미지는 드래그 고스트와
 *      정답존 안 썸네일에만 쓴다. 덧그리니 사진 위에 스티커가 붙은 것처럼 보였고, 조각과 bbox의
 *      종횡비가 다른 경우(전수 측정 결과 정확히 일치하는 건 44.4%뿐)에는 찌그러져 보였다.
 *
 * 그래서 지금은 원본 구조를 따른다: 사진 위에는 투명한 히트 영역만, 정답존은 사진 옆 패널,
 * 조각은 고스트·썸네일 전용. 단 **좌표 정합만은 원본보다 낫게 유지한다** — 원본은
 * `.image-stage{aspect-ratio:16/9}` + `object-fit:contain` 조합이라 4:3 사진에서 무대와 사진
 * 박스가 어긋나 히트 영역이 실제 객체와 맞지 않는다(원본에선 히트 영역이 투명해 눈에 안 띌 뿐
 * 잘못 잡히는 건 마찬가지다). 우리는 무대를 사진에 shrink-wrap 해 그 문제를 없앤다.
 *
 * Props는 이전 iframe 래퍼와 동일하게 유지한다(onToken/onClose) — 호출부(LoginPage/OpsLogin)를
 * 건드리지 않기 위해서다.
 */
interface Props {
  /** `meta` 는 Guard 모드에서만 온다. 백엔드 토큰 검증에 session_id·purpose 가 필요하다. */
  onToken: (token: string, meta?: GuardVerification) => void;
  onClose?: () => void;
}

interface CaptchaObject {
  object_id: string;
  /** 배경 이미지 기준 히트 영역 [x, y, w, h]. 정규화(0~1) 또는 픽셀(width/height 기준) 모두 수용. */
  hit_region: [number, number, number, number];
  preview_url: string;
}

interface Challenge {
  challenge_id: string;
  type: string;
  instruction: string;
  image_url: string;
  width: number;
  height: number;
  objects: CaptchaObject[];
  expires_at: string;
}

interface VerifySuccess {
  success: true;
  captcha_token: string;
  expires_in: number;
}
interface VerifyFailure {
  success: false;
  remaining_attempts?: number;
  blocked?: boolean;
  step_up?: boolean;
}
type VerifyResult = VerifySuccess | VerifyFailure;

// cooldown — 여러 번 틀려 서버가 잠깐 기다리라고 한 상태. error 와 나누는 이유는
// 사용자가 할 일이 다르기 때문이다: error 는 다시 누르면 되고, cooldown 은 기다리면 된다.
type Phase = 'loading' | 'ready' | 'verifying' | 'success' | 'error' | 'cooldown';

/**
 * 서버 행동 분석 이벤트. 서버(drag_captcha_service.summarize)가 점수에 쓰는 type은
 * challenge_loaded · pointer_down · drag_start · pointer_move · drop · object_removed 이고,
 * x/y는 0~1 정규화 좌표여야 한다(백엔드 스키마 Field(ge=0, le=1)).
 *
 * ★반드시 보내야 하는 이유: 빈 배열로 보내면 서버가 move_count<3(+15)와 reaction=None(+12)로
 * 정답을 맞혀도 기본 27점을 매긴다. step_up 임계가 30이라 10분 내 챌린지 4회(+5) 같은 정상
 * 사용 패턴만 겹쳐도 정답이 거절됐다. 실제 궤적을 보내면 그 27점이 사라지고 봇 판별이 동작한다.
 */
interface BehaviorEvent {
  type: string;
  object_id?: string;
  x?: number;
  y?: number;
  timestamp_ms: number;
}

/** 서버 스키마 상한은 600개 — 여유를 두고 자른다(넘치면 422로 검증 자체가 실패). */
const MAX_EVENTS = 550;
/** pointer_move 표본 간격(ms). 원본(ms)도 40ms로 솎아낸다. */
const MOVE_SAMPLE_MS = 40;

/** 마운트당 한 번 만들어 challenge/verify에 재사용하는 세션 식별자(16자 이상). */
function makeSessionId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID().replace(/-/g, '');
  let s = '';
  while (s.length < 24) s += Math.floor(Math.random() * 36).toString(36);
  return s.slice(0, 24);
}

/**
 * 서버 좌표를 0~1 비율로 정규화한다. hit_region이 정규화(0~1)로 오면 그대로,
 * 픽셀로 오면 이미지 폭/높이로 나눈다(값이 1을 넘으면 픽셀로 간주 — 1px짜리 히트 영역은 없다).
 */
const frac = (value: number, dim: number): number => {
  if (!Number.isFinite(value)) return 0;
  const f = value > 1 && dim > 0 ? value / dim : value;
  return Math.max(0, Math.min(1, f));
};

/** 서버가 주는 상대경로(`/api/v1/captcha/drag/assets/...`)를 절대 URL로. 이미 http면 그대로. */
/**
 * CatChap Guard(성원·민서 캡차)를 API 로 직접 쓰는 모드.
 *
 * 왜 iframe 이 아닌가: 캡차 서버의 `ALLOWED_ORIGINS` 에 자기 자신이 없어서 그 주소를
 * iframe 으로 띄우면 브라우저가 보내는 Origin 이 목록에 없어 403 이 난다(실측). www 에서
 * API 로 부르면 201 이고 CORS 도 www 로 열려 있다. 그래서 화면은 이 컴포넌트가 그대로
 * 그리고 문제·판정만 저쪽에서 받는다 — 응답 모양이 같아 렌더 코드는 바뀌지 않는다.
 *
 * 켜기 전 반드시: 백엔드가 `POST /api/verify-token` 으로 토큰을 확인해야 한다. 지금
 * 로그인 API 는 자기가 발급한 토큰만 알아보므로, 이 플래그만 켜면 로그인이 막힌다.
 */
const USE_GUARD = (import.meta.env.VITE_LOGIN_CAPTCHA as string | undefined) === 'catchap';

const assetSrc = (url: string): string =>
  USE_GUARD ? guardAssetSrc(url) : url.startsWith('http') ? url : API_ORIGIN + url;

export default function DragObjectCaptcha({ onToken, onClose }: Props) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [dragging, setDragging] = useState<CaptchaObject | null>(null);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState('보안 확인을 준비하고 있습니다.');

  const sessionIdRef = useRef<string>(makeSessionId());
  const startedAtRef = useRef<number>(0);
  /**
   * 문제가 뜬 시각을 epoch 로도 잡아둔다.
   *
   * Guard 로 보낼 때 이벤트 시각은 **절대(epoch)** 여야 한다. 행동 AI 의 품질 검사가
   * 서버가 기록한 제시·제출 시각(epoch)과 대조하는데, `performance.now()` 기준
   * 상대값을 보내면 창 밖으로 판정된다(`event_timestamps_outside_server_window`).
   * 그러면 위험도가 올라 정상 사용자도 step_up 을 받는다 — 2026-08-12 에 로그인
   * 캡차를 푼 네 건이 전부 이랬다. 위젯(`main.jsx`)은 `Date.now()` 를 쓴다.
   *
   * 간격은 `performance.now()` 로 재고 시작점만 epoch 로 둔다. 벽시계가 튀어도
   * 이벤트 사이 간격이 흔들리지 않아야 하기 때문이다 — 간격은 특징으로 쓰인다.
   */
  const startedAtEpochRef = useRef<number>(0);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dropRef = useRef<HTMLDivElement | null>(null);
  const eventsRef = useRef<BehaviorEvent[]>([]);
  const lastMoveRef = useRef<number>(0);

  /** 무대(=사진) 기준 0~1 정규화 좌표. 무대 밖이면 클램프한다(서버 스키마 제약). */
  const norm = useCallback((clientX: number, clientY: number) => {
    const box = stageRef.current?.getBoundingClientRect();
    if (!box || box.width <= 0 || box.height <= 0) return { x: 0, y: 0 };
    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    return { x: clamp((clientX - box.left) / box.width), y: clamp((clientY - box.top) / box.height) };
  }, []);

  const track = useCallback((type: string, extra: Omit<BehaviorEvent, 'type' | 'timestamp_ms'> = {}) => {
    if (eventsRef.current.length >= MAX_EVENTS) return;
    eventsRef.current.push({
      type,
      // Guard 는 epoch, 백엔드 자체 캡차는 지금까지처럼 상대값. 저쪽 스키마를
      // 바꾸지 않으려고 갈라 둔다(위 `startedAtEpochRef` 주석 참고).
      timestamp_ms: USE_GUARD
        ? Math.round(startedAtEpochRef.current + (performance.now() - startedAtRef.current))
        : Math.max(0, Math.round(performance.now() - startedAtRef.current)),
      ...extra,
    });
  }, []);

  // Guard 모드에서만 쓴다. 궤적은 verify 에 싣지 않고 별도 엔드포인트로 보내는데,
  // 배치마다 영수증을 받아 다음 배치에 이어 붙여야 해서 챌린지마다 하나씩 만든다.
  const senderRef = useRef<GuardBehaviorSender | null>(null);

  const load = useCallback(async () => {
    setPhase('loading');
    setMessage('새 문제를 불러오는 중입니다.');
    setChallenge(null);
    setSelected([]);
    setDragging(null);
    setDragPoint(null);
    try {
      let data: Challenge;
      if (USE_GUARD) {
        const ch = await createGuardChallenge('login');
        senderRef.current = new GuardBehaviorSender(
          ch.challenge_id, ch.behavior_nonce, ch.behavior_batch_max_events,
        );
        data = ch as unknown as Challenge;
      } else {
        senderRef.current = null;
        ({ data } = await client.post<Challenge>('/captcha/drag/challenges', {
          purpose: 'login',
          session_id: sessionIdRef.current,
        }));
      }
      setChallenge(data);
      // 새 문제마다 행동 기록을 초기화한다 — 이전 문제의 궤적이 섞이면 분석이 왜곡된다.
      startedAtRef.current = performance.now();
      startedAtEpochRef.current = Date.now();
      eventsRef.current = [];
      lastMoveRef.current = 0;
      track('challenge_loaded');
      setPhase('ready');
      setMessage(data.instruction || '정답 객체를 정답존으로 옮겨 사람임을 증명하세요.');
    } catch (error) {
      // 여러 번 틀린 뒤에는 서버가 잠깐 기다리라고 한다. 이걸 그냥 "불러오지
      // 못했습니다" 로 보여주면 사용자는 고장난 줄 알고 계속 누른다 — 남은 초를
      // 세어 보여주고 시간이 되면 스스로 다시 불러온다.
      if (error instanceof GuardRetryLater) {
        setPhase('cooldown');
        setCooldown(error.seconds);
        return;
      }
      setPhase('error');
      setMessage('문제를 불러오지 못했습니다. 다시 시도해주세요.');
    }
  }, [track]);

  // 남은 초를 1초씩 줄이고, 0 이 되면 새 문제를 부른다.
  useEffect(() => {
    if (phase !== 'cooldown') return;
    if (cooldown <= 0) {
      void load();
      return;
    }
    setMessage(`잠시 후 다시 시도할 수 있습니다. ${cooldown}초`);
    const timer = window.setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [phase, cooldown, load]);

  useEffect(() => {
    void load();
  }, [load]);

  const startDrag = (obj: CaptchaObject, e: ReactPointerEvent) => {
    const p = norm(e.clientX, e.clientY);
    // pointer_down은 서버가 '첫 1건'만 반응시간 계산에 쓴다. drag_start는 궤적 구간의 시작점.
    track('pointer_down', { object_id: obj.object_id, x: p.x, y: p.y });
    track('drag_start', { object_id: obj.object_id, x: p.x, y: p.y });
    setDragging(obj);
    setDragPoint({ x: e.clientX, y: e.clientY });
  };

  /**
   * 조준 구간 — 집기 직전 포인터 이동.
   *
   * 왜 필요한가: 드래그 하나는 12점·0.65초뿐이라 사람과 재생 궤적을 못 가른다
   * (AUC 0.516, 동전 던지기). 조준을 앞에 붙이면 31점을 넘겨 변형 재생 검출이
   * 4% -> 96.8% 로 오른다. 문항마다 객체 위치가 달라 훔친 조준 자취는 재사용이
   * 안 되는 것이 이 신호의 근거다.
   *
   * 드래그 중에는 기록하지 않는다 — 그 구간은 moveDrag 가 pointer_move 로 이미
   * 남기고, 둘이 섞이면 어디까지가 조준인지 나중에 못 가른다.
   *
   * Guard 모드에서만 보낸다. 백엔드 자체 캡차는 이 타입을 모른다.
   */
  const aimLastRef = useRef(0);

  const trackAim = (e: ReactPointerEvent) => {
    if (!USE_GUARD || dragging || phase !== 'ready') return;
    const now = performance.now();
    if (now - aimLastRef.current < MOVE_SAMPLE_MS) return;
    aimLastRef.current = now;
    const p = norm(e.clientX, e.clientY);
    track('aim_move', { x: p.x, y: p.y });
  };

  const moveDrag = (e: ReactPointerEvent) => {
    if (!dragging) return;
    setDragPoint({ x: e.clientX, y: e.clientY });
    const now = performance.now();
    if (now - lastMoveRef.current < MOVE_SAMPLE_MS) return;
    lastMoveRef.current = now;
    const p = norm(e.clientX, e.clientY);
    track('pointer_move', { object_id: dragging.object_id, x: p.x, y: p.y });
  };

  /**
   * 드롭 판정 — 정답존이 사진 밖에 있어도 좌표로 판정하므로 문제없다.
   * (객체 버튼이 pointer capture를 잡고 있어서 정답존 자신의 onPointerUp은 안 불린다.
   *  그래서 원본과 같이 무대에서 받은 pointerup의 좌표를 정답존 사각형과 비교한다.)
   */
  const endDrag = (e: ReactPointerEvent) => {
    if (!dragging) return;
    const zone = dropRef.current?.getBoundingClientRect();
    const inside =
      !!zone &&
      e.clientX >= zone.left &&
      e.clientX <= zone.right &&
      e.clientY >= zone.top &&
      e.clientY <= zone.bottom;
    const p = norm(e.clientX, e.clientY);
    track('drop', { object_id: dragging.object_id, x: p.x, y: p.y });
    if (inside) {
      track('selection_add', { object_id: dragging.object_id, x: p.x, y: p.y });
      setSelected((rows) => (rows.includes(dragging.object_id) ? rows : [...rows, dragging.object_id]));
    }
    setDragging(null);
    setDragPoint(null);
  };

  const cancelDrag = () => {
    setDragging(null);
    setDragPoint(null);
  };

  const removeSelected = (id: string) => {
    track('object_removed', { object_id: id });
    setSelected((rows) => rows.filter((value) => value !== id));
  };

  /**
   * 키보드로 객체를 정답존에 넣는다(Tab으로 이동 → Enter/Space).
   *
   * 왜: 이 캡차는 드래그로만 풀 수 있어서 마우스를 못 쓰는 사용자는 로그인 자체가 막혔다.
   * 히트 영역은 평상시 투명하지만 :focus-visible에서 드러나므로, 화면을 볼 수 있는 키보드
   * 사용자는 어디를 고르는지 확인하면서 진행할 수 있다.
   *
   * ★행동 점수: 키보드 경로엔 드래그 궤적이 없어 서버가 move_count<3으로 +15를 매긴다.
   * 그래도 step_up 임계(30)보다 낮아 통과한다 — 반응시간(challenge_loaded→pointer_down)을
   * 함께 보내 reaction=None(+12)만은 피한다. 이 둘이 겹치면 27점이 되어 임계에 닿는다.
   */
  const selectByKeyboard = (obj: CaptchaObject, e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (done || busy) return;
    const box = e.currentTarget.getBoundingClientRect();
    const p = norm(box.left + box.width / 2, box.top + box.height / 2);
    track('pointer_down', { object_id: obj.object_id, x: p.x, y: p.y });
    track('drag_start', { object_id: obj.object_id, x: p.x, y: p.y });
    track('drop', { object_id: obj.object_id, x: p.x, y: p.y });
    track('selection_add', { object_id: obj.object_id, x: p.x, y: p.y });
    setSelected((rows) => (rows.includes(obj.object_id) ? rows : [...rows, obj.object_id]));
  };

  const verify = async () => {
    if (!challenge || selected.length === 0) {
      setMessage('먼저 정답 객체를 정답존으로 옮겨주세요.');
      return;
    }
    setPhase('verifying');
    setMessage('확인하는 중입니다.');
    track('submit');
    // 서버 스키마 제약 100~180000ms — 오래 열어둔 창이 422로 죽지 않게 양쪽을 자른다.
    const durationMs = Math.min(
      180000, Math.max(100, Math.round(performance.now() - startedAtRef.current)),
    );
    try {
      let data: VerifyResult;
      if (USE_GUARD) {
        // 궤적을 먼저 올린다. 판정 뒤에 보내면 서버가 챌린지를 닫아 배치가 거부된다.
        // 실패해도 진행한다 — 수집이 안 됐다고 로그인을 막을 이유가 없다.
        await senderRef.current?.flush(eventsRef.current);
        const out = await verifyGuardChallenge(challenge, selected, durationMs);
        if (out.success && out.captcha_token) {
          setPhase('success');
          setMessage('인증되었습니다.');
          // 백엔드가 `POST /api/verify-token` 으로 확인할 때 발급 당시의 session_id·purpose
          // 와 대조한다. 토큰만 넘기면 유효해도 거부된다.
          onToken(out.captcha_token, { token: out.captcha_token, sessionId: out.session_id, purpose: 'login' });
          return;
        }
        if (out.pow_failed) {
          setPhase('error');
          setMessage('확인 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
          return;
        }
        data = { success: false, remaining_attempts: out.remaining_attempts };
      } else {
        ({ data } = await client.post<VerifyResult>(
          `/captcha/drag/challenges/${challenge.challenge_id}/verify`,
          {
            selected_object_ids: selected,
            session_id: sessionIdRef.current,
            duration_ms: durationMs,
            events: eventsRef.current.slice(0, MAX_EVENTS),
          },
        ));
      }
      if (data.success) {
        setPhase('success');
        setMessage('인증되었습니다.');
        onToken(data.captcha_token);
        return;
      }
      if (data.blocked) {
        setPhase('error');
        setMessage('자동화 의심 행동이 감지되어 잠시 차단되었습니다.');
        return;
      }
      if (data.step_up) {
        setPhase('error');
        setMessage('추가 인증이 필요합니다. 다른 문제로 다시 시도해주세요.');
        window.setTimeout(() => void load(), 1400);
        return;
      }
      const remaining = data.remaining_attempts;
      setMessage(
        typeof remaining === 'number'
          ? `확인에 실패했습니다. 남은 시도 ${remaining}회.`
          : '확인에 실패했습니다. 다시 시도해주세요.',
      );
      window.setTimeout(() => void load(), 1400);
    } catch {
      setPhase('error');
      setMessage('확인 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
      window.setTimeout(() => void load(), 1400);
    }
  };

  const busy = phase === 'loading' || phase === 'verifying';
  const done = phase === 'success';
  // 큰 객체부터 그린다 — 뒤에 그린 것이 위에 얹히므로, 작은 객체가 큰 객체(예: 화면 절반을
  // 덮는 인물)에 가려 못 집는 일을 막는다.
  const stageObjects = challenge
    ? challenge.objects
        .filter((obj) => !selected.includes(obj.object_id))
        .slice()
        .sort((a, b) => b.hit_region[2] * b.hit_region[3] - a.hit_region[2] * a.hit_region[3])
    : [];

  return (
    <div className="fc-wrap">
      <div className="fc-card" aria-live="polite">
        <div className="fc-head">
          <div className="fc-head-title">
            <span className="fc-badge">보안 확인</span>
            <p className="fc-instruction">{message}</p>
          </div>
          <div className="fc-head-actions">
            <button
              type="button"
              className="fc-text-btn"
              onClick={() => void load()}
              disabled={busy || done}
            >
              다른 문제
            </button>
            {onClose && (
              <button type="button" className="fc-close" onClick={onClose} aria-label="닫기">
                <i className="ph-bold ph-x" />
              </button>
            )}
          </div>
        </div>

        {challenge ? (
          <>
            {/* 원본 구조: 왼쪽 사진 / 오른쪽 정답존 패널. 정답존은 사진 위가 아니다. */}
            <div className="fc-layout">
              <div
                ref={stageRef}
                className={`fc-stage ${dragging ? 'is-dragging' : ''}`}
                /* 문항 비율을 CSS 에 넘긴다. 스테이지가 사진 상자와 정확히 같아야
                   객체 히트영역(스테이지 폭·높이의 %)이 사진 위에 맞는다 — 레터박스가
                   생기면 그만큼 어긋난다. 폭은 CSS 가 카드에 맞춰 채우고, 높이 상한은
                   이 비율로 환산해 건다. */
                style={{ ['--fc-ar' as string]: `${challenge.width} / ${challenge.height}` }}
                onPointerMove={(e) => { trackAim(e); moveDrag(e); }}
                onPointerUp={endDrag}
                onPointerCancel={cancelDrag}
              >
                <img className="fc-bg" src={assetSrc(challenge.image_url)} alt="확인 문항 이미지" draggable={false} />

                {/* 투명한 집기 영역만 둔다 — 객체는 사진에 원래 그려진 것을 그대로 본다.
                    커서(grab)로만 집을 수 있다는 걸 알린다(원본과 동일). */}
                {stageObjects.map((obj) => (
                  <button
                    key={obj.object_id}
                    type="button"
                    className={`fc-object ${dragging?.object_id === obj.object_id ? 'is-lifted' : ''}`}
                    style={{
                      left: `${frac(obj.hit_region[0], challenge.width) * 100}%`,
                      top: `${frac(obj.hit_region[1], challenge.height) * 100}%`,
                      width: `${frac(obj.hit_region[2], challenge.width) * 100}%`,
                      height: `${frac(obj.hit_region[3], challenge.height) * 100}%`,
                    }}
                    onPointerDown={(e) => {
                      if (done || busy) return;
                      e.preventDefault();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      startDrag(obj, e);
                    }}
                    onKeyDown={(e) => selectByKeyboard(obj, e)}
                    aria-label="사진 속 객체 — 드래그하거나 Enter를 눌러 정답존으로 옮기기"
                  />
                ))}
              </div>

              {/* 안내는 비어 있을 때만 그린다. 객체가 들어온 뒤에도 남겨두면 "여기에
                  놓으세요" 가 이미 놓인 객체 위에 그대로 떠 있어, 넣은 게 맞는지 헷갈린다.
                  aria-label 은 문구가 사라져도 이 영역이 무엇인지 남긴다. */}
              <div
                ref={dropRef}
                aria-label="정답존"
                className={`fc-drop ${dragging ? 'armed' : ''} ${selected.length ? 'filled' : ''}`}
              >
                {selected.length === 0 && (
                  <>
                    <span className="fc-drop-icon" aria-hidden="true">
                      ↓
                    </span>
                    <strong>정답존</strong>
                    <small>해당 객체를 여기에 놓으세요</small>
                    {/* 마우스를 못 쓰는 사용자에게 대체 조작법을 알린다 — 안 적어두면 투명한
                        히트 영역을 Tab으로 찾을 수 있다는 걸 알 방법이 없다. */}
                    <small className="fc-drop-kbd">키보드는 Tab으로 이동 후 Enter</small>
                  </>
                )}
                <div className="fc-drop-grid">
                  {selected.map((id) => {
                    const obj = challenge.objects.find((o) => o.object_id === id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => removeSelected(id)}
                        disabled={done}
                        title="선택 취소"
                      >
                        {obj && <img src={assetSrc(obj.preview_url)} alt="선택한 객체" draggable={false} />}
                        <span>×</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 드래그 중 포인터를 따라오는 고스트(원본과 동일한 크기·중심 정렬).
                ★반드시 body로 포탈한다 — .fc-ghost는 position:fixed(clientX/clientY=뷰포트 기준)인데,
                이 위젯을 감싸는 조상(로그인 모달·게이트 셸)이 transform/will-change/애니메이션(예:
                .cp-widget의 진입 cpIn)을 가지면 fixed의 기준이 뷰포트가 아니라 그 조상 박스로 바뀐다.
                그러면 고스트가 커서에서 조상 offset(스케일이면 위치마다 다른 양)만큼 밀려 따라온다.
                드롭 판정(endDrag)은 getBoundingClientRect라 정상이므로 '그림만 어긋나는' 증상이 된다.
                body 직속으로 렌더하면 위 조상들의 영향을 받지 않아 항상 커서에 정확히 붙는다. */}
            {dragging && dragPoint &&
              createPortal(
                <img
                  className="fc-ghost"
                  style={{ left: dragPoint.x, top: dragPoint.y }}
                  src={assetSrc(dragging.preview_url)}
                  alt=""
                  draggable={false}
                />,
                document.body,
              )}

            <div className="fc-foot">
              <span className="fc-count">
                선택한 객체 <strong>{selected.length}개</strong>
              </span>
              <button
                type="button"
                className="fc-primary"
                onClick={() => void verify()}
                disabled={busy || done || selected.length === 0}
              >
                {phase === 'verifying' ? '확인 중…' : done ? '확인됨' : '선택 완료'}
              </button>
            </div>
          </>
        ) : (
          <div className="fc-placeholder">
            {phase === 'error' ? (
              <button type="button" className="fc-primary" onClick={() => void load()}>
                다시 시도
              </button>
            ) : phase === 'cooldown' ? (
              /* 스피너를 돌리면 "불러오는 중"으로 읽혀 사용자가 기다리는 이유를 모른다.
                 남은 초를 그대로 보여주고, 0 이 되면 저절로 다시 불러온다. */
              <div className="fc-cooldown" role="status">
                <strong>{cooldown}</strong>
                <span>초 뒤에 다시 시도할 수 있습니다</span>
              </div>
            ) : (
              <span className="fc-spinner" aria-label="불러오는 중" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
