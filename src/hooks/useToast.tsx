import { useCallback, useRef, useState } from 'react';

/**
 * handoff 공통 토스트 패턴(flash: 2.2초 표시)을 재현하는 훅.
 * 화면별 토스트 스타일은 각 페이지 CSS가 정의한다(디자인 유지).
 */
export function useToast(durationMs = 2200) {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const flash = useCallback(
    (message: string) => {
      if (timer.current) window.clearTimeout(timer.current);
      setToast(message);
      timer.current = window.setTimeout(() => setToast(null), durationMs);
    },
    [durationMs],
  );

  const clear = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    setToast(null);
  }, []);

  return { toast, flash, clear };
}
