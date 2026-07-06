/**
 * API 호출 공통 헬퍼.
 *
 * 프로젝트 전반의 패턴: "API 성공 시 값 갱신, 실패 시 원본(FALLBACK) 유지".
 * 각 페이지에 흩어진 `.then(...).catch(() => {})` 보일러플레이트를 줄이기 위한 유틸.
 *
 * 사용 예:
 *   const data = await loadOr(FALLBACK, () => studentApi.dashboard());
 *   // 실패하면 FALLBACK 그대로 반환 (화면이 안 깨진다)
 */

/** promise가 실패하면 fallback을 반환한다 (throw하지 않음). */
export async function loadOr<T>(fallback: T, fn: () => Promise<T>): Promise<T> {
  try {
    const res = await fn();
    return res ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * API 응답(부분 객체)을 기존 상태 위에 얕게 병합한다.
 * null/undefined 필드는 건너뛰어 원본 값을 보존한다.
 */
export function mergeDefined<T extends object>(base: T, patch: Partial<T> | null | undefined): T {
  if (!patch || typeof patch !== 'object') return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== null && v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}
