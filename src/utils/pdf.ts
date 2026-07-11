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
  ctx.fillStyle = '#FF5A4D';
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
      ctx.fillStyle = '#FF5A4D';
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
