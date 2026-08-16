/**
 * 캡차 상품(API 키의 product) — 사람이 읽는 이름·설명.
 *
 * ★한 곳에 모은 이유 — 0816 확인: 같은 상품을 화면마다 다르게 부르고 있었다.
 *   API 발급 화면 "교육형 API (행동데이터 수집)" · 행동 데이터 화면 "교육형 API"
 *   그리고 그 이름이 ★하는 일과도 안 맞았다. 행동데이터는 부산물이고,
 *   실제로 하는 일은 "교과 문항을 풀게 해서 사람인지 확인" 하는 것이다.
 *
 * ⚠️DB 에 저장되는 값(product)은 그대로 'captcha' | 'edu' 다. 표시 이름만 바꾼다.
 *
 * ★밖에 파는 라인은 접었다(0716 학습 강화 전환 · 0720 이수 검증형 포지셔닝).
 *   지금 이 두 가지는 ★우리 학생 화면이 쓰는 것이고, 같은 방식으로 다른 사이트에도
 *   붙일 수 있게 남겨 둔 것이다 — 화면 문구도 그렇게 읽히게 쓴다.
 */
export type CaptchaProduct = 'captcha' | 'edu';

export const CAPTCHA_PRODUCT_META: Record<
  CaptchaProduct,
  { label: string; icon: string; cls: string; blurb: string; detail: string }
> = {
  captcha: {
    label: '봇 차단 캡차',
    icon: 'ph-shield-check',
    cls: 'captcha',
    blurb: '그림을 끌어다 맞춰 사람인지 확인합니다',
    detail:
      '로그인·회원가입처럼 봇이 몰리는 자리에 씁니다. 사용자는 그림 조각을 제자리로 끌어다 놓고, ' +
      '맞으면 통과합니다. 통과·실패만 가려 주고 학습과는 상관이 없습니다.',
  },
  edu: {
    label: '학습 문제 캡차',
    icon: 'ph-graduation-cap',
    cls: 'edu',
    blurb: '교과 문항을 풀게 해서 사람인지 확인합니다',
    detail:
      '같은 봇 차단인데 문제가 교과 문항입니다(국어·수학·영어…). 기다리는 시간을 학습으로 바꾸려는 ' +
      '것이고, 푸는 동안 남는 반응·조작 기록은 봇 판정을 더 정확하게 만드는 데 씁니다. ' +
      '우리 학생 학습 화면과 강의 중간 확인 문항이 지금 이것으로 돌고 있습니다.',
  },
};

/** 목록·필터에서 쓸 짧은 이름. 모르는 값은 코드를 밝힌다(조용히 숨기지 않는다). */
export function captchaProductLabel(product: string | null | undefined): string {
  if (!product) return '—';
  return CAPTCHA_PRODUCT_META[product as CaptchaProduct]?.label ?? `미등록 (${product})`;
}
