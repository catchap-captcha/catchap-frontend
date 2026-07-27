/**
 * courseCover — 코스마다 결정적(deterministic) 커버 아트를 만든다.
 *
 * 왜 만드나: 강의 썸네일 업로드 인프라(Object Storage)가 아직 없어 화면이 텍스트+아이콘
 * 카드뿐이라 "여백은 세련됐지만 비어 보이는" 문제가 있었다. profileColor가 계정마다 단색
 * 아바타를 정하듯, 코스 id/제목을 해시해 브랜드 계열 그라데이션 + 패턴 인덱스를 정하면
 * 이미지 없이도 모든 코스가 서로 다른, 통일된 톤의 커버를 갖는다(업로드 붙이면 대체 가능).
 *
 * 팔레트(2026-07-23 애플 랩 정렬): 복제본(디자인 랩)의 비비드 메시 그라데이션 톤에 맞춰
 * 인디고·퍼플·틸·블루·핑크 계열의 선명한 쌍으로 교체했다(종전 웜 코랄 계열 → 랩 우선).
 */

export interface CoverArt {
  from: string;
  to: string;
  /** 배경 패턴 종류(0=도트, 1=대각선, 2=격자) */
  pattern: number;
  /** 각 코스의 대표 글자(과목/제목 첫 글자) */
  monogram: string;
}

// 모노크롬 다크 그라데이션 쌍(135deg) — 리뉴얼(2026-07-27): 종전 비비드 컬러(인디고·퍼플·
// 블루 등)를 걷어내고 앱 전체 모노크롬 톤에 맞춰 차콜~near-black 계열로 통일. 코스마다
// 미세한 명도 차이만 두어 결정적 구분은 유지하되, 썸네일은 모두 블랙 계열로 보인다.
const GRADIENTS: Array<[string, string]> = [
  ['#3a3a3c', '#161618'], // 차콜→near-black
  ['#2c2c2e', '#0d0d0f'],
  ['#343438', '#101012'],
  ['#26262a', '#080809'],
  ['#3a3a40', '#18181b'],
  ['#2a2a2a', '#0a0a0a'],
  ['#38383c', '#141416'],
  ['#242427', '#000000'],
];

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 제목/과목에서 대표 글자 한 자 뽑기(공백·기호 건너뜀). 없으면 'C'. */
function pickMonogram(label: string): string {
  const ch = (label ?? '').trim().replace(/[\s"'“”「」·.,()[\]{}-]/g, '');
  return ch ? ch[0] : 'C';
}

export function courseCover(seed: string, label = ''): CoverArt {
  const h = hash(seed || label || 'catchap');
  const [from, to] = GRADIENTS[h % GRADIENTS.length];
  return {
    from,
    to,
    pattern: (h >> 3) % 3,
    monogram: pickMonogram(label || seed),
  };
}
