import { useEffect, useRef } from 'react';

/**
 * 랜딩 최종 CTA("시청을 신뢰로 바꾸세요") 연출 훅.
 *
 * 두 가지를 한다 — 둘 다 순수 스크롤 위치 기반이라 레이아웃을 건드리지 않는다(transform만).
 *  1) **스크롤 연동 확대**: 섹션(콘텐츠) 중앙이 화면 아래 → 중앙으로 올라오는 동안 `--mn-p`를
 *     0→1로 써준다. CSS가 이 값으로 scale·opacity를 만든다. 수동 스크롤·자동 스크롤 모두 동일.
 *  2) **유휴 자동 스크롤**: 로드 후 3초간 아무 조작이 없으면 CTA 섹션으로 천천히 이동
 *     (거리 비례 2.5~6.5초, ease-in-out sine — 중간 콘텐츠가 훑어질 만큼 느리게). 사용자가 직접
 *     조작하면 즉시 취소하고 절대 방해하지 않는다.
 *
 * 규약:
 *  - `prefers-reduced-motion: reduce` → 확대·자동 스크롤 모두 비활성(정상 스크롤). `--mn-p`는
 *    CSS 기본값 1이라 콘텐츠는 그냥 풀사이즈로 보인다.
 *  - **새로고침(페이지 로드)마다 재실행**한다(세션 영속 플래그 없음). 한 로드에선 타이머가
 *    하나라 자동으로 1회만 실행되고, 조작하거나 위로 스크롤하면 그 로드에선 재실행 안 함.
 *  - 사용자가 이미 아래로 스크롤한 상태(near top 아님)면 자동 스크롤을 걸지 않는다.
 *  - 휠·트랙패드·터치·키·클릭(휠/touch/keydown/pointerdown/scroll)은 대기 타이머를 취소하고,
 *    자동 스크롤 진행 중에는 애니메이션을 즉시 중단해 사용자 입력을 우선한다.
 */
export function useCtaAutoReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const section = ref.current;
    if (!section) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    // ── 1) 스크롤 연동 확대 (rAF 스로틀) ─────────────────────────────
    let progRaf = 0;
    const updateProgress = () => {
      progRaf = 0;
      const vh = window.innerHeight || 1;
      const r = section.getBoundingClientRect();
      const contentCenter = r.top + r.height / 2; // flex-center라 섹션 중앙 = 콘텐츠 중앙
      // 콘텐츠 중앙이 화면 하단(vh)일 때 0, 화면 중앙(vh/2)일 때 1 → 보이는 동안 작게→풀사이즈
      const p = Math.min(1, Math.max(0, (vh - contentCenter) / (vh * 0.5)));
      section.style.setProperty('--mn-p', p.toFixed(4));
    };
    const onScroll = () => {
      if (!progRaf) progRaf = requestAnimationFrame(updateProgress);
    };
    if (!reduce) {
      updateProgress();
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
    }

    // ── 2) 로드 후 유휴 → 자동 스크롤 ────────────────────────────────
    // 새로고침(페이지 로드)마다 재실행한다 — 세션 영속 플래그를 쓰지 않는다(사용자 요청).
    // 한 번의 로드에서는 타이머가 하나뿐이라 자동으로 1회만 실행되고, 조작 시 취소된다.
    const IDLE_DELAY_MS = 3000; // 로드 후 대기(초)
    const DUR_PER_PX = 1.5; // 스크롤 소요 = 거리(px) × 이 값(ms) — 클수록 느림
    const DUR_MIN = 2500;
    const DUR_MAX = 6500;
    const nearTop = () => window.scrollY < (window.innerHeight || 0) * 0.15;

    let idleTimer = 0;
    let anim = 0;
    // 전역 CSS `scroll-behavior: smooth` 위에서 매 프레임 scrollTo하면 브라우저가 이중으로
    // 부드럽게 하려다 끊긴다 → 애니메이션 동안만 즉시(auto)로 덮고, 끝나면 원복(앵커 링크의
    // 부드러운 스크롤은 그대로 유지). restoreSB가 그 원복을 담고, 모든 종료 경로에서 호출된다.
    let restoreSB: (() => void) | null = null;
    // ease-in-out sine — cubic보다 중간 가속이 덜해, 긴 소요 시간과 합쳐 중간 콘텐츠가
    // 훑어질 만큼 천천히 지나간다(부드러운 시작·끝은 유지).
    const easeInOut = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

    // 자동 스크롤 진행 중 사용자 입력 → 즉시 중단(사용자 우선). scroll은 우리가 일으키므로 제외.
    const abortEvents = ['wheel', 'touchstart', 'touchmove', 'keydown', 'pointerdown'] as const;
    function endAnim() {
      if (anim) {
        cancelAnimationFrame(anim);
        anim = 0;
      }
      abortEvents.forEach((e) => window.removeEventListener(e, onAbort));
      if (restoreSB) {
        restoreSB();
        restoreSB = null;
      }
    }
    function onAbort() {
      endAnim();
    }

    const runAutoScroll = () => {
      if (!nearTop()) return;
      const vh = window.innerHeight || 1;
      const r = section.getBoundingClientRect();
      const sectionCenterAbs = r.top + window.scrollY + r.height / 2;
      const targetY = Math.max(0, Math.round(sectionCenterAbs - vh / 2)); // 콘텐츠 중앙을 화면 중앙에
      const startY = window.scrollY;
      const dist = targetY - startY;
      if (Math.abs(dist) < 40) return; // 이미 도착
      // 천천히 — 거리에 비례해 길게(px당 DUR_PER_PX), DUR_MIN~DUR_MAX 사이. 페이지를 훑으며 내려가는 느낌.
      const dur = Math.min(DUR_MAX, Math.max(DUR_MIN, Math.abs(dist) * DUR_PER_PX));
      // CSS smooth를 이 애니메이션 동안만 끈다(우리 rAF가 부드러움을 담당).
      const html = document.documentElement;
      const prevSB = html.style.scrollBehavior;
      html.style.scrollBehavior = 'auto';
      restoreSB = () => {
        html.style.scrollBehavior = prevSB;
      };
      let t0 = 0;
      abortEvents.forEach((e) => window.addEventListener(e, onAbort, { passive: true }));
      const step = (ts: number) => {
        if (!t0) t0 = ts;
        const k = Math.min((ts - t0) / dur, 1);
        window.scrollTo(0, startY + dist * easeInOut(k));
        if (k < 1) {
          anim = requestAnimationFrame(step);
        } else {
          anim = 0;
          endAnim(); // 리스너 제거 + scroll-behavior 원복
        }
      };
      anim = requestAnimationFrame(step);
    };

    // 대기 단계: 아래 조작 중 하나라도 발생하면 자동 스크롤을 걸지 않는다(직접 스크롤 포함).
    const idleEvents = ['wheel', 'touchstart', 'touchmove', 'keydown', 'pointerdown', 'scroll'] as const;
    function disarm() {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = 0;
      }
      idleEvents.forEach((e) => window.removeEventListener(e, onUserIntent));
    }
    function onUserIntent() {
      disarm();
    }

    if (!reduce && nearTop()) {
      idleEvents.forEach((e) => window.addEventListener(e, onUserIntent, { passive: true }));
      idleTimer = window.setTimeout(() => {
        disarm();
        runAutoScroll();
      }, IDLE_DELAY_MS);
    }

    return () => {
      if (progRaf) cancelAnimationFrame(progRaf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      disarm();
      endAnim();
    };
  }, []);

  return ref;
}
