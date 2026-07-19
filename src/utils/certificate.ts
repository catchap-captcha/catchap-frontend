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
// 수료증(가로) 캔버스 크기 — A4 가로 비율(√2)에 근접
const W2 = 1600;
const H2 = 1130;

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

/** 코스 수료증 데이터 — 서버(GET .../exam/certificate)가 수료 검증 후 내려준 값 그대로. */
export interface CourseCertificateData {
  studentName: string; // 가명(nickname)
  courseTitle: string;
  subject: string;
  instructorName: string;
  passedAt: string; // ISO — 발급일이 아니라 수료일을 싣는다(불변)
  perfect: boolean;
  questionCount: number;
  serial: string; // 검증용 일련번호
}

/**
 * 코스 수료증 — 성인 학습자용 정식 수료증(어린이 '상장'과 별개 디자인).
 *
 * 왜 별도 함수인가: drawCertificate는 게임 시절 어린이 상장('~어린이', 별·이모지)이라 시청
 * 검증 인강의 수료 증명에는 톤이 안 맞는다. 수료증은 코스명·학습자·수료일·일련번호를 담은
 * 차분한 문서 톤으로 그린다. 완벽 통과는 금색 강조, 일반 수료는 청록 강조로 구분한다.
 * 한글 폰트 임베딩 문제를 피하려 캔버스로 그려 이미지로 PDF에 싣는다(pdf.ts canvasToPdf).
 */
export function drawCourseCertificate(d: CourseCertificateData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = W2;
  canvas.height = H2;
  const ctx = canvas.getContext('2d')!;
  const F = "'Pretendard', 'Malgun Gothic', sans-serif";
  const accent = d.perfect ? '#C79A2E' : '#17806A'; // 완벽=금색 / 일반=청록
  const accentSoft = d.perfect ? '#F6ECCF' : '#DDF1EB';

  // 바탕
  ctx.fillStyle = '#FFFEFB';
  ctx.fillRect(0, 0, W2, H2);

  // 이중 테두리(문서 톤)
  ctx.strokeStyle = accent;
  ctx.lineWidth = 8;
  roundRect(ctx, 40, 40, W2 - 80, H2 - 80, 14);
  ctx.stroke();
  ctx.strokeStyle = accentSoft;
  ctx.lineWidth = 2;
  roundRect(ctx, 62, 62, W2 - 124, H2 - 124, 10);
  ctx.stroke();

  ctx.textAlign = 'center';

  // 상단 브랜드
  ctx.fillStyle = '#FF5A4D';
  ctx.font = `900 34px ${F}`;
  ctx.fillText('CatChap · 캣챱', W2 / 2, 150);

  // 제목
  ctx.fillStyle = '#20242E';
  ctx.font = `900 84px ${F}`;
  ctx.fillText('수료증', W2 / 2, 268);
  ctx.fillStyle = accent;
  ctx.font = `700 26px ${F}`;
  ctx.fillText('CERTIFICATE OF COMPLETION', W2 / 2, 312);

  // 완벽 통과 리본
  if (d.perfect) {
    const label = '완벽 통과';
    ctx.font = `800 26px ${F}`;
    const tw = ctx.measureText(label).width;
    const bw = tw + 96;
    roundRect(ctx, W2 / 2 - bw / 2, 344, bw, 52, 26);
    ctx.fillStyle = accentSoft;
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.fillText('👑 ' + label, W2 / 2, 379);
  }

  // 학습자
  const nameY = d.perfect ? 470 : 448;
  ctx.fillStyle = '#5B6270';
  ctx.font = `600 30px ${F}`;
  ctx.fillText('아래 학습자는', W2 / 2, nameY);
  ctx.fillStyle = '#20242E';
  ctx.font = `900 64px ${F}`;
  ctx.fillText(d.studentName, W2 / 2, nameY + 82);
  // 이름 밑줄
  ctx.strokeStyle = accentSoft;
  ctx.lineWidth = 3;
  const nw = Math.max(260, ctx.measureText(d.studentName).width + 80);
  ctx.beginPath();
  ctx.moveTo(W2 / 2 - nw / 2, nameY + 100);
  ctx.lineTo(W2 / 2 + nw / 2, nameY + 100);
  ctx.stroke();

  // 코스명 + 본문
  ctx.fillStyle = '#5B6270';
  ctx.font = `600 30px ${F}`;
  ctx.fillText('아래 코스의 모든 수료 시험을 정복하여', W2 / 2, nameY + 168);
  ctx.fillStyle = accent;
  ctx.font = `900 46px ${F}`;
  // 코스명이 길면 줄이지 말고 폭에 맞춰 축소(수료증은 코스명이 핵심)
  let cf = 46;
  while (cf > 26 && ctx.measureText(`「${d.courseTitle}」`).width > W2 - 260) {
    cf -= 2;
    ctx.font = `900 ${cf}px ${F}`;
  }
  ctx.fillText(`「${d.courseTitle}」`, W2 / 2, nameY + 230);
  ctx.fillStyle = '#5B6270';
  ctx.font = `600 30px ${F}`;
  ctx.fillText(
    `과목: ${d.subject} · 시험 문항 ${d.questionCount}개 정복 · 이 과정을 성실히 마쳤음을 증명합니다.`,
    W2 / 2,
    nameY + 288,
  );

  // 하단: 수료일 · 강사 · 일련번호
  const [py, pm, pd] = (d.passedAt.slice(0, 10) || '')
    .split('-')
    .map((n) => parseInt(n, 10));
  ctx.fillStyle = '#3A3F4C';
  ctx.font = `700 30px ${F}`;
  ctx.fillText(
    py ? `수료일  ${py}년 ${pm}월 ${pd}일` : '수료 완료',
    W2 / 2,
    H2 - 168,
  );
  ctx.fillStyle = '#7A8090';
  ctx.font = `600 24px ${F}`;
  ctx.fillText(`발급  ${d.instructorName} · CatChap`, W2 / 2, H2 - 128);

  // 인장(원형 실링)
  const sx = W2 - 220;
  const sy = H2 - 180;
  ctx.beginPath();
  ctx.arc(sx, sy, 66, 0, Math.PI * 2);
  ctx.fillStyle = accentSoft;
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.font = `900 30px ${F}`;
  ctx.fillText('수료', sx, sy - 4);
  ctx.font = `800 16px ${F}`;
  ctx.fillText('CatChap', sx, sy + 26);

  // 일련번호(좌하단, 작게)
  ctx.fillStyle = '#A2A8B6';
  ctx.font = `600 20px ${F}`;
  ctx.textAlign = 'left';
  ctx.fillText(`No. ${d.serial}`, 110, H2 - 92);
  ctx.textAlign = 'left';

  return canvas;
}
