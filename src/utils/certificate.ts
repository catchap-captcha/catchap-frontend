/** 상장 PNG 생성 — 학년 랭킹·개근상. 어린이 친화 디자인, 다운로드용. */

import wordmarkUrl from '../assets/brand/catchap-wordmark.png';

export interface CertificateData {
  kind: 'rank' | 'attendance';
  name: string; // 닉네임 (학생 화면 — 실명 미사용)
  title: string; // 예: "1학년 랭킹 1위" / "개근상"
  detail: string; // 예: "2026년 1학기 · 30일 연속 학습"
  semester: string;
}

const W = 1400;
const H = 990;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawCertificate(d: CertificateData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const F = "'Pretendard', 'Malgun Gothic', sans-serif";
  const gold = d.kind === 'rank' ? '#F0A400' : '#17B08C';
  const soft = d.kind === 'rank' ? '#FFF3D6' : '#E1F5EC';

  // 바탕 + 이중 테두리 (상장 느낌)
  ctx.fillStyle = '#FFFDF7';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = gold;
  ctx.lineWidth = 10;
  roundRect(ctx, 34, 34, W - 68, H - 68, 26);
  ctx.stroke();
  ctx.lineWidth = 3;
  roundRect(ctx, 58, 58, W - 116, H - 116, 18);
  ctx.stroke();

  // 모서리 장식 (별)
  const star = (x: number, y: number, r: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const ang = (Math.PI / 5) * i - Math.PI / 2;
      const rad = i % 2 === 0 ? r : r * 0.45;
      ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
    }
    ctx.closePath();
    ctx.fillStyle = gold;
    ctx.fill();
    ctx.restore();
  };
  star(110, 110, 26);
  star(W - 110, 110, 26);
  star(110, H - 110, 26);
  star(W - 110, H - 110, 26);

  // 메달 리본
  ctx.fillStyle = soft;
  ctx.beginPath();
  ctx.arc(W / 2, 200, 78, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = gold;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.fillStyle = gold;
  ctx.font = `900 64px ${F}`;
  ctx.textAlign = 'center';
  ctx.fillText(d.kind === 'rank' ? '🏆' : '🌟', W / 2, 224);

  // 제목 "상 장"
  ctx.fillStyle = '#3A3226';
  ctx.font = `900 88px ${F}`;
  ctx.fillText('상   장', W / 2, 390);
  ctx.fillStyle = gold;
  ctx.font = `800 40px ${F}`;
  ctx.fillText(d.title, W / 2, 458);

  // 수상자
  ctx.fillStyle = '#3A3226';
  ctx.font = `900 56px ${F}`;
  ctx.fillText(`${d.name} 어린이`, W / 2, 560);

  // 본문
  ctx.fillStyle = '#6A6154';
  ctx.font = `600 32px ${F}`;
  ctx.fillText('위 어린이는 꾸준한 노력과 성실한 배움으로', W / 2, 640);
  ctx.fillText(d.detail, W / 2, 692);
  ctx.fillText('훌륭한 성과를 이루었기에 이 상장을 드립니다.', W / 2, 744);

  // 날짜 + 발급
  // 발급일은 KST 고정 (브라우저 시간대 무관)
  const [ty, tm, td] = new Date()
    .toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
    .split('-')
    .map(Number);
  ctx.fillStyle = '#8A8070';
  ctx.font = `700 30px ${F}`;
  ctx.fillText(`${ty}년 ${tm}월 ${td}일`, W / 2, 830);
  ctx.fillStyle = '#ea5443';
  ctx.font = `900 42px ${F}`;
  ctx.fillText('CatChap 캣챱', W / 2, 896);
  ctx.textAlign = 'left';

  return canvas;
}

/* ==========================================================================
 * 코스 수료증 — 핸드오프 `Catchap Certificate.dc.html`(landscape/letter) 이식
 * ========================================================================== */

/** 코스 수료증 데이터 — 서버(GET .../exam/certificate)가 수료 검증 후 내려준 값 그대로. */
export interface CourseCertificateData {
  studentName: string; // 가명(nickname)
  courseTitle: string;
  subject: string;
  // 강사명은 싣지 않는다(사용자 결정) — 수료증은 강사 개인이 아니라 CatChap 명의로 발급한다.
  // 서버(GET .../exam/certificate)는 instructor_name을 계속 내려주지만 여기서는 쓰지 않는다.
  passedAt: string; // ISO — 발급일이 아니라 수료일을 싣는다(불변)
  perfect: boolean;
  questionCount: number;
  serial: string; // 검증용 일련번호
}

