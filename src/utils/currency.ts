/** 추정 비용 표시용 환율(고정) — LLM 제공사 청구는 달러 기준이라, 여기 원화값은 '대략의
 *  원화 감'을 주는 운영 참고치다(실시간 환율·실제 청구액 아님). 환율이 크게 바뀌면 이 상수만
 *  조정하면 전 화면(모니터링 LLM 패널·LLM 모델 추정 비용)에 반영된다. */
export const KRW_PER_USD = 1380;

/** 달러(추정) → 원화 표시 문자열. 예: 49.8 → "₩68,724" */
export const fmtKrw = (usd: number): string =>
  `₩${Math.round((usd || 0) * KRW_PER_USD).toLocaleString('ko-KR')}`;
