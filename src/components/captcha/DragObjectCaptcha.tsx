import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import { client } from '../../api/client';
import { API_ORIGIN } from '../../api/lectures';
import './DragObjectCaptcha.css';

/**
 * ForestCaptcha — 로그인 흐름에 임베드하는 "확인 문항"(object-drag 캡차) 위젯.
 *
 * 왜 이렇게(팀 학습용): 예전엔 3D 숲 캡차를 iframe으로 격리 실행했지만, 지금은 서버가 내려주는
 * 배경 이미지 위에서 "정답 객체를 정답존으로 드래그"하는 상호작용형 캡차로 교체했다. 정답은
 * 서버에만 있고(클라이언트는 어떤 object가 정답인지 모른다), 사용자가 옮긴 object_id 목록만
 * 서버로 보내 검증한다. 통과 시 서버가 단일사용 captcha_token을 주고, 그걸 onToken으로 넘겨
 * 로그인 요청에 실어 서버가 최종 검증한다.
 *
 * Props는 이전 iframe 래퍼와 동일하게 유지한다(onToken/onClose) — 호출부(LoginPage/OpsLogin)를
 * 건드리지 않기 위해서다.
 */
interface Props {
  onToken: (token: string) => void;
  onClose?: () => void;
}

interface CaptchaObject {
  object_id: string;
  /** 배경 이미지 기준 히트 영역 [x, y, w, h]. 정규화(0~1) 또는 픽셀(width/height 기준) 모두 수용. */
  hit_region: [number, number, number, number];
  preview_url: string;
}

interface DropZone {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Challenge {
  challenge_id: string;
  type: string;
  instruction: string;
  image_url: string;
  width: number;
  height: number;
  objects: CaptchaObject[];
  drop_zone: DropZone;
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

type Phase = 'loading' | 'ready' | 'verifying' | 'success' | 'error';

/**
 * 서버 행동 분석에 보내는 이벤트. 서버(drag_captcha_service.summarize)가 인식하는 type은
 * challenge_loaded · pointer_down · drag_start · pointer_move · drop · object_removed 이고,
 * x/y는 0~1 정규화 좌표여야 한다(백엔드 스키마 Field(ge=0, le=1)).
 *
 * ★왜 꼭 보내야 하나: 예전엔 events를 빈 배열로 보냈는데, 그러면 서버가 move_count<3(+15)와
 * reaction=None(+12)으로 정답을 맞혀도 기본 27점을 매긴다. step_up 임계가 30이라 10분 내
 * 챌린지 4회(+5)나 IP당 1분 5회(+5) 같은 정상 사용 패턴만 겹쳐도 30을 넘어 "추가 인증 필요"로
 * 정답이 거절됐다. 실제 이벤트를 보내면 그 27점이 사라지고, 동시에 봇 판별(경로 곡률·속도
 * 분산·반응시간)이 비로소 동작한다.
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
/** pointer_move 표본 간격(ms). 너무 촘촘하면 상한만 채우고 분석에 도움이 안 된다. */
const MOVE_SAMPLE_MS = 25;
/** 이 거리(px) 이상 움직여야 '드래그'로 본다 — 손떨림 클릭과 구분. */
const DRAG_SLOP_PX = 4;

/** 마운트당 한 번 만들어 challenge/verify에 재사용하는 세션 식별자(16자 이상). */
function makeSessionId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID().replace(/-/g, '');
  let s = '';
  while (s.length < 24) s += Math.floor(Math.random() * 36).toString(36);
  return s.slice(0, 24);
}

/**
 * 서버 좌표를 0~1 비율로 정규화한다. hit_region/drop_zone이 정규화(0~1)로 오면 그대로,
 * 픽셀로 오면 이미지 폭/높이로 나눈다(값이 1을 넘으면 픽셀로 간주 — 1px짜리 히트 영역은 없다).
 */
const frac = (value: number, dim: number): number => {
  if (!Number.isFinite(value)) return 0;
  const f = value > 1 && dim > 0 ? value / dim : value;
  return Math.max(0, Math.min(1, f));
};

/** 서버가 주는 상대경로(`/api/v1/captcha/assets/...`)를 절대 URL로. 이미 http면 그대로. */
const assetSrc = (url: string): string => (url.startsWith('http') ? url : API_ORIGIN + url);

export default function ForestCaptcha({ onToken, onClose }: Props) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [dragging, setDragging] = useState<CaptchaObject | null>(null);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [message, setMessage] = useState('보안 확인을 준비하고 있습니다.');

