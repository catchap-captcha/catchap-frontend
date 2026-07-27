/**
 * 사용자별 프로필 아바타 색 — 계정 식별자(id 우선, 없으면 이름)를 해시해 단색 팔레트에서
 * 고정 배정한다. 같은 사용자는 항상 같은 색(가입 시 색이 랜덤 지정되는 것과 동치이되,
 * DB 저장 없이 결정적으로 재현). 상단 nav 아바타와 프로필 상세(설정) 아바타가 모두 이
 * 함수를 써서 색이 일치한다. 흰색 이니셜이 읽히도록 중간 톤 단색만 쓴다.
 */
// 리뉴얼(2026-07-27): 앱 전체 모노크롬 톤에 맞춰 아바타를 짙은 회색 계열로 통일한다.
// (종전 컬러 팔레트 → 다크 뉴트럴만. 흰색 이니셜이 또렷이 읽히는 명도로 유지.)
const PALETTE = [
  '#3f3f46',
  '#3a3a3c',
  '#44444b',
  '#38383d',
  '#41414a',
  '#333338',
  '#4a4a52',
  '#2e2e33',
];

export function profileColor(seed: string | null | undefined): string {
  const s = (seed ?? '').trim() || 'catchap';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
