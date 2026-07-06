import { useEffect, useRef, useState } from 'react';

interface CountUpProps {
  /** 목표 값(숫자 또는 "1,234"·"98.5" 같은 숫자 문자열). 숫자로 파싱 안 되면 그대로 출력. */
  value: number | string;
  /** 애니메이션 길이(ms). 기본 900 */
  duration?: number;
}

function prefersReduced(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * KPI 숫자를 0 → 목표값으로 세어 올리는 표시.
 * - 숫자 부분만 애니메이션, 원본의 콤마/소수 자릿수 포맷을 그대로 유지(시각 결과 동일하게 끝남).
 * - prefers-reduced-motion이면 애니메이션 없이 최종값만 표시.
 * - 숫자로 파싱 불가한 값(예: "—", "N/A")은 원본을 그대로 렌더.
 */
export default function CountUp({ value, duration = 900 }: CountUpProps) {
  const raw = String(value);
  const num = parseFloat(raw.replace(/,/g, ''));
  const valid = Number.isFinite(num) && /\d/.test(raw);
  const decimals = raw.includes('.') ? (raw.split('.')[1].match(/^\d+/)?.[0].length ?? 0) : 0;
  const hasComma = raw.includes(',');

  const format = (n: number): string => {
    const fixed = n.toFixed(decimals);
    if (!hasComma) return fixed;
    return Number(fixed).toLocaleString('ko-KR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const [disp, setDisp] = useState<number>(valid && !prefersReduced() ? 0 : num);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!valid || prefersReduced()) {
      setDisp(num);
      return;
    }
    let startTs: number | null = null;
    const tick = (t: number) => {
      if (startTs === null) startTs = t;
      const p = Math.min((t - startTs) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setDisp(num * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [num, duration, valid]);

  if (!valid) return <>{value}</>;
  return <>{format(disp)}</>;
}
