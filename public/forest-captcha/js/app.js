/* =========================================================================
   app.js — the controller. Ties the backend API, the 3D engine, and the DOM
   overlays together into the captcha flow.

   IMPORTANT (security): this file NEVER computes correctness. It does not know
   target_object or target_direction. It only:
     1. asks the server for a challenge,
     2. shows the opaque target-pose image,
     3. submits the user's (object, direction) guess,
     4. reacts to the server's verdict.
   ========================================================================= */

(() => {
  const $ = (id) => document.getElementById(id);

  // 드래그 회전 디버그 스위치. true 면 화면에 디버그 패널이 보입니다.
  // (이 버전에만 추가된 옵션 — 배포 시 false 로 두세요.)
  const DEBUG_DRAG_ROTATE = false;

  // --- DOM refs ---
  const el = {
    bubble: $('bubble'), bubbleIcon: $('bubbleIcon'), bubbleText: $('bubbleText'),
    refresh: $('btnRefresh'), back: $('btnBack'),
    wrong: $('wrongToast'), rotateCard: $('rotateCard'), rotateCardInner: null,
    controlSprite: $('controlSprite'),
    left: $('btnLeft'), right: $('btnRight'), confirm: $('btnConfirm'),
    success: $('successScreen'), reset: $('btnReset'),
    status: $('statusLine'),
    // 디버그 패널
    dragDebug: $('dragDebug'),
    dbg: {
      phase: $('dbgPhase'), frame: $('dbgFrame'), name: $('dbgName'),
      start: $('dbgStart'), delta: $('dbgDelta'), offset: $('dbgOffset'), snap: $('dbgSnap'),
    },
  };
  el.rotateCardInner = el.rotateCard.querySelector('.rotate-card');

  // --- app state (display only — no answer here) ---
  // 최신 게임 규칙: 오브젝트 3개에 서로 다른 동물이 숨어 있고, 상단 문구의
  // 목표 동물이 들어 있는 오브젝트를 찾아 방향까지 맞춰야 정답.
  const state = {
    view: 'loading',            // loading | find | zoom | aim | wrong | success
    challengeId: null,
    themeId: null,              // 배경 테마 id (서버 지정)
    targetAnimal: null,         // 목표 동물 id
    targetAnimalName: null,     // 목표 동물 한글 이름
    objects: [],                // [{ object_id, animal_id, animal_name, image_path, start_direction }, ...]
    objectMap: {},              // object_id -> object
    selectedObject: null,       // 사용자가 고른 오브젝트 id
    selectedAnimal: null,       // 그 오브젝트에 들어 있는 동물 id (컨트롤 표시용)
    currentDirection: 0,        // 0..7 the control animal currently faces
    captchaToken: null,         // set on success (could be handed to /auth/login)
    busy: false,
  };

  const scene = new ForestScene('scene3d');

  // 드래그 회전 컨트롤러 (아래 wire-up 에서 생성)
  let dragRotate = null;

  // 방향 인덱스 → 이름 (기존 captcha.js 순서와 동일)
  const DIRECTION_NAMES = (window.DragRotate && window.DragRotate.DIRECTION_NAMES) ||
    ['정면', '왼쪽앞', '왼쪽', '왼쪽뒤', '뒤', '오른쪽뒤', '오른쪽', '오른쪽앞'];

  // 동물 id → 한글 이름. animal-config.js(ANIMAL_CONFIG) 를 재사용.
  function animalName(id) {
    const a = (window.ANIMAL_CONFIG && window.ANIMAL_CONFIG[id]);
    return (a && a.nameKo) || id || '동물';
  }

  // 한글 목적격 조사: 마지막 글자에 받침이 있으면 '을', 없으면 '를'.
  function objectParticle(word) {
    if (!word) return '을';
    const last = word.charCodeAt(word.length - 1);
    if (last < 0xac00 || last > 0xd7a3) return '을';   // 한글 음절이 아니면 기본 '을'
    return ((last - 0xac00) % 28) !== 0 ? '을' : '를';   // 받침(종성) 유무
  }

  // "{동물}을/를 찾아 방향을 맞추세요!" 형태의 문구 생성 (조사 자동 처리)
  function promptText(name) {
    return `${name}${objectParticle(name)} 찾아 방향을 맞추세요!`;
  }

  // ---------------------------------------------------------------------
  // UI helpers
  // ---------------------------------------------------------------------
  function show(node, on) { node.hidden = !on; }

  function setBubble(text, icon, show_ = true) {
    el.bubbleText.textContent = text;
    if (icon) el.bubbleIcon.textContent = icon;
    show(el.bubble, show_);
  }

  function setStatus(msg) { el.status.textContent = msg; }

  // 주어진 방향(0..7)의 스프라이트 프레임을 그린다. 컨트롤에는 "선택한 오브젝트의
  // 동물"이 표시된다. 드래그 중 매 프레임 호출되므로 애니메이션 재시작 없이 이미지만 교체.
  function paintSprite(dir) {
    if (!state.selectedAnimal) return;
    const style = spriteFrameStyle(state.selectedAnimal, dir);
    Object.assign(el.controlSprite.style, style);
    // 동물별 시각 보정(scale) 적용 — 기본 1.0 (방향별 offset 은 두지 않음)
    const scale = (window.animalScale ? window.animalScale(state.selectedAnimal) : 1);
    el.controlSprite.style.setProperty('--animal-scale', String(scale));
  }

  // 디버그 패널 갱신 (DEBUG_DRAG_ROTATE 가 true 일 때만 표시됨)
  function updateDebug(info) {
    if (!DEBUG_DRAG_ROTATE || !el.dragDebug) return;
    el.dbg.phase.textContent  = info.phase;
    el.dbg.frame.textContent  = info.frame;
    el.dbg.name.textContent   = DIRECTION_NAMES[info.frame] || info.name || '-';
    el.dbg.start.textContent  = info.startFrame;
    el.dbg.delta.textContent  = Math.round(info.deltaX);
    el.dbg.offset.textContent = info.frameOffset;
    el.dbg.snap.textContent   = (info.phase === 'up' || info.phase === 'cancel') ? info.snapFrame : '-';
  }

  // Reflect `state.view` onto all overlays.
  function render() {
    const v = state.view;
    show(el.bubble, v === 'find' || v === 'aim');
    show(el.refresh, v === 'find');
    show(el.back, v === 'aim');
    show(el.rotateCard, v === 'aim');
    show(el.wrong, v === 'wrong');
    show(el.success, v === 'success');

    // 상단 문구: 목표 동물 이름 + 조사 자동 처리
    const tName = state.targetAnimalName || animalName(state.targetAnimal);
    if (v === 'find') setBubble(promptText(tName), '🎯');
    else if (v === 'aim') setBubble(promptText(tName), '🧭');
  }

  // ---------------------------------------------------------------------
  // Flow
  // ---------------------------------------------------------------------
  async function loadChallenge() {
    state.busy = true;
    setStatus('새 문제를 불러오는 중…');
    try {
      const c = await CaptchaAPI.createChallenge();
      // --- 이전 challenge 상태 완전 초기화 (배경/동물/목표/선택/방향/이미지/메시지) ---
      state.challengeId = c.challenge_id;
      state.themeId = c.theme_id;
      state.targetAnimal = c.target_animal;
      state.targetAnimalName = c.target_animal_name;
      state.objects = c.objects || [];
      state.objectMap = {};
      state.objects.forEach(o => { state.objectMap[o.object_id] = o; });
      state.selectedObject = null;
      state.selectedAnimal = null;
      state.currentDirection = 0;
      el.controlSprite.style.backgroundImage = '';   // 이전 동물 이미지 제거
      state.view = 'find';
      scene.resetView();
      render();
      setStatus(`문제가 준비됐어요 · ${c.expires_in}s`);
    } catch (err) {
      setStatus('⚠️ 서버에 연결할 수 없습니다. 백엔드(:8000)가 실행 중인지 확인하세요.');
      console.error(err);
    } finally {
      state.busy = false;
    }
  }

  // 선택된 동물의 시작 방향 프레임만 지연 로딩(+실패 처리) 후 콜백. (28×8장 일괄 로드 금지)
  function preloadAnimalImage(obj, onOk) {
    const cfg = window.ANIMAL_CONFIG && window.ANIMAL_CONFIG[obj.animal_id];
    // 처음 5마리처럼 방향별 낱장 프레임을 사용 (land/{id}/dir{n}.png)
    const frameUrl = cfg ? `${cfg.base}${obj.start_direction || 0}.png` : obj.image_path;
    const img = new Image();
    img.onload = () => onOk();
    img.onerror = () => {
      // 깨진 이미지 방치 금지: 콘솔 오류 + 새 challenge 로 안전 복구
      console.error('[captcha] 동물 프레임 로드 실패:', frameUrl);
      setStatus('⚠️ 이미지 로드 실패 — 새 문제를 준비합니다');
      onWrong();
    };
    img.src = frameUrl;
  }

  // user clicked one of the 3 objects in the scene
  function onObjectPicked(objectId) {
    if (state.view !== 'find' || state.busy) return;
    const obj = state.objectMap[objectId];
    if (!obj) return;

    state.selectedObject = objectId;
    state.selectedAnimal = obj.animal_id;              // 이 오브젝트에 숨어 있던 동물
    state.currentDirection = obj.start_direction || 0; // 컨트롤 시작 프레임 (정답 아님)
    state.view = 'zoom';             // transient — no bubble/controls yet
    show(el.refresh, false);
    setBubble('어디에 있을까요...?', '👀');

    // 선택된 동물 이미지를 먼저 확인(지연 로딩)한 뒤 줌/등장 진행
    preloadAnimalImage(obj, () => {
      scene.zoomToObject(objectId).then(() => {
        // reveal this object's animal at its heading — OPAQUE server image (index 미노출).
        scene.showFoundAnimal(CaptchaAPI.revealImageURL(state.challengeId, objectId));
        state.view = 'aim';
        // 컨트롤에 선택 동물을 시작 프레임으로 표시 (드래그 시작 기준점).
        dragRotate.setDirection(state.currentDirection);
        render();
      });
    });
  }

  async function confirm() {
    if (state.view !== 'aim' || state.busy) return;
    state.busy = true;
    try {
      // 화면에 최종 표시된 프레임(드래그+스냅 결과)을 진실 원본으로 사용.
      const finalDirection = dragRotate ? dragRotate.getDirection() : state.currentDirection;
      state.currentDirection = finalDirection;
      // selected_animal 은 보내지 않는다 — 서버가 object→animal 로 직접 판정.
      const res = await CaptchaAPI.verify(
        state.challengeId, state.themeId, state.selectedObject, finalDirection
      );
      if (res.success) {
        state.captchaToken = res.captcha_token;
        state.view = 'success';
        scene.resetView();
        render();
        setStatus('통과했습니다.');
        // React 로그인 화면에 단일사용 토큰 전달. 부모는 iframe source까지 확인한다.
        try {
          window.parent.postMessage(
            { type: 'forest-captcha-token', token: res.captcha_token },
            '*'
          );
        } catch (_) { /* 단독 실행이면 부모가 없으므로 무시 */ }
      } else {
        // wrong OR expired → the server already discarded this challenge.
        onWrong();
      }
    } catch (err) {
      setStatus('⚠️ 검증 요청 실패');
      console.error(err);
    } finally {
      state.busy = false;
    }
  }

  // wrong answer: brief toast, then a brand-new challenge (never reuse the old)
  function onWrong() {
    state.view = 'wrong';
    scene.resetView();
    render();
    setStatus('❌ 틀렸어요 — 새 문제를 준비합니다');
    setTimeout(() => { loadChallenge(); }, 950);
  }

  // back button in aim view → return to overview WITHOUT discarding the challenge
  function back() {
    if (state.busy) return;
    state.view = 'find';
    state.selectedObject = null;
    state.selectedAnimal = null;
    scene.resetView();
    render();
  }

  // ---------------------------------------------------------------------
  // Wire up
  // ---------------------------------------------------------------------
  // 드래그 회전 컨트롤러 생성 (버튼 대신 동물 이미지를 직접 드래그)
  dragRotate = window.DragRotate.create({
    element: el.controlSprite,
    paint: (dir) => paintSprite(dir),
    // 표시 프레임이 바뀔 때마다 state.currentDirection 동기화 + 디버그 갱신
    onChange: (dir, meta) => {
      state.currentDirection = dir;
      if (DEBUG_DRAG_ROTATE) {
        updateDebug({
          phase: meta.reason === 'snap' ? 'up' : meta.reason,
          frame: dir, startFrame: dir, deltaX: meta.deltaX || 0, frameOffset: 0, snapFrame: dir,
          name: DIRECTION_NAMES[dir],
        });
      }
    },
    // pointerup 최종 확정 방향을 verify 값으로 확정
    onSnap: (dir) => { state.currentDirection = dir; },
    // 디버그 콜백: DEBUG 가 false 면 null → 아무것도 표시하지 않음
    onDebug: DEBUG_DRAG_ROTATE ? updateDebug : null,
    directionNames: DIRECTION_NAMES,
  });

  // 디버그 패널 표시 여부
  if (el.dragDebug) show(el.dragDebug, DEBUG_DRAG_ROTATE);

  scene.onPick(onObjectPicked);
  el.refresh.addEventListener('click', () => { if (!state.busy) loadChallenge(); });
  el.back.addEventListener('click', back);
  // 기존 회전 버튼(btnLeft/btnRight)은 드래그 방식으로 대체되어 비활성화됨 (HTML 에서 hidden).
  el.confirm.addEventListener('click', confirm);
  el.reset.addEventListener('click', () => { if (!state.busy) loadChallenge(); });

  scene.init();
  scene.onReady(() => loadChallenge());
})();