// 레터 가로(11×8.5in) @150dpi — 핸드오프가 landscape/letter라 그 비율을 그대로 쓴다.
const CW = 1650;
const CH = 1275;
// 핸드오프는 96dpi(폭 1056px) 기준이라, 그 수치를 그대로 옮겨 쓰려고 스케일 상수를 둔다.
const S = CW / 1056;

const TEAL = '#0d7d73';
const INK = '#16202c';

// 핸드오프 폰트(EB Garamond·Space Grotesk·Noto Serif KR)는 이 앱에 번들돼 있지 않다.
// 웹폰트를 새로 불러오면 초기 로드가 무거워지므로(렌더블로킹 폰트 정리 이력) 시스템
// 대체 스택으로 같은 '분위기'만 맞춘다 — 라틴 표제는 산세리프, 본문 표제는 명조 계열.
const SERIF = "'Noto Serif KR', 'EB Garamond', Batang, 'Times New Roman', serif";
const SANS = "'Space Grotesk', Pretendard, 'Malgun Gothic', sans-serif";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`이미지를 불러오지 못했습니다: ${src}`));
    img.src = src;
  });
}

/** 자간이 있는 텍스트의 폭 — 현재 ctx.font 기준. */
function trackedWidth(ctx: CanvasRenderingContext2D, text: string, spacing: number): number {
  const chars = [...text];
  return (
    chars.reduce((w, c) => w + ctx.measureText(c).width, 0) + spacing * Math.max(0, chars.length - 1)
  );
}

/** 자간이 있는 텍스트 — ctx.letterSpacing은 브라우저 지원 편차가 있어 글자 단위로 그린다. */
function tracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
  align: 'left' | 'center' | 'right' = 'left',
): number {
  const width = trackedWidth(ctx, text, spacing);
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  let cx = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
  for (const c of [...text]) {
    ctx.fillText(c, cx, y);
    cx += ctx.measureText(c).width + spacing;
  }
  ctx.textAlign = prevAlign;
  return width;
}

/** maxWidth에 들어갈 때까지 글자 크기를 줄인다 — 코스명은 잘라내지 않는다(수료증의 핵심). */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  start: number,
  min: number,
  font: (size: number) => string,
): number {
  let size = start;
  ctx.font = font(size);
  while (size > min && ctx.measureText(text).width > maxWidth) {
    size -= 1;
    ctx.font = font(size);
  }
  return size;
}

/** 폭에 맞춰 줄바꿈 — 공백 단위로 먼저 채우고, 한 덩어리가 넘치면 글자 단위로 쪼갠다(한글 대응). */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  const flush = () => {
    if (line) lines.push(line);
    line = '';
  };
  for (const word of text.split(/(\s+)/)) {
    if (!word) continue;
    const next = line + word;
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
      continue;
    }
    flush();
    if (ctx.measureText(word).width <= maxWidth) {
      line = word.trimStart();
      continue;
    }
    // 공백 없는 긴 덩어리(한글 문장 등) — 글자 단위로 채운다
    for (const ch of word) {
      if (ctx.measureText(line + ch).width > maxWidth) flush();
      line += ch;
    }
  }
  flush();
  return lines;
}

/**
 * 코스 수료증 — 핸드오프 디자인(가로형, 청록 #0d7d73, 우측 배너 패널) 이식.
 *
 * 상단 로고는 서비스에서 실제로 쓰는 CATCHAP 워드마크 이미지를 그린다(사용자 요청 —
 * 예전 CatMark 고양이 마크는 쓰지 않는다). 이미지 로드가 필요해 async다.
 *
 * 한글 폰트 임베딩 문제를 피하려 캔버스로 그려 이미지로 PDF에 싣는다(pdf.ts canvasToPdf).
 * 값은 전부 서버가 수료를 검증한 뒤 내려준 것만 쓴다 — 클라이언트는 지어내지 않는다.
 */
