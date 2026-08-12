/** PDF 다운로드 — 캔버스(리포트/상장) 임베드 + 표 데이터 A4 렌더.
 *
 * 한글 폰트 임베딩 없이 캔버스로 그려 이미지로 싣는 방식이라 어떤 환경에서도 한글이 깨지지 않는다.
 * jspdf(수백 KB)는 '다운로드 버튼을 눌렀을 때'만 필요하므로 동적 import — 정적으로 두면
 * 이 모듈을 쓰는 8개 페이지 청크 전부에 항상 실려 초기 로드가 무거워진다.
 */
type JsPDFModule = typeof import('jspdf');

let jspdfModule: JsPDFModule | null = null;

async function loadJsPDF(): Promise<JsPDFModule['jsPDF']> {
  if (!jspdfModule) jspdfModule = await import('jspdf');
  return jspdfModule.jsPDF;
}

/** 캔버스 1장 → 같은 비율의 PDF 1페이지 (주간 리포트·상장) */
export async function canvasToPdf(filename: string, canvas: HTMLCanvasElement) {
  const jsPDF = await loadJsPDF();
  const w = canvas.width;
  const h = canvas.height;
  const pdf = new jsPDF({
    orientation: w > h ? 'landscape' : 'portrait',
    unit: 'px',
    format: [w, h],
    hotfixes: ['px_scaling'],
  });
  // JPEG(고품질)로 인코딩 — 무손실 PNG 대비 용량 대폭 감소(리포트/상장 시각 품질 유지, 한글 안전).
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, w, h);
  pdf.save(filename);
}

/* ===== 표 데이터 → A4 PDF (CSV와 같은 rows 배열 재사용) ===== */

const PAGE_W = 1240; // A4 150dpi
const PAGE_H = 1754;
const MARGIN = 90;
const ROW_H = 44;
const F = "'Pretendard', 'Malgun Gothic', sans-serif";

type Row = (string | number | null | undefined)[];

function newPage(title: string, pageNo: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; y: number } {
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  // 헤더 밴드
  ctx.fillStyle = '#ea5443';
  ctx.fillRect(0, 0, PAGE_W, 8);
  ctx.fillStyle = '#1F2330';
  ctx.font = `900 40px ${F}`;
  ctx.fillText(title, MARGIN, 96);
  ctx.fillStyle = '#9AA0B0';
  ctx.font = `700 22px ${F}`;
  ctx.textAlign = 'right';
  ctx.fillText(`CatChap · ${new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })} · ${pageNo}쪽`, PAGE_W - MARGIN, 96);
  ctx.textAlign = 'left';
  return { canvas, ctx, y: 150 };
}

/** CSV용 rows(섹션 제목은 '[...]'로 시작)를 그대로 받아 A4 다중 페이지 PDF로 저장 */
export async function tableToPdf(filename: string, title: string, rows: Row[]) {
  const jsPDF = await loadJsPDF();
  const pages: HTMLCanvasElement[] = [];
  let page = newPage(title, 1);
  let sectionHeader: Row | null = null; // 페이지 넘김 시 컬럼 헤더 반복용
  let isHeaderRow = false;

  const drawRow = (row: Row, header: boolean, section: boolean) => {
    const { ctx } = page;
    const y = page.y;
    if (section) {
      ctx.fillStyle = '#ea5443';
      ctx.font = `900 28px ${F}`;
      ctx.fillText(String(row[0] ?? '').replace(/^\[|\]$/g, ''), MARGIN, y + 30);
      page.y += ROW_H + 10;
      return;
    }
    const cols = row.length;
    const cw = (PAGE_W - MARGIN * 2) / Math.max(1, cols);
    if (header) {
      ctx.fillStyle = '#F6F7FB';
      ctx.fillRect(MARGIN, y, PAGE_W - MARGIN * 2, ROW_H);
    }
    ctx.strokeStyle = '#E4E6EF';
    ctx.lineWidth = 1;
    ctx.strokeRect(MARGIN, y, PAGE_W - MARGIN * 2, ROW_H);
    ctx.fillStyle = header ? '#4A4E5C' : '#2E3040';
    ctx.font = `${header ? 800 : 600} 22px ${F}`;
    row.forEach((cell, i) => {
      let text = cell == null ? '' : String(cell);
      if (text.length > 18) text = text.slice(0, 18) + '…';
      ctx.fillText(text, MARGIN + i * cw + 14, y + 30);
    });
    page.y += ROW_H;
  };

  rows.forEach((row) => {
    const first = String(row[0] ?? '');
    const isSection = first.startsWith('[');
    const isBlank = row.length === 0 || row.every((c) => c == null || String(c) === '');
    if (isBlank) {
      page.y += 24;
      return;
    }
    // 페이지 넘침 → 새 페이지 + 컬럼 헤더 반복
    if (page.y + ROW_H > PAGE_H - 80) {
      pages.push(page.canvas);
      page = newPage(title, pages.length + 1);
      if (!isSection && sectionHeader && !isHeaderRow) drawRow(sectionHeader, true, false);
    }
    if (isSection) {
      sectionHeader = null;
      isHeaderRow = true; // 다음 행을 컬럼 헤더로 취급
      drawRow(row, false, true);
      return;
    }
    if (isHeaderRow) {
      sectionHeader = row;
      isHeaderRow = false;
      drawRow(row, true, false);
      return;
    }
    drawRow(row, false, false);
  });
  pages.push(page.canvas);

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [PAGE_W, PAGE_H], hotfixes: ['px_scaling'] });
  pages.forEach((c, i) => {
    if (i > 0) pdf.addPage([PAGE_W, PAGE_H], 'portrait');
    // 표 페이지는 흰 배경+글자/선 위주라 JPEG로 충분(무손실 PNG는 페이지당 수 MB → 13MB급 비대).
    pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, PAGE_W, PAGE_H);
  });
  pdf.save(filename);
}

