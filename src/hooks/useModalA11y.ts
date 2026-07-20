import { useEffect, useRef } from 'react';

/**
 * 모달 접근성 훅 — ESC 닫기 + 포커스 트랩 + 열릴 때 포커스 이동 + 닫을 때 포커스 복원.
 *
 * 왜(팀 학습용): 기존 ops 모달은 오버레이 클릭으로만 닫혔고 키보드 사용자가 갇혔다(ESC 없음,
 * Tab이 모달 밖으로 샘). SaaS 접근성 기준(WAI-ARIA dialog)을 맞추려면 (1) ESC로 닫히고
 * (2) Tab이 모달 안에서 순환하며 (3) 열리면 모달로 포커스가 가고 닫히면 원래 위치로 돌아가야
 * 한다. 소비자는 반환된 ref를 모달 컨테이너에 달고 role="dialog" aria-modal="true"와
 * tabIndex={-1}을 함께 지정한다.
 *
 * onClose는 매 렌더 새 함수여도 되게 ref에 담아 effect는 마운트 시 1회만 리스너를 건다.
 */
export function useModalA11y<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const node = ref.current;
    const prevFocus = document.activeElement as HTMLElement | null;
    // 열릴 때 모달로 포커스(스크린리더가 모달 안을 읽기 시작하게)
    node?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key === 'Tab' && node) {
        const focusables = Array.from(
          node.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => el.offsetParent !== null); // 화면에 보이는 것만
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === node)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prevFocus?.focus?.(); // 닫을 때 포커스 복원(예: 눌렀던 버튼으로)
    };
  }, []);

  return ref;
}