export async function drawCourseCertificate(d: CourseCertificateData): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = CW;
  canvas.height = CH;
  const ctx = canvas.getContext('2d')!;
  const logo = await loadImage(wordmarkUrl).catch(() => null);

  // ---------- 바탕 · 이중 테두리 ----------
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, CW, CH);

  const pad = 26 * S;
  ctx.strokeStyle = '#c9d3d1';
  ctx.lineWidth = 1;
  ctx.strokeRect(pad, pad, CW - pad * 2, CH - pad * 2);

  const bx = pad + 6 * S;
  const by = pad + 6 * S;
  const bw = CW - bx * 2;
  const bh = CH - by * 2;
  ctx.strokeStyle = '#e4ebea';
  ctx.strokeRect(bx, by, bw, bh);

  // ---------- 우측 배너 패널 (clip-path 오각형) ----------
  const panelW = 300 * S;
  const px = bx + bw - panelW;
  const notch = by + bh * 0.82;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(px, by);
  ctx.lineTo(px + panelW, by);
  ctx.lineTo(px + panelW, notch);
  ctx.lineTo(px + panelW / 2, by + bh);
  ctx.lineTo(px, notch);
  ctx.closePath();
  ctx.clip();

  const grad = ctx.createLinearGradient(0, by, 0, by + bh);
  grad.addColorStop(0, '#f4f8f7');
  grad.addColorStop(1, '#e4ecea');
  ctx.fillStyle = grad;
  ctx.fillRect(px, by, panelW, bh);

  // 사선 해칭 + 동심원 — 핸드오프의 repeating/radial-gradient 질감을 옅게 재현
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = 'rgba(13,125,115,0.09)';
  ctx.lineWidth = 1;
  const step = 9 * S;
  for (let i = -bh; i < panelW + bh; i += step) {
    ctx.beginPath();
    ctx.moveTo(px + i, by);
    ctx.lineTo(px + i + bh, by + bh);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px + i, by + bh);
    ctx.lineTo(px + i + bh, by);
    ctx.stroke();
  }
  // 핸드오프의 radial-gradient는 '테두리 원'이 아니라 옅게 채운 원 두 겹이다 —
  // 선으로 그리면 과녁처럼 튄다.
  const ringCx = px + panelW / 2;
  const ringCy = by + bh * 0.34;
  ctx.fillStyle = 'rgba(13,125,115,0.10)';
  for (const r of [panelW * 0.46, panelW * 0.38]) {
    ctx.beginPath();
    ctx.arc(ringCx, ringCy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 상단 다크 밴드
  const bandH = 34 * S;
  ctx.fillStyle = INK;
  ctx.fillRect(px, by, panelW, bandH);
  ctx.fillStyle = '#8fc7c1';
  ctx.font = `700 ${9 * S}px ${SANS}`;
  tracked(ctx, 'CATCHAP ACADEMY', ringCx, by + bandH / 2 + 3.5 * S, 3.6 * S, 'center');

  // COURSE / CERTIFICATE
  let ry = by + bandH + 30 * S;
  ctx.fillStyle = INK;
  ctx.font = `500 ${18 * S}px ${SANS}`;
  ry += 18 * S;
  tracked(ctx, 'COURSE', ringCx, ry, 5.4 * S, 'center');
  ry += 30 * S;
  tracked(ctx, 'CERTIFICATE', ringCx, ry, 5.4 * S, 'center');

  // 구분선 + 마름모
  ry += 20 * S;
  ctx.strokeStyle = '#a9bab7';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ringCx - 62 * S, ry);
  ctx.lineTo(ringCx - 12 * S, ry);
  ctx.moveTo(ringCx + 12 * S, ry);
  ctx.lineTo(ringCx + 62 * S, ry);
  ctx.stroke();
  ctx.save();
  ctx.translate(ringCx, ry);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = TEAL;
  ctx.fillRect(-2.5 * S, -2.5 * S, 5 * S, 5 * S);
  ctx.restore();

  // 인장 — 점선 원 + 이중선 원 + 안쪽 워드마크
  const sealR = 86 * S;
  const sealCy = ry + 26 * S + sealR;
  ctx.save();
  ctx.setLineDash([4 * S, 4 * S]);
  ctx.strokeStyle = '#9fb0ae';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(ringCx, sealCy, sealR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(ringCx, sealCy, 70 * S, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = TEAL;
  ctx.lineWidth = 1.4 * S;
  for (const r of [70 * S, 65 * S]) {
    ctx.beginPath();
    ctx.arc(ringCx, sealCy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#7d8b8a';
  ctx.font = `500 ${6.5 * S}px ${SANS}`;
  tracked(ctx, 'EDUCATION FOR EVERYONE', ringCx, sealCy - 26 * S, 1.3 * S, 'center');
  if (logo) {
    const lh = 15 * S;
    const lw = (logo.width / logo.height) * lh;
    ctx.drawImage(logo, ringCx - lw / 2, sealCy - 8 * S, lw, lh);
  }
  ctx.strokeStyle = '#c3d0ce';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ringCx - 13 * S, sealCy + 16 * S);
  ctx.lineTo(ringCx + 13 * S, sealCy + 16 * S);
  ctx.stroke();
  ctx.fillStyle = '#7d8b8a';
  ctx.font = `500 ${6.5 * S}px ${SANS}`;
  tracked(ctx, `VERIFIED ${d.passedAt.slice(0, 4)}`, ringCx, sealCy + 28 * S, 1.3 * S, 'center');

  // 크리덴셜 표 — 값은 전부 서버가 내려준 실제 데이터
  const rows: [string, string][] = [
    ['CREDENTIAL ID', d.serial],
    ['ISSUED', d.passedAt.slice(0, 10)],
    ['SUBJECT', d.subject || '-'],
    ['QUESTIONS', `${d.questionCount}`],
  ];
  let tableY = sealCy + sealR + 30 * S;
  const tLeft = px + 26 * S;
  const tRight = px + panelW - 26 * S;
  rows.forEach(([label, value], i) => {
    ctx.fillStyle = '#8794a2';
    ctx.font = `500 ${9.5 * S}px ${SANS}`;
    tracked(ctx, label, tLeft, tableY, 1.5 * S);
    ctx.fillStyle = INK;
    ctx.font = `500 ${9.5 * S}px ${SANS}`;
    ctx.textAlign = 'right';
    ctx.fillText(value, tRight, tableY);
    ctx.textAlign = 'left';
    if (i < rows.length - 1) {
      ctx.strokeStyle = 'rgba(22,32,44,0.10)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tLeft, tableY + 6 * S);
      ctx.lineTo(tRight, tableY + 6 * S);
      ctx.stroke();
    }
    tableY += 15 * S;
  });

  ctx.fillStyle = '#a8b4b3';
  ctx.font = `500 ${5.5 * S}px ${SANS}`;
  tracked(ctx, 'CATCHAP·AUTHENTIC·CATCHAP·AUTHENTIC·CATCHAP', ringCx, tableY + 14 * S, 1.6 * S, 'center');
  ctx.restore(); // 패널 clip 해제

  // ---------- 모서리 꺾쇠 (패널 위에도 보이도록 clip 밖에서) ----------
  const cOff = 10 * S;
  const cLen = 22 * S;
  ctx.strokeStyle = TEAL;
  ctx.lineWidth = 2 * S;
  const bracket = (x: number, y: number, dx: number, dy: number) => {
    ctx.beginPath();
    ctx.moveTo(x + dx * cLen, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + dy * cLen);
    ctx.stroke();
  };
  bracket(bx + cOff, by + cOff, 1, 1);
  bracket(bx + bw - cOff, by + cOff, -1, 1);
  bracket(bx + cOff, by + bh - cOff, 1, -1);
  bracket(bx + bw - cOff, by + bh - cOff, -1, -1);

  // ---------- 좌측 본문 ----------
  const lx = bx + 62 * S;
  const lw = px - 40 * S - lx;

  // 워드마크 + 청록 점
  const logoH = 40 * S;
  const logoTop = by + 54 * S;
  if (logo) {
    const lgw = (logo.width / logo.height) * logoH;
    ctx.drawImage(logo, lx, logoTop, lgw, logoH);
    ctx.fillStyle = TEAL;
    ctx.beginPath();
    ctx.arc(lx + lgw + 11 * S, logoTop + logoH - 5.5 * S, 5.5 * S, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // 로고 로드 실패 시에도 수료증은 나와야 한다 — 워드마크를 글자로 대체
    ctx.fillStyle = INK;
    ctx.font = `800 ${34 * S}px ${SANS}`;
    tracked(ctx, 'CATCHAP', lx, logoTop + logoH, 3 * S);
  }
  ctx.fillStyle = '#7d8b8a';
  ctx.font = `500 ${11 * S}px ${SANS}`;
  tracked(ctx, 'LEARNING & CERTIFICATION', lx, logoTop + logoH + 24 * S, 3.7 * S);

  // 본문 중앙 블록 — 수료일 / 이름 / 코스명.
  // 핸드오프는 flex의 margin-top:auto 두 번으로 브랜드~하단 사이 여백을 균등 분배한다.
  // 캔버스에는 auto가 없으니 그 결과 위치에 해당하는 값을 직접 준다.
  let y = by + 300 * S;

  ctx.fillStyle = '#5e6b6a';
  ctx.font = `400 ${15 * S}px ${SERIF}`;
  const [py, pm, pd] = (d.passedAt.slice(0, 10) || '').split('-').map((n) => parseInt(n, 10));
  tracked(ctx, py ? `${py}년 ${pm}월 ${pd}일 수료` : '수료 완료', lx, y, 1.2 * S);

  y += 46 * S;
  ctx.fillStyle = INK;
  ctx.font = `500 ${46 * S}px ${SERIF}`;
  tracked(ctx, d.studentName, lx, y, 0.9 * S);

  y += 30 * S;
  ctx.fillStyle = '#4a5756';
  ctx.font = `400 ${15 * S}px ${SERIF}`;
  ctx.fillText('이(가) 아래 과정을 완료했습니다.', lx, y);

  // 코스명 — 수료증의 핵심이라 핸드오프(31px)보다 키워 학습자 이름 다음으로 크게 둔다
  // ("수료한 강의명이 명확하게 보이도록" 요청). 폭에 맞춰 줄이고, 그래도 길면 두 줄.
  y += 38 * S;
  const titleSize = fitFont(ctx, d.courseTitle, lw, 38 * S, 22 * S, (s) => `600 ${s}px ${SERIF}`);
  ctx.font = `500 ${titleSize}px ${SERIF}`;
  const titleLines = wrapText(ctx, d.courseTitle, lw).slice(0, 2);
  ctx.fillStyle = INK;
  titleLines.forEach((ln, i) => {
    ctx.fillText(ln, lx, y + i * titleSize * 1.25);
  });
  y += (titleLines.length - 1) * titleSize * 1.25;

  y += 22 * S;
  ctx.fillStyle = TEAL;
  ctx.fillRect(lx, y, 64 * S, 2 * S);

  y += 24 * S;
  ctx.fillStyle = '#6b7877';
  ctx.font = `400 ${13 * S}px ${SERIF}`;
  ctx.fillText('CatChap에서 인증하고 제공하는 시청 검증형 온라인 강의', lx, y);

  if (d.perfect) {
    y += 26 * S;
    ctx.font = `700 ${11 * S}px ${SANS}`;
    const label = 'PERFECT SCORE';
    const tw = trackedWidth(ctx, label, 2.4 * S);
    ctx.fillStyle = '#e8f2f0';
    roundRect(ctx, lx, y - 12 * S, tw + 22 * S, 20 * S, 10 * S);
    ctx.fill();
    ctx.fillStyle = TEAL;
    tracked(ctx, label, lx + 11 * S, y + 2 * S, 2.4 * S);
  }

  // ---------- 좌측 하단: 서명 · 일련번호 ----------
  const lBottom = by + bh - 34 * S;

  // 면책 문구(맨 아래)
  ctx.fillStyle = '#98a4a3';
  ctx.font = `400 ${9.5 * S}px ${SERIF}`;
  const disc =
    '이 수료증은 학습자가 CatChap을 통해 제공된 온라인 강의를 끝까지 시청하고 수료 시험을 통과했음을 증명합니다. 대학이나 기관에 정식으로 등록한 것으로 간주되지 않으며, 그 자체로 학점·성적 또는 학위를 부여하지 않습니다.';
  const discLines = wrapText(ctx, disc, lw);
  const discLh = 15.7 * S;
  const discTop = lBottom - discLines.length * discLh;
  discLines.forEach((ln, i) => ctx.fillText(ln, lx, discTop + (i + 1) * discLh - 4 * S));

  // 하단 두 블록(좌: 발급처 / 우: 일련번호) — 손글씨 서명과 구분선은 두지 않는다(사용자 요청).
  // 좌우가 같은 기준선·같은 줄 간격을 쓰도록 baseline을 한 곳에서 계산한다.
  const footLh = 20 * S; // 공통 줄 간격
  const footBase = discTop - 26 * S; // 마지막 줄 기준선
  const vRight = px - 40 * S;

  // 좌 — 발급처(강사 개인이 아니라 서비스 명의)
  ctx.fillStyle = '#4a5756';
  ctx.font = `600 ${13 * S}px ${SERIF}`;
  ctx.fillText('CatChap 캣챱', lx, footBase - footLh);
  ctx.fillStyle = '#7d8b8a';
  ctx.font = `400 ${12.5 * S}px ${SERIF}`;
  ctx.fillText(`${d.subject || '온라인'} 강의 · 시청 검증형 온라인 강의 플랫폼`, lx, footBase);

  // 우 — 확인 문구 한 줄. 일련번호는 우측 패널의 CREDENTIAL ID 행에 이미 있어 여기선 빼고
  // 좌측 발급처 줄과 같은 기준선에 맞춘다(사용자 요청).
  ctx.textAlign = 'right';
  ctx.fillStyle = '#7d8b8a';
  ctx.font = `400 ${12.5 * S}px ${SERIF}`;
  ctx.fillText('CatChap이 이 학습자의 수료 사실을 확인하였습니다.', vRight, footBase);
  ctx.textAlign = 'left';

  return canvas;
}
