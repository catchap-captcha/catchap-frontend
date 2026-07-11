/** 상장 PNG 생성 — 학년 랭킹·개근상. 어린이 친화 디자인, 다운로드용. */

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
  ctx.fillStyle = '#FF5A4D';
  ctx.font = `900 42px ${F}`;
  ctx.fillText('CatChap 캣챱', W / 2, 896);
  ctx.textAlign = 'left';

  return canvas;
}
