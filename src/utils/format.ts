/* ── 시간대 규약 ──────────────────────────────────────────────
 * 서버는 모든 사용자 노출 시각을 KST 벽시계(naive, tz 접미사 없음)로 보낸다.
 * 프론트는 어디서 열리든(해외 브라우저 포함) 같은 KST로 보여야 하므로:
 *  - 파싱: parseServerDate() — naive 문자열에 +09:00을 붙여 절대시각 고정
 *  - 포맷: timeZone:'Asia/Seoul' 명시 (ko-KR은 언어일 뿐 시간대를 고정하지 않음)
 */
export const KST = 'Asia/Seoul';

/** 서버 시각 문자열 → Date. tz 접미사가 없으면 KST(+09:00)로 해석한다. */
export function parseServerDate(iso: string): Date {
  if (!iso) return new Date(NaN);
  // 이미 Z/±hh:mm 오프셋이 있으면 그대로, 없으면(KST naive) +09:00 부착
  const hasTz = /Z$|[+-]\d{2}:?\d{2}$/.test(iso);
  return new Date(hasTz ? iso : `${iso}+09:00`);
}

/** 오늘(KST) 'YYYY-MM-DD' — 파일명·날짜 경계용. toISOString(UTC) 금지. */
export function kstDateString(d: Date = new Date()): string {
  return d.toLocaleDateString('sv-SE', { timeZone: KST }); // sv-SE = YYYY-MM-DD
}

/** 상대 시간 표기 (알림 등) — 서버 KST naive 문자열 안전 */
export function timeAgo(iso: string): string {
  const t = parseServerDate(iso).getTime();
  if (!Number.isFinite(t)) return ''; // 깨진 날짜면 'NaN분 전'/'Invalid Date' 대신 빈 문자열
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return parseServerDate(iso).toLocaleDateString('ko-KR', { timeZone: KST });
}

export function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR');
}

export function pct(done: number, total: number): number {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}
