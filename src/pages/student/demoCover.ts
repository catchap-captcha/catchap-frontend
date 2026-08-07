/**
 * 데모 코스 커버를 코드로 생성한다(검정 배경 · 라인아트 · Welcome to X + 한글 제목).
 * 기존 JPG 커버가 "다 같은 위치/데모 느낌"이라, 코스마다 모티프·강조색·구도를 결정적으로 달리해
 * 다양성을 준다. 결과는 data:image/svg+xml URL이라 <img src>로 그대로 쓰인다(백엔드 불필요).
 * 주의: <img>로 들어가면 페이지 웹폰트(Pretendard)를 못 쓰므로 한글은 OS 폰트로 폴백된다.
 */

import { INTEREST_GROUPS } from '../../components/student/interestTaxonomy';

// FNV-1a 32bit — 코스별 결정적 시드.
function h32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32 — 시드에서 재현 가능한 난수열.
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PAL = ['#8b8cf0', '#a98bf0', '#7aa8f0', '#6fd0c8', '#7fd39a', '#e6c07a', '#e69ab0', '#9fb3c8', '#c58bf0', '#6fb6f0'];

function defs(a: string): string {
  return (
    '<defs>' +
    "<filter id='g' x='-60%' y='-60%' width='220%' height='220%'><feGaussianBlur stdDeviation='3' result='b'/><feMerge><feMergeNode in='b'/><feMergeNode in='SourceGraphic'/></feMerge></filter>" +
    "<radialGradient id='rg' cx='50%' cy='50%' r='50%'><stop offset='0' stop-color='" +
    a +
    "' stop-opacity='0.20'/><stop offset='1' stop-color='" +
    a +
    "' stop-opacity='0'/></radialGradient>" +
    '</defs>'
  );
}

type Motif = (cx: number, cy: number, R: number, a: string, r: () => number) => string;

const atom: Motif = (cx, cy, R, a) => {
  let e = '';
  [0, 60, 120].forEach((d) => {
    e += "<ellipse cx='" + cx + "' cy='" + cy + "' rx='" + R + "' ry='" + (R * 0.4).toFixed(1) + "' transform='rotate(" + d + ' ' + cx + ' ' + cy + ")'/>";
  });
  return (
    "<g fill='none' stroke='" + a + "' stroke-width='1.5' opacity='0.92' filter='url(#g)'>" + e + '</g>' +
    "<circle cx='" + cx + "' cy='" + cy + "' r='" + (R * 0.11).toFixed(1) + "' fill='#fff' filter='url(#g)'/>"
  );
};

const curve: Motif = (cx, cy, R, a) => {
  let g = '';
  for (let i = -2; i <= 2; i += 1) {
    g += "<line x1='" + (cx + i * R * 0.5) + "' y1='" + (cy - R) + "' x2='" + (cx + i * R * 0.5) + "' y2='" + (cy + R) + "'/>";
    g += "<line x1='" + (cx - R) + "' y1='" + (cy + i * R * 0.5) + "' x2='" + (cx + R) + "' y2='" + (cy + i * R * 0.5) + "'/>";
  }
  const x0 = cx - R;
  const y0 = cy + R * 0.45;
  const x1 = cx + R;
  const y1 = cy + R * 0.15;
  const qx = cx;
  const qy = cy - R * 0.9;
  let dots = '';
  for (let t = 0; t <= 1.0001; t += 0.25) {
    const mx = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * qx + t * t * x1;
    const my = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * qy + t * t * y1;
    dots += "<circle cx='" + mx.toFixed(1) + "' cy='" + my.toFixed(1) + "' r='3.4' fill='#fff'/>";
  }
  return (
    "<g stroke='" + a + "' stroke-width='0.8' opacity='0.14'>" + g + '</g>' +
    "<path d='M" + x0 + ' ' + y0 + ' Q' + qx + ' ' + qy + ' ' + x1 + ' ' + y1 + "' fill='none' stroke='#fff' stroke-width='1.8' filter='url(#g)'/>" +
    "<g filter='url(#g)'>" + dots + '</g>'
  );
};

