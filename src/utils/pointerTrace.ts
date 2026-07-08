/**
 * 포인터 궤적 캡처 — 아동용 캡차 판정 모델의 학습 재료.
 *
 * 지정한 영역에서 [t_ms, x, y] (좌표는 영역 기준 0~1 정규화)를 샘플링해서
 * 서버 behavior 페이로드(trace/box)로 만들어 준다. 요약 지표(경로·속도·멈춤)는
 * 서버(captcha_service.record_behavior_event)가 궤적에서 직접 계산한다.
 */

export interface TraceBehavior {
  trace: [number, number, number][];
  box: { w: number; h: number };
  input_type: string; // mouse|touch|pen|unknown — 기기 축(수집 시점에만 알 수 있음)
}

const SAMPLE_MIN_MS = 16; // pointermove 스로틀 — 페이로드 과대 방지
const MAX_POINTS = 1500; // 서버 캡(2000)보다 낮게

export interface PointerTraceRecorder {
  /** 새 문항 시작 등에서 궤적을 비우고 시각 기준을 리셋 */
  reset(): void;
  /** 현재까지의 궤적을 behavior 페이로드 조각으로 반환 (점 2개 미만이면 null) */
  snapshot(): TraceBehavior | null;
  /** 리스너 해제 (컴포넌트 언마운트 시) */
  detach(): void;
}

export function attachPointerTrace(el: HTMLElement): PointerTraceRecorder {
  let trace: [number, number, number][] = [];
  let startAt = Date.now();
  let lastT = -1;
  let inputType = '';

  const record = (e: PointerEvent, force: boolean) => {
    if (e.pointerType) inputType = e.pointerType; // mouse|touch|pen
    if (trace.length >= MAX_POINTS) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    const t = Date.now() - startAt;
    if (!force && lastT >= 0 && t - lastT < SAMPLE_MIN_MS) return;
    lastT = t;
    trace.push([t, Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4]);
  };

  const onMove = (e: PointerEvent) => record(e, false);
  const onDown = (e: PointerEvent) => record(e, true);
  const onUp = (e: PointerEvent) => record(e, true);
  el.addEventListener('pointermove', onMove, { passive: true });
  el.addEventListener('pointerdown', onDown, { passive: true });
  el.addEventListener('pointerup', onUp, { passive: true });

  return {
    reset() {
      trace = [];
      startAt = Date.now();
      lastT = -1;
      inputType = '';
    },
    snapshot() {
      if (trace.length < 2) return null;
      const r = el.getBoundingClientRect();
      return {
        trace: trace.slice(),
        box: { w: Math.round(r.width), h: Math.round(r.height) },
        input_type: inputType || 'unknown',
      };
    },
    detach() {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
    },
  };
}