/* ===== 학습 리포트 — CatChap 톤(모노크롬 + 완주/수료 그린 포인트)으로 디자인한 A4 1페이지 =====
   종전 tableToPdf(코럴레드 표)가 사이트와 겉돌아, 앱 디자인(흑백·굵은 숫자·여백)에 맞춘 전용 렌더러. */
export interface LearningReport {
  name: string;
  date: string;
  /** 문제 풀이 요약 — 데모(실집계 없음)면 null */
  summary: { streak: number; solved: number; accuracy: number } | null;
  /** 강의 시청 통계 — 시청 기록 없으면 null */
  lectures: { done: number; total: number; watching: number; courses: number; pct: number } | null;
  courseProgress: { title: string; done: number; total: number; pct: number }[];
  completions: { title: string; perfect: boolean; at: string }[];
  /** 최근 7일 일자별 학습(요일·문제 수·강의 분) — 추이 그래프용. 없으면 빈 배열. */
  days: { label: string; solved: number; watchMin: number }[];
}

export async function learningReportPdf(filename: string, r: LearningReport) {
  const W = 1240, H = 1754, M = 96;
  const INK = '#18181b', INK2 = '#57575c', INK3 = '#9a9aa0', LINE = '#e7e7ea', SOFT = '#f5f5f6', OK = '#2e7d5b';
  // 2배 해상도로 그려 PDF 텍스트를 또렷하게(인쇄 시 DPI 2배). 좌표는 그대로 W/H 공간을 쓴다.
  const SCALE = 2;
  const cv = document.createElement('canvas');
  cv.width = W * SCALE; cv.height = H * SCALE;
  const x = cv.getContext('2d')!;
  x.scale(SCALE, SCALE);
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  x.textBaseline = 'alphabetic';

  const rr = (px: number, py: number, pw: number, ph: number, rad: number) => {
    const rd = Math.min(rad, pw / 2, ph / 2);
    x.beginPath();
    x.moveTo(px + rd, py);
    x.arcTo(px + pw, py, px + pw, py + ph, rd);
    x.arcTo(px + pw, py + ph, px, py + ph, rd);
    x.arcTo(px, py + ph, px, py, rd);
    x.arcTo(px, py, px + pw, py, rd);
    x.closePath();
  };
  const ell = (s: string, max: number) => {
    if (x.measureText(s).width <= max) return s;
    let t = s;
    while (t.length > 1 && x.measureText(t + '…').width > max) t = t.slice(0, -1);
    return t + '…';
  };

  let y = 134;
  // 헤더 — 워드마크(작게, 위) + 제목(간격 넉넉히) + 이름/날짜
  x.fillStyle = INK2; x.font = `900 22px ${F}`; x.fillText('CATCHAP', M, y - 62);
  x.fillStyle = INK; x.font = `800 48px ${F}`; x.fillText('학습 리포트', M, y);
  x.fillStyle = INK3; x.font = `600 19px ${F}`; x.textAlign = 'right';
  x.fillText(`${r.name}님 · ${r.date}`, W - M, y - 8); x.textAlign = 'left';
  y += 30;
  x.fillStyle = INK; x.fillRect(M, y, W - M * 2, 2);
  y += 56;

  const secHead = (t: string) => { x.fillStyle = INK; x.font = `800 25px ${F}`; x.fillText(t, M, y); y += 36; };
  const emptyNote = (t: string) => {
    rr(M, y, W - M * 2, 66, 14); x.fillStyle = SOFT; x.fill();
    x.fillStyle = INK3; x.font = `600 17px ${F}`; x.fillText(t, M + 24, y + 40); y += 66 + 30;
  };

  // 요약 · 문제 풀이 — 스탯 카드 3개
  secHead('요약 · 문제 풀이');
  if (r.summary) {
    const cards: [string, string, string][] = [
      ['연속 학습', String(r.summary.streak), '일'],
      ['지금까지 푼 문제', String(r.summary.solved), '개'],
      ['평균 정답률', String(r.summary.accuracy), '%'],
    ];
    const gap = 20, cw = (W - M * 2 - gap * 2) / 3, ch = 132;
    cards.forEach(([label, num, unit], i) => {
      const cx = M + i * (cw + gap);
      rr(cx, y, cw, ch, 16); x.fillStyle = SOFT; x.fill();
      x.strokeStyle = LINE; x.lineWidth = 1; rr(cx, y, cw, ch, 16); x.stroke();
      const nx = cx + 26;
      x.fillStyle = INK; x.font = `800 48px ${F}`; x.fillText(num, nx, y + 76);
      const nw = x.measureText(num).width;
      x.fillStyle = INK3; x.font = `700 22px ${F}`; x.fillText(unit, nx + nw + 7, y + 76);
      x.fillStyle = INK2; x.font = `600 17px ${F}`; x.fillText(label, nx, y + 108);
    });
    y += ch + 36;
  } else { emptyNote('아직 문제 풀이 기록이 없습니다.'); }

  // 최근 7일 학습 추이 — 일자별 라인 차트(문제 수 + 강의 분)
  secHead('최근 7일 학습 추이');
  const trendDays = (r.days || []).slice(-7);
  if (trendDays.some((d) => d.solved + d.watchMin > 0)) {
    const chW = W - M * 2, chH = 212, padX = 42, padT = 46, padB = 42;
    rr(M, y, chW, chH, 16); x.fillStyle = '#fff'; x.fill();
    x.strokeStyle = LINE; x.lineWidth = 1; rr(M, y, chW, chH, 16); x.stroke();
    const n = trendDays.length;
    const val = (d: { solved: number; watchMin: number }) => d.solved + d.watchMin;
    const ceil = Math.max(...trendDays.map(val), 1) * 1.3;
    const plotW = chW - padX * 2, plotH = chH - padT - padB;
    const gx = (i: number) => M + padX + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
    const gy = (v: number) => y + padT + (1 - v / ceil) * plotH;
    const baseY = y + padT + plotH;
    x.strokeStyle = LINE; x.lineWidth = 1;
    [0.34, 0.67].forEach((f) => {
      const yy = y + padT + f * plotH;
      x.beginPath(); x.moveTo(M + padX, yy); x.lineTo(M + chW - padX, yy); x.stroke();
    });
    x.strokeStyle = '#d7d7da'; x.beginPath(); x.moveTo(M + padX, baseY); x.lineTo(M + chW - padX, baseY); x.stroke();
    const active = trendDays.map((d, i) => ({ d, i, v: val(d) })).filter((o) => o.v > 0);
    if (active.length >= 2) {
      x.strokeStyle = INK; x.lineWidth = 2.5; x.lineJoin = 'round'; x.lineCap = 'round';
      x.beginPath();
      active.forEach((o, k) => { const X = gx(o.i), Y = gy(o.v); if (k === 0) x.moveTo(X, Y); else x.lineTo(X, Y); });
      x.stroke();
    }
    x.textAlign = 'center';
    trendDays.forEach((d, i) => {
      const v = val(d), X = gx(i), isToday = i === n - 1;
      if (v > 0) {
        const Y = gy(v);
        x.fillStyle = isToday ? INK : '#fff'; x.strokeStyle = INK; x.lineWidth = 2.5;
        x.beginPath(); x.arc(X, Y, isToday ? 7 : 5, 0, Math.PI * 2); x.fill(); if (!isToday) x.stroke();
        const lbl = [d.solved > 0 ? `${d.solved}문제` : null, d.watchMin > 0 ? `${d.watchMin}분` : null].filter(Boolean).join('·');
        x.fillStyle = isToday ? INK : INK2; x.font = `${isToday ? '800 18' : '700 15'}px ${F}`;
        x.fillText(lbl, X, Y - 16);
      }
      x.fillStyle = isToday ? INK : INK3; x.font = `${isToday ? '800' : '600'} 16px ${F}`;
      x.fillText(d.label, X, baseY + 26);
    });
    const tS = trendDays.reduce((s, d) => s + d.solved, 0), tW = trendDays.reduce((s, d) => s + d.watchMin, 0);
    x.fillStyle = INK3; x.font = `600 15px ${F}`;
    x.fillText(`문제 ${tS}개 · 강의 ${tW}분`, M + chW / 2, y + chH - 16);
    x.textAlign = 'left';
    y += chH + 36;
  } else { emptyNote('아직 학습 추이가 없습니다.'); }

  // 학습 통계 · 강의 시청
  secHead('학습 통계 · 강의 시청');
  if (r.lectures) {
    const L = r.lectures;
    x.fillStyle = INK2; x.font = `600 18px ${F}`; x.fillText(`완주한 강의  ${L.done} / ${L.total}강`, M, y + 4);
    x.textAlign = 'right'; x.fillStyle = INK; x.font = `800 20px ${F}`; x.fillText(`${L.pct}%`, W - M, y + 4); x.textAlign = 'left';
    y += 22;
    rr(M, y, W - M * 2, 14, 7); x.fillStyle = LINE; x.fill();
    if (L.pct > 0) { rr(M, y, (W - M * 2) * Math.min(1, L.pct / 100), 14, 7); x.fillStyle = INK; x.fill(); }
    y += 42;
    x.fillStyle = INK2; x.font = `600 17px ${F}`;
    x.fillText(`시청 중 ${L.watching}강      수강 코스 ${L.courses}개`, M, y);
    y += 44;
    if (r.courseProgress.length) {
      x.fillStyle = INK3; x.font = `700 15px ${F}`; x.fillText('코스별 진도', M, y); y += 28;
      r.courseProgress.slice(0, 5).forEach((cp) => {
        x.fillStyle = INK; x.font = `600 17px ${F}`; x.fillText(ell(cp.title, W - M * 2 - 260), M, y);
        x.textAlign = 'right'; x.fillStyle = INK2; x.font = `700 16px ${F}`;
        x.fillText(`${cp.done}/${cp.total}강 · ${cp.pct}%`, W - M, y); x.textAlign = 'left';
        y += 14;
        rr(M, y, W - M * 2, 8, 4); x.fillStyle = LINE; x.fill();
        if (cp.pct > 0) { rr(M, y, (W - M * 2) * Math.min(1, cp.pct / 100), 8, 4); x.fillStyle = INK; x.fill(); }
        y += 32;
      });
      if (r.courseProgress.length > 5) { x.fillStyle = INK3; x.font = `600 14px ${F}`; x.fillText(`외 ${r.courseProgress.length - 5}개 코스`, M, y); y += 26; }
    }
    y += 14;
  } else { emptyNote('아직 강의 시청 기록이 없습니다.'); }

  // 수료 현황 — 그린 체크 배지
  secHead('수료 현황');
  if (r.completions.length) {
    x.fillStyle = INK2; x.font = `600 17px ${F}`; x.fillText(`수료한 코스 ${r.completions.length}개`, M, y); y += 34;
    r.completions.slice(0, 6).forEach((cp) => {
      x.fillStyle = OK; x.beginPath(); x.arc(M + 12, y - 6, 12, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#fff'; x.lineWidth = 2.6; x.lineJoin = 'round'; x.lineCap = 'round';
      x.beginPath(); x.moveTo(M + 6, y - 6); x.lineTo(M + 10.5, y - 1.5); x.lineTo(M + 18, y - 11); x.stroke();
      x.fillStyle = INK; x.font = `600 18px ${F}`; x.fillText(ell(cp.title, W - M * 2 - 240), M + 36, y);
      x.textAlign = 'right'; x.fillStyle = INK3; x.font = `600 15px ${F}`;
      x.fillText((cp.perfect ? '만점 수료' : '수료') + (cp.at ? ` · ${cp.at}` : ''), W - M, y); x.textAlign = 'left';
      y += 42;
    });
    if (r.completions.length > 6) { x.fillStyle = INK3; x.font = `600 14px ${F}`; x.fillText(`외 ${r.completions.length - 6}개`, M + 36, y); }
  } else { emptyNote('아직 수료한 코스가 없습니다.'); }

  // 푸터
  x.fillStyle = LINE; x.fillRect(M, H - 98, W - M * 2, 1);
  x.fillStyle = INK3; x.font = `600 15px ${F}`;
  x.fillText('CatChap · 시청을 검증하는 강의 학습', M, H - 60);
  x.textAlign = 'right'; x.fillText(`생성일 ${r.date}`, W - M, H - 60); x.textAlign = 'left';

  await canvasToPdf(filename, cv);
}