const waves: Motif = (cx, cy, R, a, r) => {
  let p = '';
  for (let k = 0; k < 3; k += 1) {
    const yy = cy - R * 0.5 + k * R * 0.5;
    const ph = r() * 6;
    let d = 'M' + (cx - R) + ' ' + yy;
    for (let x = -R; x <= R; x += 8) {
      const y = yy + Math.sin((x / R) * 3.14159 + ph) * R * 0.22;
      d += ' L' + (cx + x).toFixed(1) + ' ' + y.toFixed(1);
    }
    p += "<path d='" + d + "' fill='none' stroke='" + a + "' stroke-width='" + (1.8 - k * 0.4) + "' opacity='" + (0.9 - k * 0.22) + "'/>";
  }
  return "<g filter='url(#g)'>" + p + '</g>';
};

const orbits: Motif = (cx, cy, R, a, r) => {
  let c = '';
  [1, 0.68, 0.4].forEach((f) => {
    c += "<circle cx='" + cx + "' cy='" + cy + "' r='" + (R * f).toFixed(1) + "'/>";
  });
  let d = '';
  const fs = [1, 0.68, 0.4];
  for (let i = 0; i < 3; i += 1) {
    const ang = r() * 6.28;
    const f = fs[i];
    d += "<circle cx='" + (cx + Math.cos(ang) * R * f).toFixed(1) + "' cy='" + (cy + Math.sin(ang) * R * f).toFixed(1) + "' r='4' fill='#fff'/>";
  }
  return (
    "<g fill='none' stroke='" + a + "' stroke-width='1.5' opacity='0.9' filter='url(#g)'>" + c + '</g>' +
    "<circle cx='" + cx + "' cy='" + cy + "' r='" + (R * 0.1).toFixed(1) + "' fill='#fff' filter='url(#g)'/>" +
    "<g filter='url(#g)'>" + d + '</g>'
  );
};

const bars: Motif = (cx, cy, R, a, r) => {
  let b = '';
  const n = 5;
  const w = R * 0.24;
  const x0 = cx - R * 0.82;
  const base = cy + R * 0.8;
  for (let i = 0; i < n; i += 1) {
    const hh = R * (0.35 + 0.16 * i + r() * 0.12);
    const x = x0 + i * (w + R * 0.12);
    b += "<rect x='" + x.toFixed(1) + "' y='" + (base - hh).toFixed(1) + "' width='" + w.toFixed(1) + "' height='" + hh.toFixed(1) + "' rx='4' fill='" + a + "' opacity='" + (0.55 + i * 0.09) + "'/>";
  }
  return "<g filter='url(#g)'><line x1='" + (x0 - 8) + "' y1='" + base + "' x2='" + (cx + R * 0.9) + "' y2='" + base + "' stroke='" + a + "' stroke-width='1' opacity='0.35'/>" + b + '</g>';
};

const network: Motif = (cx, cy, R, a, r) => {
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i += 1) {
    const ang = (i / 6) * 6.28 + r() * 0.5;
    const rad = R * (0.5 + r() * 0.5);
    pts.push([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad]);
  }
  let ln = '';
  for (let i = 0; i < pts.length; i += 1) {
    for (let j = i + 1; j < pts.length; j += 1) {
      const dx = pts[i][0] - pts[j][0];
      const dy = pts[i][1] - pts[j][1];
      if (Math.sqrt(dx * dx + dy * dy) < R * 1.05) {
        ln += "<line x1='" + pts[i][0].toFixed(1) + "' y1='" + pts[i][1].toFixed(1) + "' x2='" + pts[j][0].toFixed(1) + "' y2='" + pts[j][1].toFixed(1) + "'/>";
      }
    }
  }
  let nd = '';
  pts.forEach((p) => {
    nd += "<circle cx='" + p[0].toFixed(1) + "' cy='" + p[1].toFixed(1) + "' r='4.5' fill='#fff'/>";
  });
  return "<g stroke='" + a + "' stroke-width='1.3' opacity='0.75' filter='url(#g)'>" + ln + "</g><g filter='url(#g)'>" + nd + '</g>';
};

