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

/* ===== 학습 리포트 — CatChap 톤(흑백 중심 + 수료 그린 포인트)의 A4 리포트 =====
   정보 중요도 순으로 배치한다:
     ① 핵심 지표(연속 학습일·푼 문제·정답률·시청 시간·수강 코스)
     ② 최근 7일 추이 — '문제 풀이'와 '강의 시청'을 완전히 분리한 그래프 2개
     ③ 전체 강의 수강 현황 → ④ 코스별 진행도 → ⑤ 수료 현황
   내용이 넘치면 다음 장으로 넘겨 한 페이지에 우겨넣지 않는다(가독성 우선). */
export interface LearningReport {
  name: string;
  date: string;
  /** 문제 풀이 요약 — 데모(실집계 없음)면 null */
  summary: { streak: number; solved: number; accuracy: number } | null;
  /** 누적 강의 시청 시간 — 실집계 없으면 null */
  watch: { hours: number; minutes: number } | null;
  /** 강의 시청 통계 — 시청 기록 없으면 null */
  lectures: { done: number; total: number; watching: number; courses: number; pct: number } | null;
  courseProgress: { title: string; done: number; total: number; pct: number }[];
  completions: { title: string; perfect: boolean; at: string }[];
  /** 최근 7일 일자별 학습(요일·문제 수·강의 분) — 추이 그래프용. 없으면 빈 배열. */
  days: { label: string; solved: number; watchMin: number }[];
}

const RPT_W = 1240, RPT_H = 1754; // A4 150dpi

