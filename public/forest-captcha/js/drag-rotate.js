/* =========================================================================
   drag-rotate.js — 드래그(마우스/터치)로 8방향 스프라이트 프레임을 회전.

   이 파일은 "드래그 회전 버전"에서만 추가된 모듈입니다.
   기존 버튼 회전 로직을 대체하며, Pointer Events 로 PC 마우스와
   모바일/iPad 터치를 모두 지원합니다.

   설계 원칙:
     * CSS transform 으로 실제 이미지를 돌리지 않습니다.
       현재 방향 인덱스(0..7)에 맞는 스프라이트 프레임을 바꿉니다.
     * 방향 인덱스 순서는 기존 코드(captcha.js)와 동일하게 유지합니다.
       0 정면 / 1 왼쪽앞 / 2 왼쪽 / 3 왼쪽뒤 / 4 뒤 / 5 오른쪽뒤 / 6 오른쪽 / 7 오른쪽앞
     * 오른쪽 드래그 → 다음 프레임(+1), 왼쪽 드래그 → 이전 프레임(-1).
       (기존 버튼: 오른쪽=+1, 왼쪽=-1 과 동일한 방향 규칙)
   ========================================================================= */

(function () {
  'use strict';

  // 권장 기본값 — 필요하면 create() 옵션으로 덮어쓸 수 있습니다.
  const DEFAULTS = {
    FRAME_COUNT: 8,        // 8방향
    PIXELS_PER_FRAME: 35,  // 이 픽셀만큼 드래그할 때마다 1프레임 이동
    DRAG_THRESHOLD: 8,     // 이 픽셀 미만 이동은 "클릭"으로 보고 방향 유지
  };

  // 방향 인덱스 → 사람이 읽는 이름 (디버그 표시에 사용). 기존 순서와 동일.
  const DIRECTION_NAMES = ['정면', '왼쪽앞', '왼쪽', '왼쪽뒤', '뒤', '오른쪽뒤', '오른쪽', '오른쪽앞'];

  // 항상 0..count-1 범위로 감싸는 나머지 연산 (음수 안전, 7 다음 0 / 0 이전 7 순환).
  function wrap(n, count) {
    return ((n % count) + count) % count;
  }

  /**
   * 드래그 회전 컨트롤러를 만든다.
   *
   * @param {Object} cfg
   *   element        : 드래그 대상 DOM (스프라이트 div)
   *   paint(dir)     : 주어진 방향(0..count-1)의 프레임을 화면에 그리는 콜백 (필수)
   *   onChange(d,i)  : 화면에 표시되는 프레임이 바뀔 때마다 호출 (상태 동기화용)
   *   onSnap(dir)    : pointerup 에서 최종 확정된 방향을 알려줌 (verify 값 동기화용)
   *   onDebug(info)  : 디버그 콜백. null 이면 디버그 비활성.
   *   frameCount / pixelsPerFrame / dragThreshold : 튜닝 값(옵션)
   *   directionNames : 방향 이름 배열(옵션)
   */
  function create(cfg) {
    const el = cfg.element;
    if (!el) throw new Error('[drag-rotate] element 가 필요합니다.');

    const FRAME_COUNT      = cfg.frameCount      || DEFAULTS.FRAME_COUNT;
    const PIXELS_PER_FRAME = cfg.pixelsPerFrame  || DEFAULTS.PIXELS_PER_FRAME;
    const DRAG_THRESHOLD   = (cfg.dragThreshold != null) ? cfg.dragThreshold : DEFAULTS.DRAG_THRESHOLD;
    const NAMES            = cfg.directionNames  || DIRECTION_NAMES;

    const paint    = typeof cfg.paint    === 'function' ? cfg.paint    : function () {};
    const onChange = typeof cfg.onChange === 'function' ? cfg.onChange : null;
    const onSnap   = typeof cfg.onSnap   === 'function' ? cfg.onSnap   : null;
    const onDebug  = typeof cfg.onDebug  === 'function' ? cfg.onDebug  : null;

    // --- 내부 상태 ---
    let currentDirection = 0;   // 현재(확정) 방향. 항상 0..FRAME_COUNT-1.
    let dragging = false;
    let pointerId = null;
    let startX = 0;             // pointerdown 시작 X
    let startFrame = 0;         // 드래그 시작 시점의 프레임
    let displayedFrame = 0;     // 현재 화면에 그려진 프레임 (move 중 중복 렌더 방지)

    // deltaX → 시작 프레임 기준 목표 프레임 계산 (임계값 이하는 시작 프레임 유지).
    function frameFromDelta(deltaX) {
      if (Math.abs(deltaX) < DRAG_THRESHOLD) {
        return { frameOffset: 0, frame: wrap(startFrame, FRAME_COUNT) };
      }
      const frameOffset = Math.round(deltaX / PIXELS_PER_FRAME); // 오른쪽=+, 왼쪽=-
      return { frameOffset: frameOffset, frame: wrap(startFrame + frameOffset, FRAME_COUNT) };
    }

    function emitDebug(phase, deltaX, frameOffset, frame) {
      if (!onDebug) return;
      onDebug({
        phase: phase,                 // down | move | up(snap) | cancel
        deltaX: deltaX,
        frameOffset: frameOffset,
        startFrame: startFrame,
        frame: frame,                 // 현재 프레임
        snapFrame: frame,             // 최종 스냅 프레임(up 시점)
        currentDirection: currentDirection,
        name: NAMES[frame] || String(frame),
      });
    }

    // 프레임을 그리고 표시 상태를 갱신. changed=true 면 onChange 호출.
    function render(frame, reason, deltaX) {
      currentDirection = wrap(frame, FRAME_COUNT);
      if (currentDirection !== displayedFrame) {
        displayedFrame = currentDirection;
        paint(currentDirection);
        if (onChange) onChange(currentDirection, { reason: reason, deltaX: deltaX });
      } else {
        // 첫 렌더(set)는 displayedFrame 과 같아도 강제로 그림
        if (reason === 'set') {
          paint(currentDirection);
          if (onChange) onChange(currentDirection, { reason: reason, deltaX: deltaX });
        }
      }
    }

    // ------------------------------------------------------------------
    // Pointer 이벤트 핸들러
    // ------------------------------------------------------------------
    function onPointerDown(e) {
      // 주 버튼(마우스 왼쪽) 또는 터치/펜만 허용
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      dragging = true;
      pointerId = e.pointerId;
      startX = e.clientX;
      startFrame = currentDirection;   // 시작 시점의 현재 프레임 저장
      displayedFrame = currentDirection;

      el.classList.add('dragging');
      try { el.setPointerCapture(pointerId); } catch (_) { /* 무시 */ }

      e.preventDefault();              // 이미지 기본 드래그/선택 방지
      emitDebug('down', 0, 0, currentDirection);
    }

    function onPointerMove(e) {
      if (!dragging || e.pointerId !== pointerId) return;
      e.preventDefault();              // 드래그 중 페이지 스크롤 방지 (iPad 포함)

      const deltaX = e.clientX - startX;
      const r = frameFromDelta(deltaX);
      render(r.frame, 'move', deltaX);          // 계산된 프레임 즉시 표시
      emitDebug('move', deltaX, r.frameOffset, r.frame);
    }

    function finish(e, cancelled) {
      if (!dragging) return;
      dragging = false;
      el.classList.remove('dragging');

      // pointer capture 안전 해제
      try {
        if (pointerId !== null && el.hasPointerCapture && el.hasPointerCapture(pointerId)) {
          el.releasePointerCapture(pointerId);
        }
      } catch (_) { /* 무시 */ }

      if (cancelled) {
        // 취소: 드래그 시작 전 방향으로 복구
        render(startFrame, 'cancel', 0);
        emitDebug('cancel', 0, 0, currentDirection);
      } else {
        // 손을 뗀 위치에서 가장 가까운 프레임으로 자동 보정(스냅)
        const deltaX = e ? (e.clientX - startX) : 0;
        const r = frameFromDelta(deltaX);
        render(r.frame, 'snap', deltaX);         // 최종 프레임 확정 표시
        if (onSnap) onSnap(currentDirection);    // verify 값 동기화
        emitDebug('up', deltaX, r.frameOffset, r.frame);
      }

      pointerId = null;
    }

    function onPointerUp(e) {
      if (!dragging || e.pointerId !== pointerId) return;
      finish(e, false);
    }

    function onPointerCancel(e) {
      if (!dragging || e.pointerId !== pointerId) return;
      finish(e, true);
    }

    // 네이티브 이미지/요소 드래그 방지
    function onDragStart(e) { e.preventDefault(); }

    // ------------------------------------------------------------------
    // 등록 / 해제
    // ------------------------------------------------------------------
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerCancel);
    el.addEventListener('dragstart', onDragStart);

    // ------------------------------------------------------------------
    // 공개 API
    // ------------------------------------------------------------------
    return {
      /** 현재 방향(0..FRAME_COUNT-1) 반환 — verify 에 넣을 최종 값의 진실 원본 */
      getDirection: function () { return currentDirection; },

      /** 방향을 설정하고 즉시 화면에 그림 (start_direction 초기 적용 등) */
      setDirection: function (dir) {
        displayedFrame = -1;             // 강제 렌더 유도
        render(wrap(dir, FRAME_COUNT), 'set', 0);
        return currentDirection;
      },

      /** 드래그 진행 여부 */
      isDragging: function () { return dragging; },

      /** 이벤트 해제 (뷰 파괴 시) */
      destroy: function () {
        el.removeEventListener('pointerdown', onPointerDown);
        el.removeEventListener('pointermove', onPointerMove);
        el.removeEventListener('pointerup', onPointerUp);
        el.removeEventListener('pointercancel', onPointerCancel);
        el.removeEventListener('dragstart', onDragStart);
        el.classList.remove('dragging');
      },

      // 참고용 상수
      FRAME_COUNT: FRAME_COUNT,
      PIXELS_PER_FRAME: PIXELS_PER_FRAME,
      DRAG_THRESHOLD: DRAG_THRESHOLD,
      DIRECTION_NAMES: NAMES,
    };
  }

  window.DragRotate = { create: create, DIRECTION_NAMES: DIRECTION_NAMES };
})();