const circuit: Motif = (cx, cy, R, a, r) => {
  let g = '';
  for (let k = 0; k < 3; k += 1) {
    const x = cx - R + r() * R * 0.4;
    const y = cy - R * 0.6 + k * R * 0.6;
    const len = R * (0.8 + r() * 0.7);
    g += "<path d='M" + x.toFixed(1) + ' ' + y.toFixed(1) + ' h' + (len * 0.5).toFixed(1) + ' v' + ((r() < 0.5 ? -1 : 1) * R * 0.4).toFixed(1) + ' h' + (len * 0.5).toFixed(1) + "' fill='none'/>";
    g += "<circle cx='" + (x + len).toFixed(1) + "' cy='" + y.toFixed(1) + "' r='3.5' fill='" + a + "'/>";
  }
  return "<g stroke='" + a + "' stroke-width='1.6' opacity='0.9' filter='url(#g)' stroke-linejoin='round' stroke-linecap='round'>" + g + '</g>';
};

const hexmol: Motif = (cx, cy, R, a) => {
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i += 1) {
    const ang = (i / 6) * 6.28 - 1.57;
    pts.push([cx + Math.cos(ang) * R * 0.72, cy + Math.sin(ang) * R * 0.72]);
  }
  let b = '';
  for (let i = 0; i < 6; i += 1) {
    const n = pts[(i + 1) % 6];
    b += "<line x1='" + pts[i][0].toFixed(1) + "' y1='" + pts[i][1].toFixed(1) + "' x2='" + n[0].toFixed(1) + "' y2='" + n[1].toFixed(1) + "'/>";
    b += "<line x1='" + pts[i][0].toFixed(1) + "' y1='" + pts[i][1].toFixed(1) + "' x2='" + cx + "' y2='" + cy + "'/>";
  }
  let at = '';
  pts.forEach((p) => {
    at += "<circle cx='" + p[0].toFixed(1) + "' cy='" + p[1].toFixed(1) + "' r='4' fill='#fff'/>";
  });
  return (
    "<g stroke='" + a + "' stroke-width='1.4' opacity='0.85' filter='url(#g)'>" + b + '</g>' +
    "<g filter='url(#g)'>" + at + "<circle cx='" + cx + "' cy='" + cy + "' r='4.5' fill='" + a + "'/></g>"
  );
};

const constellation: Motif = (cx, cy, R, a, r) => {
  const pts: [number, number][] = [];
  for (let i = 0; i < 7; i += 1) pts.push([cx - R + r() * 2 * R, cy - R + r() * 2 * R]);
  let ln = '';
  for (let i = 0; i < 5; i += 1) ln += "<line x1='" + pts[i][0].toFixed(1) + "' y1='" + pts[i][1].toFixed(1) + "' x2='" + pts[i + 1][0].toFixed(1) + "' y2='" + pts[i + 1][1].toFixed(1) + "'/>";
  let st = '';
  pts.forEach((p, i) => {
    st += "<circle cx='" + p[0].toFixed(1) + "' cy='" + p[1].toFixed(1) + "' r='" + (i % 2 ? 2 : 3.8) + "' fill='#fff'/>";
  });
  let dust = '';
  for (let i = 0; i < 14; i += 1) dust += "<circle cx='" + (cx - R + r() * 2 * R).toFixed(1) + "' cy='" + (cy - R + r() * 2 * R).toFixed(1) + "' r='1' fill='" + a + "' opacity='0.5'/>";
  return dust + "<g stroke='" + a + "' stroke-width='1.2' opacity='0.7' filter='url(#g)'>" + ln + "</g><g filter='url(#g)'>" + st + '</g>';
};

