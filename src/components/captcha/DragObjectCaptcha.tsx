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
      startedAtRef.current = performance.now();
      setPhase('ready');
      setMessage(data.instruction || '정답 객체를 정답존으로 옮겨 사람임을 증명하세요.');
    } catch {
      setPhase('error');
      setMessage('문제를 불러오지 못했습니다. 다시 시도해주세요.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const moveDrag = (e: ReactPointerEvent) => {
    if (!dragging) return;
    setDragPoint({ x: e.clientX, y: e.clientY });
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
    if (inside) {
      setSelected((rows) => (rows.includes(dragging.object_id) ? rows : [...rows, dragging.object_id]));
    }
    setDragging(null);
    setDragPoint(null);
  };

  const cancelDrag = () => {
    setDragging(null);
    setDragPoint(null);
  };

  const removeSelected = (id: string) =>
    setSelected((rows) => rows.filter((value) => value !== id));

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
          duration_ms: Math.max(100, Math.round(performance.now() - startedAtRef.current)),
          events: [],
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
  const dropObjects = challenge
    ? challenge.objects.filter((obj) => !selected.includes(obj.object_id))
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
            <div
              ref={stageRef}
              className={`fc-stage ${dragging ? 'is-dragging' : ''}`}
              style={{ aspectRatio: `${challenge.width} / ${challenge.height}` }}
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
                  className="fc-object"
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
                    setDragging(obj);
                    setDragPoint({ x: e.clientX, y: e.clientY });
                  }}
                  aria-label="객체를 정답존으로 드래그"
                >
                  <img src={assetSrc(obj.preview_url)} alt="" draggable={false} />
                </button>
              ))}
            </div>

            {/* 드래그 중 포인터를 따라오는 고스트 미리보기 */}
            {dragging && dragPoint && (
              <img
                className="fc-ghost"
                style={{ left: dragPoint.x, top: dragPoint.y }}
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
