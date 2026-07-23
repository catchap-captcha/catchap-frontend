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

// 비비드 메시 계열 그라데이션 쌍(135deg). 복제본(랩) apple.css의 .g-a~.g-f 톤 이식.
const GRADIENTS: Array<[string, string]> = [
  ['#5E5CE6', '#A24BFF'], // 인디고→퍼플 (g-a)
  ['#30B0C7', '#34C759'], // 틸→그린 (g-b)
  ['#0071E3', '#30B0C7'], // 블루→틸 (g-e)
  ['#FF375F', '#BF5AF2'], // 핑크→퍼플 (g-d)
  ['#7B6CFF', '#4B3FD6'], // 바이올렛→인디고
  ['#3A9BFF', '#1A6FE0'], // 스카이→블루
  ['#FF5A8A', '#C66BFF'], // 로즈→퍼플
  ['#FF9F0A', '#FF375F'], // 오렌지→핑크 (g-c, 이어보기 톤)
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