const spiral: Motif = (cx, cy, R, a) => {
  let d = 'M' + cx + ' ' + cy;
  for (let t = 0; t < 6.28 * 2.5; t += 0.2) {
    const rad = R * 0.06 * t;
    const x = cx + Math.cos(t) * rad;
    const y = cy + Math.sin(t) * rad;
    d += ' L' + x.toFixed(1) + ' ' + y.toFixed(1);
  }
  return "<path d='" + d + "' fill='none' stroke='" + a + "' stroke-width='1.6' opacity='0.9' filter='url(#g)'/><circle cx='" + cx + "' cy='" + cy + "' r='3.5' fill='#fff' filter='url(#g)'/>";
};

const contour: Motif = (cx, cy, R, a, r) => {
  let g = '';
  for (let i = 4; i >= 1; i -= 1) {
    const rr = (R * i) / 4;
    const rx = rr * (0.9 + r() * 0.25);
    const ry = rr * (0.7 + r() * 0.2);
    g += "<ellipse cx='" + cx + "' cy='" + cy + "' rx='" + rx.toFixed(1) + "' ry='" + ry.toFixed(1) + "' transform='rotate(" + (r() * 40 - 20).toFixed(1) + ' ' + cx + ' ' + cy + ")'/>";
  }
  return "<g fill='none' stroke='" + a + "' stroke-width='1.4' opacity='0.8' filter='url(#g)'>" + g + '</g>';
};

const ribbon: Motif = (cx, cy, R, a) => {
  const y = cy;
  const d =
    'M' + (cx - R) + ' ' + y + ' C' + (cx - R * 0.4) + ' ' + (y - R * 0.8) + ' ' + (cx + R * 0.4) + ' ' + (y + R * 0.8) + ' ' + (cx + R) + ' ' + y +
    ' L' + (cx + R) + ' ' + (y + R * 0.28) + ' C' + (cx + R * 0.4) + ' ' + (y + R * 1.08) + ' ' + (cx - R * 0.4) + ' ' + (y - R * 0.52) + ' ' + (cx - R) + ' ' + (y + R * 0.28) + ' Z';
  return (
    "<path d='" + d + "' fill='" + a + "' opacity='0.20'/>" +
    "<path d='M" + (cx - R) + ' ' + y + ' C' + (cx - R * 0.4) + ' ' + (y - R * 0.8) + ' ' + (cx + R * 0.4) + ' ' + (y + R * 0.8) + ' ' + (cx + R) + ' ' + y + "' fill='none' stroke='" + a + "' stroke-width='1.8' opacity='0.9' filter='url(#g)'/>"
  );
};

const MOTIF: Record<string, Motif> = { atom, curve, waves, orbits, bars, network, circuit, hex: hexmol, constellation, spiral, contour, ribbon };

const FIELD_MOTIFS: Record<string, string[]> = {
  math: ['curve', 'network', 'spiral'],
  safety: ['orbits', 'hex', 'waves'],
  lang: ['waves', 'constellation', 'ribbon'],
  general: ['bars', 'orbits', 'network'],
  it: ['atom', 'circuit', 'network'],
  design: ['ribbon', 'contour', 'spiral'],
  biz: ['bars', 'network', 'orbits'],
  cert: ['hex', 'orbits', 'constellation'],
  life: ['contour', 'ribbon', 'waves'],
};