/** 리포트 페이지를 캔버스로 렌더 — 저장(PDF)과 화면 미리보기가 같은 그림을 쓰도록 분리. */
export function renderLearningReportPages(r: LearningReport): HTMLCanvasElement[] {
  const W = RPT_W, H = RPT_H, M = 84; // A4 150dpi · 좌우 여백
  const CW = W - M * 2;               // 본문 폭
  const FOOT = 96;                    // 푸터(인쇄 하단 여백) 예약
  const SCALE = 2;                    // 2배 렌더 → 인쇄 시 또렷
  const INK = '#18181b', INK2 = '#57575c', INK3 = '#9a9aa0';
  const LINE = '#e7e7ea', SOFT = '#f7f7f8', FILL = '#ececee', OK = '#2e7d5b';

  const pages: HTMLCanvasElement[] = [];
  let cv!: HTMLCanvasElement;
  let x!: CanvasRenderingContext2D;
  let y = 0;

  /* ── 원시 도형 ── */
  const rr = (px: number, py: number, pw: number, ph: number, rad: number) => {
    const rd = Math.max(0, Math.min(rad, pw / 2, ph / 2));
    x.beginPath();
    x.moveTo(px + rd, py);
    x.arcTo(px + pw, py, px + pw, py + ph, rd);
    x.arcTo(px + pw, py + ph, px, py + ph, rd);
    x.arcTo(px, py + ph, px, py, rd);
    x.arcTo(px, py, px + pw, py, rd);
    x.closePath();
  };
  /** 카드 — 옅은 면 + 헤어라인. 리포트의 기본 담기 단위. */
  const card = (px: number, py: number, pw: number, ph: number, soft = true) => {
    rr(px, py, pw, ph, 16); x.fillStyle = soft ? SOFT : '#fff'; x.fill();
    x.strokeStyle = LINE; x.lineWidth = 1; rr(px, py, pw, ph, 16); x.stroke();
  };
  const bar = (px: number, py: number, pw: number, ph: number, pct: number) => {
    rr(px, py, pw, ph, ph / 2); x.fillStyle = FILL; x.fill();
    const w = pw * Math.max(0, Math.min(1, pct / 100));
    if (w > 0.5) { rr(px, py, Math.max(w, ph), ph, ph / 2); x.fillStyle = INK; x.fill(); }
  };
  const ell = (s: string, max: number) => {
    if (x.measureText(s).width <= max) return s;
    let t = s;
    while (t.length > 1 && x.measureText(t + '…').width > max) t = t.slice(0, -1);
    return t + '…';
  };

  /* ── 페이지 ── */
  const startPage = (first: boolean) => {
    cv = document.createElement('canvas');
    cv.width = W * SCALE; cv.height = H * SCALE;
    x = cv.getContext('2d')!;
    x.scale(SCALE, SCALE);
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    if (first) {
      x.fillStyle = INK2; x.font = `900 20px ${F}`; x.fillText('CATCHAP', M, 82);
      x.fillStyle = INK; x.font = `800 46px ${F}`; x.fillText('학습 리포트', M, 134);
      x.textAlign = 'right';
      x.fillStyle = INK; x.font = `700 20px ${F}`; x.fillText(`${r.name}님`, W - M, 110);
      x.fillStyle = INK3; x.font = `600 16px ${F}`; x.fillText(r.date, W - M, 134);
      x.textAlign = 'left';
      x.fillStyle = INK; x.fillRect(M, 158, CW, 2);
      y = 206;
    } else {
      // 이어지는 장 — 얇은 러닝헤더만 두어 본문 공간을 확보
      x.fillStyle = INK3; x.font = `700 15px ${F}`; x.fillText('CATCHAP · 학습 리포트', M, 80);
      x.textAlign = 'right'; x.fillText(`${r.name}님 · ${r.date}`, W - M, 80); x.textAlign = 'left';
      x.fillStyle = LINE; x.fillRect(M, 98, CW, 1);
      y = 146;
    }
  };
  const finishPage = () => {
    x.textAlign = 'left';
    x.fillStyle = LINE; x.fillRect(M, H - FOOT + 20, CW, 1);
    x.fillStyle = INK3; x.font = `600 14px ${F}`;
    x.fillText('CatChap · 시청을 검증하는 강의 학습', M, H - FOOT + 54);
    x.textAlign = 'right'; x.fillText(`${pages.length + 1}쪽`, W - M, H - FOOT + 54);
    x.textAlign = 'left';
    pages.push(cv);
  };
  /** 남은 높이가 모자라면 다음 장으로 — 카드·행이 페이지 경계에서 잘리지 않게 */
  const ensure = (need: number) => {
    if (y + need <= H - FOOT) return;
    finishPage();
    startPage(false);
  };

  /* ── 섹션 제목(위계: 제목 → 설명 → 내용) ── */
  const secHead = (title: string, cap: string, need = 0) => {
    ensure(58 + need);
    x.fillStyle = INK; x.font = `800 24px ${F}`; x.fillText(title, M, y);
    x.fillStyle = INK3; x.font = `600 15px ${F}`; x.fillText(cap, M, y + 24);
    y += 50;
  };
  const emptyNote = (t: string) => {
    ensure(98);
    card(M, y, CW, 68);
    x.fillStyle = INK3; x.font = `600 16px ${F}`; x.fillText(t, M + 22, y + 41);
    y += 98;
  };

  startPage(true);

  /* ===== ① 핵심 지표 — 한눈에 보는 5칸 ===== */
  {
    const wm = r.watch;
    const watchParts: [string, string][] = wm
      ? wm.hours > 0
        ? wm.minutes > 0
          ? [[String(wm.hours), '시간'], [String(wm.minutes), '분']]
          : [[String(wm.hours), '시간']]
        : [[String(wm.minutes), '분']]
      : [['—', '']];
    const kpis: { label: string; parts: [string, string][] }[] = [
      { label: '연속 학습일', parts: [[r.summary ? String(r.summary.streak) : '—', r.summary ? '일' : '']] },
      { label: '푼 문제', parts: [[r.summary ? String(r.summary.solved) : '—', r.summary ? '개' : '']] },
      { label: '평균 정답률', parts: [[r.summary ? String(r.summary.accuracy) : '—', r.summary ? '%' : '']] },
      { label: '강의 시청 시간', parts: watchParts },
      { label: '수강 코스', parts: [[r.lectures ? String(r.lectures.courses) : '—', r.lectures ? '개' : '']] },
    ];
    const gap = 14, kw = (CW - gap * 4) / 5, kh = 122;
    ensure(kh + 40);
    kpis.forEach((k, i) => {
      const cx = M + i * (kw + gap);
      card(cx, y, kw, kh);
      x.fillStyle = INK3; x.font = `700 14px ${F}`; x.fillText(k.label, cx + 18, y + 36);
      // 숫자는 크게 · 단위는 작게 — 값이 길어도(8시간 20분) 카드를 넘지 않는다
      let tx = cx + 18;
      k.parts.forEach(([num, unit], j) => {
        if (j > 0) tx += 6;
        x.fillStyle = INK; x.font = `800 36px ${F}`; x.fillText(num, tx, y + 88);
        tx += x.measureText(num).width + 3;
        if (unit) {
          x.fillStyle = INK3; x.font = `700 17px ${F}`; x.fillText(unit, tx, y + 88);
          tx += x.measureText(unit).width;
        }
      });
    });
    y += kh + 38;
  }

  /* ===== ② 최근 7일 학습 추이 — 문제 풀이 / 강의 시청 완전 분리 ===== */
  secHead('최근 7일 학습 추이', '문제 풀이와 강의 시청을 각각 나눠서 보여줍니다.');
  {
    const days = (r.days || []).slice(-7);
    const hasAny = days.some((d) => d.solved + d.watchMin > 0);
    if (hasAny) {
      const gap = 20, cw2 = (CW - gap) / 2, chH = 250;
      ensure(chH + 40);
      const top = y;
      const drawTrend = (
        px: number,
        title: string,
        getVal: (d: { solved: number; watchMin: number }) => number,
        fmt: (v: number) => string,
        totalText: string,
      ) => {
        card(px, top, cw2, chH, false);
        x.fillStyle = INK; x.font = `800 17px ${F}`; x.fillText(title, px + 22, top + 34);
        x.textAlign = 'right'; x.fillStyle = INK; x.font = `800 17px ${F}`;
        x.fillText(totalText, px + cw2 - 22, top + 34); x.textAlign = 'left';
        x.fillStyle = LINE; x.fillRect(px + 22, top + 50, cw2 - 44, 1);

        const padX = 34, plotT = top + 92, plotB = top + chH - 46;
        const plotH = plotB - plotT, plotW = cw2 - padX * 2;
        const n = days.length || 1;
        const ceil = Math.max(...days.map(getVal), 1) * 1.18;
        const gx = (i: number) => px + padX + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
        const gy = (v: number) => plotT + (1 - v / ceil) * plotH;
        // 눈금 + 기준선
        x.strokeStyle = LINE; x.lineWidth = 1;
        [0.34, 0.67].forEach((f) => {
          const yy = plotT + f * plotH;
          x.beginPath(); x.moveTo(px + padX, yy); x.lineTo(px + cw2 - padX, yy); x.stroke();
        });
        x.strokeStyle = '#d7d7da';
        x.beginPath(); x.moveTo(px + padX, plotB); x.lineTo(px + cw2 - padX, plotB); x.stroke();
        // ★값이 0인 날도 실제 값(바닥)으로 잇는다 — 건너뛰면 활동 없던 날이 상승선처럼 보인다
        const pts = days.map((d, i) => ({ X: gx(i), Y: gy(getVal(d)), v: getVal(d), i }));
        if (pts.length >= 2) {
          x.beginPath();
          x.moveTo(pts[0].X, plotB);
          pts.forEach((p) => x.lineTo(p.X, p.Y));
          x.lineTo(pts[pts.length - 1].X, plotB);
          x.closePath();
          x.fillStyle = 'rgba(24,24,27,0.06)'; x.fill();
          x.strokeStyle = INK; x.lineWidth = 2.4; x.lineJoin = 'round'; x.lineCap = 'round';
          x.beginPath();
          pts.forEach((p, k) => (k === 0 ? x.moveTo(p.X, p.Y) : x.lineTo(p.X, p.Y)));
          x.stroke();
        }
        x.textAlign = 'center';
        pts.forEach((p) => {
          const isToday = p.i === pts.length - 1;
          if (p.v > 0) {
            x.fillStyle = isToday ? INK : '#fff'; x.strokeStyle = INK; x.lineWidth = 2.4;
            x.beginPath(); x.arc(p.X, p.Y, isToday ? 6 : 4.5, 0, Math.PI * 2); x.fill();
            if (!isToday) x.stroke();
            // 값 라벨 — 선·면적 위에 겹쳐도 읽히도록 흰 후광을 두른다
            x.font = `${isToday ? 800 : 700} 14px ${F}`;
            x.strokeStyle = '#fff'; x.lineWidth = 3.5; x.lineJoin = 'round';
            x.strokeText(fmt(p.v), p.X, p.Y - 14);
            x.fillStyle = INK; x.fillText(fmt(p.v), p.X, p.Y - 14);
          }
          x.fillStyle = isToday ? INK : INK3; x.font = `${isToday ? 800 : 600} 14px ${F}`;
          x.fillText(days[p.i].label, p.X, plotB + 26);
        });
        x.textAlign = 'left';
      };
      const tS = days.reduce((s, d) => s + d.solved, 0);
      const tW = days.reduce((s, d) => s + d.watchMin, 0);
      drawTrend(M, '문제 풀이', (d) => d.solved, (v) => `${v}문제`, `${tS}문제`);
      drawTrend(M + cw2 + gap, '강의 시청', (d) => d.watchMin, (v) => `${v}분`, `${tW}분`);
      y = top + chH + 38;
    } else {
      emptyNote('아직 최근 7일 학습 기록이 없습니다.');
    }
  }

  /* ===== ③ 전체 강의 수강 현황 ===== */
  secHead('전체 강의 수강 현황', '수강 중인 코스의 강의 전체를 기준으로 한 진행률입니다.');
  if (r.lectures) {
    const L = r.lectures;
    const notStarted = Math.max(0, L.total - L.done - L.watching);
    const ch = 168;
    ensure(ch + 44);
    card(M, y, CW, ch);
    x.fillStyle = INK2; x.font = `700 17px ${F}`; x.fillText('완주한 강의', M + 26, y + 44);
    const labW = x.measureText('완주한 강의').width;
    x.fillStyle = INK; x.font = `800 15px ${F}`;
    x.fillText(`${L.done} / ${L.total}강`, M + 26 + labW + 14, y + 44);
    x.textAlign = 'right'; x.fillStyle = INK; x.font = `800 40px ${F}`;
    x.fillText(`${L.pct}%`, W - M - 26, y + 52); x.textAlign = 'left';
    bar(M + 26, y + 66, CW - 52, 12, L.pct);
    // 완주 / 시청 중 / 시작 전 3분할
    const segs: [string, string][] = [
      ['완주', `${L.done}강`],
      ['시청 중', `${L.watching}강`],
      ['시작 전', `${notStarted}강`],
    ];
    const sw = (CW - 52) / 3;
    segs.forEach(([lb, vl], i) => {
      const sx = M + 26 + i * sw + (i ? 18 : 0);
      if (i > 0) { x.fillStyle = LINE; x.fillRect(M + 26 + i * sw - 1, y + 100, 1, 44); }
      x.fillStyle = INK3; x.font = `700 14px ${F}`; x.fillText(lb, sx, y + 118);
      x.fillStyle = INK; x.font = `800 22px ${F}`; x.fillText(vl, sx, y + 148);
    });
    y += ch + 38;
  } else {
    emptyNote('아직 강의 시청 기록이 없습니다.');
  }

  /* ===== ④ 코스별 진행도 ===== */
  secHead('코스별 진행도', '코스마다 완주한 강의 비율입니다.');
  if (r.courseProgress.length) {
    r.courseProgress.forEach((cp) => {
      const rh = 64;
      ensure(rh);
      x.fillStyle = INK; x.font = `700 17px ${F}`;
      x.fillText(ell(cp.title, CW - 260), M, y + 18);
      x.textAlign = 'right';
      const pctTxt = `${cp.pct}%`;
      x.fillStyle = INK; x.font = `800 17px ${F}`; x.fillText(pctTxt, W - M, y + 18);
      const pw = x.measureText(pctTxt).width;
      x.fillStyle = INK3; x.font = `600 15px ${F}`;
      x.fillText(`${cp.done}/${cp.total}강`, W - M - pw - 12, y + 18);
      x.textAlign = 'left';
      bar(M, y + 32, CW, 10, cp.pct);
      y += rh;
    });
    y += 10;
  } else {
    emptyNote('아직 수강 중인 코스가 없습니다.');
  }

  /* ===== ⑤ 수료 현황 ===== */
  secHead('수료 현황', '수료 시험을 통과한 코스입니다.');
  if (r.completions.length) {
    ensure(34);
    x.fillStyle = INK2; x.font = `700 16px ${F}`;
    x.fillText(`수료한 코스 ${r.completions.length}개`, M, y + 4);
    y += 30;
    r.completions.forEach((cp) => {
      const rh = 54;
      ensure(rh);
      card(M, y, CW, 48);
      // 그린 체크 배지
      x.fillStyle = OK; x.beginPath(); x.arc(M + 32, y + 24, 12, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#fff'; x.lineWidth = 2.6; x.lineJoin = 'round'; x.lineCap = 'round';
      x.beginPath(); x.moveTo(M + 26, y + 24); x.lineTo(M + 30.5, y + 28.5); x.lineTo(M + 38, y + 19); x.stroke();
      // 날짜(오른쪽 끝) → 배지(그 왼쪽) → 제목(남는 폭)
      x.textAlign = 'right';
      x.fillStyle = INK3; x.font = `600 14px ${F}`;
      if (cp.at) x.fillText(cp.at, W - M - 22, y + 30);
      const dw = cp.at ? x.measureText(cp.at).width + 14 : 0;
      x.textAlign = 'left';
      const badge = cp.perfect ? '만점 수료' : '수료';
      x.font = `800 13px ${F}`;
      const bw = x.measureText(badge).width + 20;
      const bx = W - M - 22 - dw - bw;
      rr(bx, y + 14, bw, 22, 11); x.fillStyle = cp.perfect ? OK : FILL; x.fill();
      x.fillStyle = cp.perfect ? '#fff' : INK2; x.font = `800 13px ${F}`;
      x.fillText(badge, bx + 10, y + 29);
      x.fillStyle = INK; x.font = `700 17px ${F}`;
      x.fillText(ell(cp.title, bx - (M + 56) - 16), M + 56, y + 30);
      y += rh;
    });
  } else {
    emptyNote('아직 수료한 코스가 없습니다.');
  }

  finishPage();
  return pages;
}

/** 학습 리포트 PDF 저장 — 페이지 수만큼 A4로 담는다. */
export async function learningReportPdf(filename: string, r: LearningReport) {
  const pages = renderLearningReportPages(r);
  const jsPDF = await loadJsPDF();
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: [RPT_W, RPT_H],
    hotfixes: ['px_scaling'],
  });
  pages.forEach((c, i) => {
    if (i > 0) pdf.addPage([RPT_W, RPT_H], 'portrait');
    pdf.addImage(c.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, RPT_W, RPT_H);
  });
  pdf.save(filename);
}
