import { useEffect, useRef } from 'react';

/**
 * 랜딩 최종 CTA("시청을 신뢰로 바꾸세요") 연출 훅.
 *
 * 두 가지를 한다 — 둘 다 순수 스크롤 위치 기반이라 레이아웃을 건드리지 않는다(transform만).
 *  1) **스크롤 연동 확대**: 섹션(콘텐츠) 중앙이 화면 아래 → 중앙으로 올라오는 동안 `--mn-p`를
 *     0→1로 써준다. CSS가 이 값으로 scale·opacity를 만든다. 수동 스크롤·자동 스크롤 모두 동일.
 *  2) **유휴 가이드 투어**: 로드 후 5초간 아무 조작이 없으면 위에서부터 각 섹션을 차례로 훑는다 —
 *     한 섹션으로 빠르게 이동 → 약 2초 멈춤 → 다음 섹션 … → 마지막 CTA(화면 중앙, 확대 완성).
 *     사용자가 직접 조작하면 즉시 취소하고 절대 방해하지 않는다.
 *
 * 규약:
 *  - `prefers-reduced-motion: reduce` → 확대·투어 모두 비활성(정상 스크롤). `--mn-p`는 CSS
 *    기본값 1이라 콘텐츠는 그냥 풀사이즈로 보인다.
 *  - **새로고침(페이지 로드)마다 재실행**한다(세션 영속 플래그 없음). 한 로드에선 타이머가
 *    하나라 자동으로 1회만 실행되고, 조작하거나 위로 스크롤하면 그 로드에선 재실행 안 함.
 *  - 사용자가 이미 아래로 스크롤한 상태(near top 아님)면 투어를 걸지 않는다.
 *  - 휠·트랙패드·터치·키·클릭(휠/touch/keydown/pointerdown/scroll)은 대기 타이머를 취소하고,
 *    투어(이동·멈춤) 중에는 즉시 중단해 사용자 입력을 우선한다.
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

    // ── 2) 로드 후 유휴 → 섹션별 가이드 투어 ─────────────────────────
    const IDLE_DELAY_MS = 5000; // 로드 후 투어 시작까지 대기
    const PAUSE_MS = 2000; // 각 섹션에서 멈추는 시간
    const SEG_PER_PX = 0.65; // 구간 이동 소요 = 거리(px) × 이 값(ms). 작을수록 빠름
    const SEG_MIN = 450; // 구간 이동 최소/최대 소요(ms)
    const SEG_MAX = 1100;
    const nearTop = () => window.scrollY < (window.innerHeight || 0) * 0.15;

    let idleTimer = 0;
    let anim = 0;
    let pauseTimer = 0;
    // 전역 CSS `scroll-behavior: smooth` 위에서 매 프레임 scrollTo하면 이중 스무딩으로 끊긴다 →
    // 투어 동안만 즉시(auto)로 덮고, 끝나면 원복(앵커 링크의 부드러운 스크롤은 유지).
    let restoreSB: (() => void) | null = null;
    // ease-in-out cubic — 각 구간을 부드럽게 가속·감속해 '다음 섹션으로 옮겨가 멈추는' 느낌.
    const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    // 투어 중 사용자 입력 → 즉시 중단(사용자 우선). scroll은 우리가 일으키므로 제외.
    const abortEvents = ['wheel', 'touchstart', 'touchmove', 'keydown', 'pointerdown'] as const;
    function endTour() {
      if (anim) {
        cancelAnimationFrame(anim);
        anim = 0;
      }
      if (pauseTimer) {
        clearTimeout(pauseTimer);
        pauseTimer = 0;
      }
      abortEvents.forEach((e) => window.removeEventListener(e, onAbort));
      if (restoreSB) {
        restoreSB();
        restoreSB = null;
      }
    }
    function onAbort() {
      endTour();
    }

    // 방문할 정지 지점(스크롤 y) — 현재 위치 아래의 각 섹션. 마지막(CTA)만 화면 중앙(확대 완성),
    // 나머지는 섹션 상단을 화면 위에 맞춘다. 서로 너무 가까운 지점은 하나로 합친다.
    const computeStops = () => {
      const pageRoot = section.closest('.mn-page') ?? section.parentElement;
      const secs = pageRoot
        ? Array.from(pageRoot.querySelectorAll<HTMLElement>(':scope > section'))
        : [section];
      const vh = window.innerHeight || 1;
      const stops: number[] = [];
      for (const s of secs) {
        const topAbs = s.getBoundingClientRect().top + window.scrollY;
        const y = Math.max(
          0,
          Math.round(s === section ? topAbs + s.offsetHeight / 2 - vh / 2 : topAbs),
        );
        // 현재 위치 아래 + 직전 지점과 충분히 떨어진 것만(짧은 섹션 중복 정지 방지)
        if (y > window.scrollY + 30 && (stops.length === 0 || y - stops[stops.length - 1] > 80)) {
          stops.push(y);
        }
      }
      return stops;
    };

    const animateTo = (targetY: number, dur: number, onDone: () => void) => {
      const startY = window.scrollY;
      const dist = targetY - startY;
      if (Math.abs(dist) < 8) {
        onDone();
        return;
      }
      let t0 = 0;
      const step = (ts: number) => {
        if (!t0) t0 = ts;
        const k = Math.min((ts - t0) / dur, 1);
        window.scrollTo(0, startY + dist * easeInOut(k));
        if (k < 1) {
          anim = requestAnimationFrame(step);
        } else {
          anim = 0;
          onDone();
        }
      };
      anim = requestAnimationFrame(step);
    };

    const runTour = () => {
      if (!nearTop()) return;
      const stops = computeStops();
      if (stops.length === 0) return;
      // CSS smooth를 투어 동안만 끈다(우리 rAF가 부드러움을 담당).
      const html = document.documentElement;
      const prevSB = html.style.scrollBehavior;
      html.style.scrollBehavior = 'auto';
      restoreSB = () => {
        html.style.scrollBehavior = prevSB;
      };
      abortEvents.forEach((e) => window.addEventListener(e, onAbort, { passive: true }));
      let i = 0;
      const goNext = () => {
        if (i >= stops.length) {
          endTour();
          return;
        }
        const targetY = stops[i++];
        const dur = Math.min(
          SEG_MAX,
          Math.max(SEG_MIN, Math.abs(targetY - window.scrollY) * SEG_PER_PX),
        );
        animateTo(targetY, dur, () => {
          if (i >= stops.length) {
            endTour(); // 마지막(CTA) 도착 — 정리하고 그대로 머문다
            return;
          }
          pauseTimer = window.setTimeout(goNext, PAUSE_MS); // 이 섹션에서 잠깐 멈춘 뒤 다음
        });
      };
      goNext();
    };

    // 대기 단계: 아래 조작 중 하나라도 발생하면 투어를 걸지 않는다(직접 스크롤 포함).
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
        runTour();
      }, IDLE_DELAY_MS);
    }

    return () => {
      if (progRaf) cancelAnimationFrame(progRaf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      disarm();
      endTour();
    };
  }, []);

  return ref;
}
