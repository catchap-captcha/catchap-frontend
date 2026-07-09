/* =========================================================================
   api.js — CatChap forest 캡차 API 래퍼 (iframe 위젯용).
   백엔드 base는 iframe src의 ?api= 쿼리로 주입한다(예: http://localhost:8000/api/v1).
   경로는 CatChap: /captcha/forest/*.
   ========================================================================= */

const CaptchaAPI = (() => {
  // 우선순위: window.CAPTCHA_API_BASE → URL ?api= → 동일 출처 /api/v1
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

    /** POST /captcha/forest/challenge -> { challenge_id, animal, objects, start_direction, expires_in } */
    createChallenge() {
      return postJSON('/captcha/forest/challenge');
    },

    /** 불투명 목표 포즈 이미지 URL — 방향 index는 노출되지 않는다. */
    targetImageURL(challengeId) {
      return `${BASE}/captcha/forest/${encodeURIComponent(challengeId)}/target`;
    },

    /** POST /captcha/forest/verify -> { success, captcha_token?, message? } */
    verify(challengeId, selectedObject, selectedDirection) {
      return postJSON('/captcha/forest/verify', {
        challenge_id: challengeId,
        selected_object: selectedObject,
        selected_direction: selectedDirection,
      });
    },
  };
})();

window.CaptchaAPI = CaptchaAPI;
