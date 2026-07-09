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

  // --- DOM refs ---
  const el = {
    bubble: $('bubble'), bubbleIcon: $('bubbleIcon'), bubbleText: $('bubbleText'),
    refresh: $('btnRefresh'), back: $('btnBack'),
    wrong: $('wrongToast'), rotateCard: $('rotateCard'), rotateCardInner: null,
    controlSprite: $('controlSprite'),
    left: $('btnLeft'), right: $('btnRight'), confirm: $('btnConfirm'),
    success: $('successScreen'), reset: $('btnReset'),
    status: $('statusLine'),
  };
  el.rotateCardInner = el.rotateCard.querySelector('.rotate-card');

  // --- app state (display only — no answer here) ---
  const state = {
    view: 'loading',            // loading | find | aim | wrong | success
    challengeId: null,
    animal: 'dog',
    objects: [],
    currentDirection: 0,        // 0..7 the control animal currently faces
    selectedObject: null,
    captchaToken: null,         // set on success (could be handed to /auth/login)
    busy: false,
  };

  const scene = new ForestScene('scene3d');

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

  function paintControl() {
    const style = spriteFrameStyle(state.animal, state.currentDirection);
    Object.assign(el.controlSprite.style, style);
    // restart the little spin-pop animation on every change
    el.controlSprite.style.animation = 'none';
    void el.controlSprite.offsetWidth;   // reflow
    el.controlSprite.style.animation = '';
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

    if (v === 'find') setBubble('숨어 있는 동물을 찾아주세요!', '🐾');
    else if (v === 'aim') setBubble('같은 방향으로 동물을 돌려주세요!', '🧭');
  }

  // ---------------------------------------------------------------------
  // Flow
  // ---------------------------------------------------------------------
  async function loadChallenge() {
    state.busy = true;
    setStatus('새 문제를 불러오는 중…');
    try {
      const c = await CaptchaAPI.createChallenge();
      state.challengeId = c.challenge_id;
      state.animal = c.animal;
      state.objects = c.objects;
      state.currentDirection = c.start_direction;   // start off-target (server guarantees)
      state.selectedObject = null;
      state.view = 'find';
      scene.resetView();
      render();
      setStatus(`challenge ${c.challenge_id.slice(0, 8)}… · ${c.animal} · ${c.expires_in}s`);
    } catch (err) {
      setStatus('⚠️ 서버에 연결할 수 없습니다. 백엔드(:8000)가 실행 중인지 확인하세요.');
      console.error(err);
    } finally {
      state.busy = false;
    }
  }

  // user clicked one of the 3 objects in the scene
  function onObjectPicked(objectId) {
    if (state.view !== 'find' || state.busy) return;
    state.selectedObject = objectId;
    state.view = 'zoom';             // transient — no bubble/controls yet
    show(el.refresh, false);
    setBubble('어디에 있을까요...?', '👀');

    scene.zoomToObject(objectId).then(() => {
      // reveal the animal (opaque server image) and enter the aim/rotate view
      scene.showFoundAnimal(CaptchaAPI.targetImageURL(state.challengeId));
      state.view = 'aim';
      paintControl();
      render();
    });
  }

  function rotate(delta) {
    if (state.view !== 'aim') return;
    state.currentDirection = (state.currentDirection + (delta > 0 ? 1 : 7)) % 8;
    paintControl();
  }

  async function confirm() {
    if (state.view !== 'aim' || state.busy) return;
    state.busy = true;
    try {
      const res = await CaptchaAPI.verify(
        state.challengeId, state.selectedObject, state.currentDirection
      );
      if (res.success) {
        state.captchaToken = res.captcha_token;
        state.view = 'success';
        scene.resetView();
        render();
        setStatus(`✅ 통과!`);
        // 부모(React 로그인 페이지)에 단일사용 captcha_token 전달 → /auth/login에 실어 재시도.
        try {
          window.parent.postMessage(
            { type: 'forest-captcha-token', token: res.captcha_token },
            '*'
          );
        } catch (_) { /* 부모 없음(단독 실행) — 무시 */ }
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
    scene.resetView();
    render();
  }

  // ---------------------------------------------------------------------
  // Wire up
  // ---------------------------------------------------------------------
  scene.onPick(onObjectPicked);
  el.refresh.addEventListener('click', () => { if (!state.busy) loadChallenge(); });
  el.back.addEventListener('click', back);
  el.left.addEventListener('click', () => rotate(-1));
  el.right.addEventListener('click', () => rotate(1));
  el.confirm.addEventListener('click', confirm);
  el.reset.addEventListener('click', () => { if (!state.busy) loadChallenge(); });

  scene.init();
  scene.onReady(() => loadChallenge());
})();