  const sessionIdRef = useRef<string>(makeSessionId());
  const startedAtRef = useRef<number>(0);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dropRef = useRef<HTMLDivElement | null>(null);
  const eventsRef = useRef<BehaviorEvent[]>([]);
  const lastMoveRef = useRef<number>(0);
  /** 집어 올린 객체의 실제 렌더 크기와 '잡은 지점' 오프셋 — 고스트를 원래 크기로 따라오게 한다. */
  const liftRef = useRef<{ w: number; h: number; dx: number; dy: number; moved: boolean } | null>(null);

  /** 무대(=사진) 기준 0~1 정규화 좌표. 무대 밖이면 0~1로 클램프한다(서버 스키마 제약). */
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
      timestamp_ms: Math.max(0, Math.round(performance.now() - startedAtRef.current)),
      ...extra,
    });
  }, []);

  const load = useCallback(async () => {
    setPhase('loading');
    setMessage('새 문제를 불러오는 중입니다.');
    setChallenge(null);
    setSelected([]);
    setDragging(null);
    setDragPoint(null);
    try {
      const { data } = await client.post<Challenge>('/captcha/drag/challenges', {
        purpose: 'login',
        session_id: sessionIdRef.current,
      });
      setChallenge(data);
      // 새 문제마다 행동 기록을 초기화한다 — 이전 문제의 궤적이 섞이면 분석이 왜곡된다.
      startedAtRef.current = performance.now();
      eventsRef.current = [];
      lastMoveRef.current = 0;
      liftRef.current = null;
      track('challenge_loaded');
      setPhase('ready');
      setMessage(data.instruction || '정답 객체를 정답존으로 옮겨 사람임을 증명하세요.');
    } catch {
      setPhase('error');
      setMessage('문제를 불러오지 못했습니다. 다시 시도해주세요.');
    }
  }, [track]);

  useEffect(() => {
    void load();
  }, [load]);

  const startDrag = (obj: CaptchaObject, e: ReactPointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    liftRef.current = {
      w: rect.width,
      h: rect.height,
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
      moved: false,
    };
    const p = norm(e.clientX, e.clientY);
    // pointer_down은 서버가 '첫 1건'만 반응시간 계산에 쓴다. drag_start는 궤적 구간의 시작점.
    track('pointer_down', { object_id: obj.object_id, x: p.x, y: p.y });
    track('drag_start', { object_id: obj.object_id, x: p.x, y: p.y });
    setDragging(obj);
    setDragPoint({ x: e.clientX, y: e.clientY });
  };

  const moveDrag = (e: ReactPointerEvent) => {
    if (!dragging) return;
    setDragPoint({ x: e.clientX, y: e.clientY });
    const lift = liftRef.current;
    if (lift && !lift.moved) {
      const far = Math.hypot(e.clientX - (dragPoint?.x ?? e.clientX), e.clientY - (dragPoint?.y ?? e.clientY));
      if (far >= DRAG_SLOP_PX) lift.moved = true;
    }
    // 표본 간격을 둬서 이벤트 상한을 아끼되, 실제 궤적 모양(곡률·속도 분산)은 남긴다.
    const now = performance.now();
    if (now - lastMoveRef.current < MOVE_SAMPLE_MS) return;
    lastMoveRef.current = now;
    const p = norm(e.clientX, e.clientY);
    track('pointer_move', { object_id: dragging.object_id, x: p.x, y: p.y });
  };

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
      setSelected((rows) => (rows.includes(dragging.object_id) ? rows : [...rows, dragging.object_id]));
    }
    liftRef.current = null;
    setDragging(null);
    setDragPoint(null);
  };

  const cancelDrag = () => {
    liftRef.current = null;
    setDragging(null);
    setDragPoint(null);
  };

  const removeSelected = (id: string) => {
    track('object_removed', { object_id: id });
    setSelected((rows) => rows.filter((value) => value !== id));
  };

  const verify = async () => {
    if (!challenge || selected.length === 0) {
      setMessage('먼저 정답 객체를 정답존으로 옮겨주세요.');
      return;
    }
    setPhase('verifying');
    setMessage('확인하는 중입니다.');
    try {
      const { data } = await client.post<VerifyResult>(
        `/captcha/drag/challenges/${challenge.challenge_id}/verify`,
        {
          selected_object_ids: selected,
          session_id: sessionIdRef.current,
          // 서버 스키마 제약 100~180000ms — 오래 열어둔 창이 422로 죽지 않게 양쪽을 자른다.
          duration_ms: Math.min(180000, Math.max(100, Math.round(performance.now() - startedAtRef.current))),
          events: eventsRef.current.slice(0, MAX_EVENTS),
        },
      );
      if (data.success) {
        setPhase('success');
        setMessage('확인되었습니다.');
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
  const dropObjects = challenge
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
            {/* 무대는 CSS에서 사진에 shrink-wrap된다 — 여기서 aspect-ratio를 주면 무대와 사진
                박스가 어긋나 객체 좌표가 통째로 틀어진다(예전 버그). 크기는 .fc-bg가 정한다. */}
            <div
              ref={stageRef}
              className={`fc-stage ${dragging ? 'is-dragging' : ''}`}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={cancelDrag}
            >
              <img className="fc-bg" src={assetSrc(challenge.image_url)} alt="확인 문항 이미지" draggable={false} />

              {/* 정답존 — 배경 위 목표 상자. 히트 판정만 하고 포인터 이벤트는 통과시킨다. */}
              <div
                ref={dropRef}
                className={`fc-dropzone ${dragging ? 'armed' : ''}`}
                style={{
                  left: `${frac(challenge.drop_zone.x, challenge.width) * 100}%`,
                  top: `${frac(challenge.drop_zone.y, challenge.height) * 100}%`,
                  width: `${frac(challenge.drop_zone.width, challenge.width) * 100}%`,
                  height: `${frac(challenge.drop_zone.height, challenge.height) * 100}%`,
                }}
              >
                <span className="fc-dropzone-label">정답존</span>
              </div>

              {/* 드래그 가능한 객체 마커 — hit_region 위치, preview_url 미리보기 */}
              {dropObjects.map((obj) => (
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
                  aria-label="객체를 정답존으로 드래그"
                >
                  <img src={assetSrc(obj.preview_url)} alt="" draggable={false} />
                </button>
              ))}
            </div>

            {/* 집어 올린 객체 — 사진에서 뽑아낸 그 크기 그대로, 잡은 지점이 포인터 아래에
                유지되도록 오프셋을 빼서 그린다. 그래야 별개 아이콘이 아니라 "사진에서 꺼낸
                물건"으로 읽힌다. */}
            {dragging && dragPoint && liftRef.current && (
              <img
                className="fc-ghost"
                style={{
                  left: dragPoint.x - liftRef.current.dx,
                  top: dragPoint.y - liftRef.current.dy,
                  width: liftRef.current.w,
                  height: liftRef.current.h,
                }}
                src={assetSrc(dragging.preview_url)}
                alt=""
                draggable={false}
              />
            )}

            <div className="fc-foot">
              <div className="fc-selected">
                {selected.length === 0 ? (
                  <span className="fc-selected-hint">옮긴 객체 없음</span>
                ) : (
                  selected.map((id) => {
                    const obj = challenge.objects.find((o) => o.object_id === id);
                    return (
                      <button
                        key={id}
                        type="button"
                        className="fc-chip"
                        onClick={() => removeSelected(id)}
                        disabled={done}
                        title="선택 취소"
                      >
                        {obj && <img src={assetSrc(obj.preview_url)} alt="" draggable={false} />}
                        <span className="fc-chip-x">×</span>
                      </button>
                    );
                  })
                )}
              </div>
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
            ) : (
              <span className="fc-spinner" aria-label="불러오는 중" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
