import type { CSSProperties } from 'react';

/**
 * CatMark — CatChap(캣챱)의 브랜드 시각 서명.
 *
 * 왜 만드나: 기존 UI는 "깔끔하지만 어디서 본 듯한" 범용 디자인킷 룩이었다(개성 옅음).
 * 이름(캣챱=cat)과 연결된 절제된 라인아트 고양이 심볼 하나를 서명으로 삼아 로고 워터마크·
 * 빈 상태·수료증·코스 커버에 일관 적용하면, 마스코트 없이도 이 서비스만의 각인이 생긴다.
 * 성인 인강 톤을 지키려 유치한 만화체가 아니라 단일 굵기 스트로크의 기하적 실루엣으로 그린다.
 *
 * currentColor를 쓰므로 색은 부모의 color(=토큰)를 따라간다 → 라이트/다크 자동 대응.
 * variant: line=윤곽선(기본)·solid=채운 실루엣·ghost=아주 흐린 워터마크용.
 */
export type CatMarkVariant = 'line' | 'solid' | 'ghost';

interface CatMarkProps {
  size?: number;
  variant?: CatMarkVariant;
  /** 수염 표시 여부(작은 크기에선 생략하면 깔끔) */
  whiskers?: boolean;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

// 고양이 머리 실루엣(두 귀 + 둥근 얼굴·턱) — 40×40 기준 단일 닫힌 경로
const HEAD =
  'M9 5 L15 12 L20 11 L25 12 L31 5 L30 15 C33 26 27 34 20 34 C13 34 7 26 10 15 Z';

export default function CatMark({
  size = 40,
  variant = 'line',
  whiskers = true,
  strokeWidth = 2,
  className,
  style,
  title,
}: CatMarkProps) {
  const solid = variant === 'solid';
  const ghost = variant === 'ghost';
  // ghost는 채운 실루엣을 낮은 불투명도로(워터마크). line은 윤곽선만.
  const fill = solid || ghost ? 'currentColor' : 'none';
  const stroke = solid || ghost ? 'none' : 'currentColor';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={className}
      style={{ opacity: ghost ? 0.1 : undefined, ...style }}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      fill="none"
    >
      <path
        d={HEAD}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* 눈 — 실루엣(solid/ghost)에선 배경색으로 파낸 것처럼 두지 않고, line일 때만 또렷한 점 */}
      {!solid && !ghost && (
        <>
          <circle cx="16" cy="21" r="1.6" fill="currentColor" />
          <circle cx="24" cy="21" r="1.6" fill="currentColor" />
          {/* 코 */}
          <path
            d="M18.6 25 L21.4 25 L20 26.8 Z"
            fill="currentColor"
            stroke="none"
          />
        </>
      )}
      {whiskers && !ghost && (
        <g stroke="currentColor" strokeWidth={strokeWidth * 0.8} strokeLinecap="round">
          <path d="M13 24 L5 22.5" />
          <path d="M13 26 L5.5 27" />
          <path d="M27 24 L35 22.5" />
          <path d="M27 26 L34.5 27" />
        </g>
      )}
    </svg>
  );
}