const ENG: Record<string, string> = {
  math: 'Mathematics',
  safety: 'Safety',
  lang: 'Language',
  general: 'Self-Development',
  it: 'Programming',
  design: 'Design',
  biz: 'Business',
  cert: 'Certification',
  life: 'Lifestyle',
};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 제목 폭 추정(폰트를 못 재니 글자폭 근사) — 한글 ≈ 0.98em, 공백 ≈ 0.3em, 그 외(숫자·영문) ≈ 0.56em.
function charW(ch: string, fs: number): number {
  const c = ch.charCodeAt(0);
  if (ch === ' ') return fs * 0.3;
  if ((c >= 0xac00 && c <= 0xd7a3) || (c >= 0x3130 && c <= 0x318f)) return fs * 0.98;
  return fs * 0.56;
}
function lineW(s: string, fs: number): number {
  let w = 0;
  for (const ch of s) w += charW(ch, fs);
  return w;
}
// 코스별로 원하는 줄바꿈 지점이 명확해, 폭 추정에 맡기지 않고 제목→줄 배열을 직접 지정한다.
// 여기 없는 제목은 아래 기본 규칙(넘칠 때 '마지막 공백'에서 접미어를 둘째 줄로)을 따른다.
const TITLE_LINES: Record<string, string[]> = {
  '확률과 통계 입문': ['확률과 통계', '입문'],
  '산업안전기사 대비': ['산업안전기사', '대비'],
  '응급처치·CPR 실습': ['응급처치·CPR', '실습'],
  '엑셀 실무 완성': ['엑셀 실무', '완성'],
  '경제·재테크 입문': ['경제·재테크', '입문'],
  '데이터 분석 with 판다스': ['데이터 분석', 'with 판다스'],
  '한국사능력검정 심화': ['한국사능력검정', '심화'],
  '컴활 1급 실기': ['컴활 1급', '실기'],
  '정보처리기사 필기': ['정보처리기사', '필기'],
  '기초 영어 회화': ['기초 영어 회화'], // 한 줄 고정
  'AWS 입문하기': ['AWS', '입문하기'],
};

// 기본 줄바꿈 — 마지막 공백에서 접미어(대비·입문·실기 등)를 둘째 줄로 내린다. 공백 없으면 한 줄.
function wrapLastSpace(s: string): string[] {
  const i = s.lastIndexOf(' ');
  return i < 0 ? [s] : [s.slice(0, i), s.slice(i + 1)];
}

// 제목 → 줄 배열 + 폰트 크기. 지정 제목은 그대로, 나머지는 폭이 넘칠 때만 마지막 공백에서 나눈다.
function titleLayout(title: string, budget: number): { lines: string[]; tsize: number } {
  let lines: string[];
  if (TITLE_LINES[title]) lines = TITLE_LINES[title];
  else if (lineW(title, 46) > budget) lines = wrapLastSpace(title);
  else lines = [title];
  if (lines.length < 2) return { lines, tsize: 46 };
  let tsize = 40;
  while (tsize > 28 && Math.max(lineW(lines[0], tsize), lineW(lines[1] ?? '', tsize)) > budget) tsize -= 2;
  return { lines, tsize };
}

