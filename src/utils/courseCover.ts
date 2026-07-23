/**
 * courseCover — 코스마다 결정적(deterministic) 커버 아트를 만든다.
 *
 * 왜 만드나: 강의 썸네일 업로드 인프라(Object Storage)가 아직 없어 화면이 텍스트+아이콘
 * 카드뿐이라 "여백은 세련됐지만 비어 보이는" 문제가 있었다. profileColor가 계정마다 단색
 * 아바타를 정하듯, 코스 id/제목을 해시해 브랜드 계열 그라데이션 + 패턴 인덱스를 정하면
 * 이미지 없이도 모든 코스가 서로 다른, 통일된 톤의 커버를 갖는다(업로드 붙이면 대체 가능).
 *
 * 팔레트는 코랄(브랜드)을 중심으로 웜/뮤트 계열만 골라 라이트·다크 양쪽에서 튀지 않게 했다.
 */

export interface CoverArt {
  from: string;
  to: string;
  /** 배경 패턴 종류(0=도트, 1=대각선, 2=격자) */
  pattern: number;
  /** 각 코스의 대표 글자(과목/제목 첫 글자) */
  monogram: string;
}

// 브랜드 계열 그라데이션 쌍(진→연은 CSS에서 135deg). 코랄을 필두로 톤 통일.
const GRADIENTS: Array<[string, string]> = [
  ['#F0785C', '#C8412F'], // 코랄(브랜드)
  ['#E79A5B', '#B4622F'], // 테라코타
  ['#E3B24A', '#B9822A'], // 웜 골드
  ['#5FA98E', '#2F7C63'], // 세이지 틸
  ['#6C86D9', '#41539E'], // 더스티 블루
  ['#A97BC4', '#7B4E96'], // 플럼
  ['#DA7B93', '#A9506A'], // 클레이 로즈
  ['#7C8698', '#4E5666'], // 슬레이트
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
