/* =========================================================================
   api.js — CatChap forest CAPTCHA API wrapper for the iframe bundle.
   The React wrapper injects the /api/v1 base through the iframe's ?api= query.
   ========================================================================= */

const CaptchaAPI = (() => {
  const params = new URLSearchParams(window.location.search);
  const BASE =
    window.CAPTCHA_API_BASE ||
    params.get('api') ||
    (window.location.origin + '/api/v1');

  async function postJSON(path, body) {
    const res = await fetch(BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
    return res.json();
  }

  return {
    base: BASE,

    /**
     * POST /captcha/forest/challenge
     * -> { challenge_id, target_animal,
     *      objects:[{ object_id, animal, start_direction }], expires_in }
     */
    createChallenge() {
      return postJSON('/captcha/forest/challenge');
    },

    /**
     * URL of the OPAQUE pose image for one object's animal.
     * The client shows these pixels but never learns the direction index —
     * that's how the answer stays server-side (resource-token pattern).
     */
    revealImageURL(challengeId, objectId) {
      return `${BASE}/captcha/forest/${encodeURIComponent(challengeId)}/reveal/${encodeURIComponent(objectId)}`;
    },

    /**
     * POST /captcha/forest/verify -> { success, captcha_token? , message? }
     * selected_animal 은 보내지 않는다 — 서버가 object→animal 매핑으로 직접 판정.
     */
    verify(challengeId, themeId, selectedObject, selectedDirection) {
      return postJSON('/captcha/forest/verify', {
        challenge_id: challengeId,
        theme_id: themeId,
        selected_object: selectedObject,
        selected_direction: selectedDirection,
      });
    },
  };
})();

window.CaptchaAPI = CaptchaAPI;