// 실제 SVG 커버 문자열을 만든다(데모·실제 코스 공용). seed로 색·구도, field로 모티프군·영문 라벨.
function buildCover(seed: number, field: string, motifName: string, title: string): string {
  const r = rng(seed);
  const a = PAL[seed % PAL.length];
  const comp = ['R', 'L', 'C'][(seed >> 3) % 3];
  const W = 800;
  const H = 450;
  let gcx: number;
  let gcy = 225;
  let gR = 150;
  let tx: number;
  let tAnchor: string;
  let glowc: [number, number];
  if (comp === 'R') {
    gcx = 548;
    tx = 64;
    tAnchor = 'start';
    glowc = [560, 215];
  } else if (comp === 'L') {
    gcx = 252;
    tx = 736;
    tAnchor = 'end';
    glowc = [240, 215];
  } else {
    gcx = 400;
    gcy = 210;
    gR = 205;
    tx = 64;
    tAnchor = 'start';
    glowc = [430, 190];
  }
  const art = (MOTIF[motifName] ?? orbits)(gcx, gcy, gR, a, r);
  const artWrap = comp === 'C' ? "<g opacity='0.42'>" + art + '</g>' : art;
  const eng = ENG[field] ?? field;
  // 구도별 제목 가용 폭 → 줄 배열/폰트 크기 결정(지정 제목 우선).
  const budget = comp === 'C' ? 660 : 330;
  const { lines, tsize } = titleLayout(title, budget);
  const titleY = comp === 'C' ? 348 : 248;
  const welcomeY = titleY - 60; // Welcome to X 라벨과 제목 사이 여백(가까워 보이지 않게 넉넉히)
  const tspans = lines
    .map((l, i) => "<text x='" + tx + "' y='" + (titleY + i * tsize * 1.06) + "' text-anchor='" + tAnchor + "' fill='#fff' font-size='" + tsize + "' font-weight='800' font-family=\"'Pretendard','Malgun Gothic','Apple SD Gothic Neo',sans-serif\">" + esc(l) + '</text>')
    .join('');
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 " + W + ' ' + H + "' width='" + W + "' height='" + H + "'>" +
    defs(a) +
    "<rect width='" + W + "' height='" + H + "' fill='#0a0a0b'/>" +
    "<ellipse cx='" + glowc[0] + "' cy='" + glowc[1] + "' rx='330' ry='300' fill='url(#rg)'/>" +
    artWrap +
    "<text x='" + tx + "' y='" + welcomeY + "' text-anchor='" + tAnchor + "' fill='#9a9ba1' font-size='19' letter-spacing='1.5' font-family=\"'Pretendard','Malgun Gothic',sans-serif\">Welcome to " + esc(eng) + '</text>' +
    tspans +
    '</svg>';
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

/** 데모 코스 커버. field=분야 key, ci=분야 내 코스 index, title=한글 제목. (기존 외형 그대로 유지) */
export function demoCoverUrl(field: string, ci: number, title: string): string {
  const seed = h32(field + '-' + ci);
  const motifs = FIELD_MOTIFS[field] ?? ['orbits', 'network', 'waves'];
  return buildCover(seed, field, motifs[ci % motifs.length], title);
}

// 실제 코스 분류/제목 → 분야 key. 택소노미 라벨·subject 정확 일치 → 키워드 포함 → 시드 폴백 순.
// (키워드는 라벨/subject/제목을 소문자로 합쳐서 검색 — 'AWS 입문하기'처럼 제목만 힌트인 경우 대비.)
const CAT_KEYWORDS: [string, string][] = [
  ['프로그래', 'it'], ['개발', 'it'], ['코딩', 'it'], ['파이썬', 'it'], ['자바', 'it'], ['클라우드', 'it'], ['aws', 'it'], ['데이터', 'it'],
  ['디자인', 'design'], ['크리에이', 'design'], ['포토샵', 'design'], ['일러스트', 'design'],
  ['어학', 'lang'], ['외국어', 'lang'], ['영어', 'lang'], ['토익', 'lang'], ['일본어', 'lang'], ['중국어', 'lang'],
  ['수학', 'math'], ['수리', 'math'],
  ['안전', 'safety'], ['소방', 'safety'], ['응급', 'safety'],
  ['자격증', 'cert'], ['시험', 'cert'], ['공무원', 'cert'], ['컴활', 'cert'],
  ['마케팅', 'biz'], ['비즈니스', 'biz'], ['직무', 'biz'], ['회계', 'biz'], ['창업', 'biz'],
  ['취미', 'life'], ['라이프', 'life'], ['드로잉', 'life'], ['베이킹', 'life'],
  ['교양', 'general'], ['자기계발', 'general'], ['엑셀', 'general'], ['오피스', 'general'], ['일반', 'general'],
];
function resolveField(category: string | null | undefined, subject: string | null | undefined, title: string, seed: number): string {
  for (const g of INTEREST_GROUPS) {
    if (category && g.label === category) return g.key;
    if (subject && g.subject && g.subject === subject) return g.key;
  }
  const hay = ((category ?? '') + ' ' + (subject ?? '') + ' ' + title).toLowerCase();
  for (const [kw, key] of CAT_KEYWORDS) if (hay.indexOf(kw) >= 0) return key;
  const keys = INTEREST_GROUPS.map((g) => g.key);
  return keys[seed % keys.length];
}

/** 실제·데모 공용 — 코스 객체로 생성 커버(data:image/svg+xml URL). 업로드 썸네일이 없을 때 폴백으로 쓴다. */
export function courseCoverUrl(c: { id: string; title: string; category?: string | null; subject?: string | null }): string {
  const seed = h32(c.id);
  const field = resolveField(c.category, c.subject, c.title, seed);
  const motifs = FIELD_MOTIFS[field] ?? ['orbits', 'network', 'waves'];
  return buildCover(seed, field, motifs[seed % motifs.length], c.title);
}
