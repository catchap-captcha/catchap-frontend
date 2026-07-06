import { useEffect, type RefObject } from 'react';

/**
 * 주어진 컨테이너 안의 `.cc-reveal` / `.cc-reveal-group` 요소를 관찰해,
 * 뷰포트에 들어오면 `.cc-reveal--in`을 붙여 진입 애니메이션을 재생한다.
 * - prefers-reduced-motion 또는 IntersectionObserver 미지원 시 즉시 전부 표시(안전).
 * - 한 번 나타난 요소는 관찰 해제(재생 1회).
 */
export function useRevealOnScroll(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const els = Array.from(
      root.querySelectorAll<HTMLElement>('.cc-reveal, .cc-reveal-group'),
    );
    if (els.length === 0) return;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !('IntersectionObserver' in window)) {
      els.forEach((e) => e.classList.add('cc-reveal--in'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('cc-reveal--in');
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -5% 0px' },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [rootRef]);
}
