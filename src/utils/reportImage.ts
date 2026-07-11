/** 학부모 주간 리포트 PNG 생성 — 화면 실데이터를 캔버스로 그려 파일로 저장. */

interface ReportStat {
  label: string;
  value: string | number;
  unit?: string;
  badge?: string;
}
interface ReportBar {
  label: string;
  pct: number;
}

export interface WeeklyReportData {
  childName: string;
  periodLabel: string;
  stats: ReportStat[];
  strengths: ReportBar[];
  weaknesses: ReportBar[];
  recommends: string[];
}

const W = 1080;
const H = 1400;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawWeeklyReport(d: WeeklyReportData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const F = "'Pretendard', 'Malgun Gothic', sans-serif";

  // 배경
  ctx.fillStyle = '#FFF7F0';
  ctx.fillRect(0, 0, W, H);

  // 헤더 배너
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, '#FF7A4D');
  grad.addColorStop(1, '#FF5A4D');
  ctx.fillStyle = grad;
  roundRect(ctx, 40, 40, W - 80, 190, 28);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `900 52px ${F}`;
  ctx.fillText(`${d.childName}의 주간 학습 리포트`, 80, 130);
  ctx.font = `700 28px ${F}`;
  ctx.globalAlpha = 0.92;
  ctx.fillText(`CatChap · ${d.periodLabel}`, 80, 182);
  ctx.globalAlpha = 1;

  // KPI 타일 (최대 4)
  const tiles = d.stats.slice(0, 4);
  const tw = (W - 80 - (tiles.length - 1) * 20) / Math.max(1, tiles.length);
  tiles.forEach((s, i) => {
    const x = 40 + i * (tw + 20);
    ctx.fillStyle = '#fff';
    roundRect(ctx, x, 262, tw, 170, 22);
    ctx.fill();
    ctx.strokeStyle = '#F3E7DA';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#FF5A4D';
    ctx.font = `900 46px ${F}`;
    ctx.fillText(`${s.value}${s.unit ?? ''}`, x + 26, 340);
    ctx.fillStyle = '#8A8070';
    ctx.font = `700 24px ${F}`;
    ctx.fillText(s.label, x + 26, 382);
    if (s.badge) {
      ctx.fillStyle = '#17B08C';
      ctx.font = `800 22px ${F}`;
      ctx.fillText(String(s.badge), x + 26, 414);
    }
  });

  // 강점/보완 바 차트
  const drawBars = (title: string, list: ReportBar[], x: number, color: string) => {
    const bw = (W - 100) / 2;
    ctx.fillStyle = '#fff';
    roundRect(ctx, x, 470, bw, 360, 22);
    ctx.fill();
    ctx.strokeStyle = '#F3E7DA';
    ctx.stroke();
    ctx.fillStyle = '#3A3226';
    ctx.font = `900 30px ${F}`;
    ctx.fillText(title, x + 30, 522);
    list.slice(0, 3).forEach((b, i) => {
      const y = 570 + i * 84;
      ctx.fillStyle = '#5A5248';
      ctx.font = `700 24px ${F}`;
      ctx.fillText(b.label, x + 30, y);
      ctx.fillStyle = '#F1E7DB';
      roundRect(ctx, x + 30, y + 14, bw - 130, 18, 9);
      ctx.fill();
      ctx.fillStyle = color;
      roundRect(ctx, x + 30, y + 14, Math.max(12, (bw - 130) * Math.min(100, b.pct) / 100), 18, 9);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.font = `800 24px ${F}`;
      ctx.fillText(`${b.pct}%`, x + bw - 88, y + 30);
    });
  };
  drawBars('잘하고 있어요', d.strengths, 40, '#17B08C');
  drawBars('조금 더 연습해요', d.weaknesses, 60 + (W - 100) / 2, '#FF922E');

  // 추천 활동
  ctx.fillStyle = '#fff';
  roundRect(ctx, 40, 866, W - 80, 320, 22);
  ctx.fill();
  ctx.strokeStyle = '#F3E7DA';
  ctx.stroke();
  ctx.fillStyle = '#3A3226';
  ctx.font = `900 30px ${F}`;
  ctx.fillText('이번 주 추천 활동', 70, 922);
  ctx.font = `600 26px ${F}`;
  d.recommends.slice(0, 3).forEach((t, i) => {
    const y = 980 + i * 62;
    ctx.fillStyle = '#FF7A4D';
    ctx.beginPath();
    ctx.arc(84, y - 9, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5A5248';
    // 긴 문장은 자르기
    const text = t.length > 42 ? t.slice(0, 42) + '…' : t;
    ctx.fillText(text, 110, y);
  });

  // 푸터
  ctx.fillStyle = '#B0A79B';
  ctx.font = `700 24px ${F}`;
  ctx.fillText('CatChap 캣챱 — 놀면서 배우는 어린이 캡챠 학습', 40, H - 60);
  ctx.textAlign = 'right';
  ctx.fillText(new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }), W - 40, H - 60);
  ctx.textAlign = 'left';

  return canvas;
}
