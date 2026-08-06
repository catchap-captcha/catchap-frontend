/** 상장 PNG 생성 — 학년 랭킹·개근상. 어린이 친화 디자인, 다운로드용. */

import logoCUrl from '../assets/certificate/logo-c.png';
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
 * 코스 수료증 — 핸드오프 `Catchap Certificate.dc.html`(gold/Garamond, landscape/letter)를
 * 그대로 HTML로 렌더한 뒤 html2canvas로 캔버스화한다.
 *
 * 동적 값은 사용자 요청대로 **학생 이름 · 과목(코스명) · 날짜** 셋뿐이고, 나머지(문구·서명·
 * 크리덴셜 표·씰 등)는 디자인 고정값이다. 캔버스로 직접 그리지 않는 이유: 새 디자인은
 * EB Garamond·Mrs Saint Delafield(필기체)·clip-path 오각형 패널이라 HTML/CSS로만 정확히 난다.
 * ========================================================================== */

/** 코스 수료증 데이터 — 서버(GET .../exam/certificate)가 수료 검증 후 내려준 값 그대로. */
export interface CourseCertificateData {
  studentName: string; // 가명(nickname)
  courseTitle: string;
  subject: string;
  passedAt: string; // ISO — 발급일이 아니라 수료일을 싣는다(불변)
  perfect: boolean;
  questionCount: number;
  serial: string; // 검증용 일련번호
}

// 수료증 전용 웹폰트 — 전역 로드는 렌더블로킹이라 뺐던 이력이 있어(index.html 주석), 수료증을
// 열 때만 지연 로드한다. 실패해도 폴백 스택(serif/sans)으로 렌더된다.
const CERT_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600&family=Space+Grotesk:wght@400;500;700&family=Mrs+Saint+Delafield&family=Noto+Serif+KR:wght@400;500;600&display=swap';

export async function ensureCertFonts(): Promise<void> {
  if (!document.getElementById('cert-fonts')) {
    const link = document.createElement('link');
    link.id = 'cert-fonts';
    link.rel = 'stylesheet';
    link.href = CERT_FONTS_HREF;
    document.head.appendChild(link);
  }
  try {
    await Promise.all([
      document.fonts.load("500 48px 'Noto Serif KR'"),
      document.fonts.load("400 15px 'Noto Serif KR'"),
      document.fonts.load("700 50px 'Space Grotesk'"),
      document.fonts.load("400 58px 'Mrs Saint Delafield'"),
      document.fonts.load("500 32px 'EB Garamond'"),
    ]);
  } catch {
    /* 폰트 로드 실패 시 폴백으로 렌더 */
  }
}

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function esc(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c,
  );
}

/** 한글 이름을 수료증 표기(이름 성 순)로 바꾼다 — '하지영' → '지영 하'. 성은 첫 글자(1자 성
 *  기준으로 대부분 커버). 이미 공백이 있거나(영문 등) 한글이 아니면 원본 그대로 둔다. */
function westernName(name: string): string {
  const t = (name || '').trim();
  if (!t || t.includes(' ') || !/^[가-힣]{2,}$/.test(t)) return t;
  return `${t.slice(1)} ${t.slice(0, 1)}`;
}

/** 참조 HTML 그대로 — 학생 이름·과목(코스명)·날짜만 치환, 나머지는 고정 디자인값. */
export function certHtml(d: CourseCertificateData): string {
  const iso = (d.passedAt || '').slice(0, 10);
  const [y, m, day] = iso.split('-').map((n) => parseInt(n, 10));
  const koDate = y ? `${y}년 ${m}월 ${day}일` : '';
  const enDate = y ? `${String(day).padStart(2, '0')} ${MONTHS_EN[m - 1]} ${y}` : '';
  const year = y || new Date().getFullYear();
  const name = esc(westernName(d.studentName || ''));
  const course = esc(d.courseTitle || '');
  return `<section style="width:1056px;height:816px;font-family:'EB Garamond','Noto Serif KR',serif;color:#232019;background:#fdfcfa;padding:26px;box-sizing:border-box">
  <div style="height:100%;box-sizing:border-box;border:1px solid #c2ae7c;padding:6px">
    <div style="position:relative;height:100%;box-sizing:border-box;border:1px solid rgba(194,174,124,0.45);display:grid;grid-template-columns:1fr 300px;overflow:hidden">
      <div style="position:absolute;top:10px;left:10px;width:22px;height:22px;border-top:2px solid #c2ae7c;border-left:2px solid #c2ae7c"></div>
      <div style="position:absolute;top:10px;right:10px;width:22px;height:22px;border-top:2px solid #c2ae7c;border-right:2px solid #c2ae7c;z-index:2"></div>
      <div style="position:absolute;bottom:10px;left:10px;width:22px;height:22px;border-bottom:2px solid #c2ae7c;border-left:2px solid #c2ae7c"></div>
      <div style="position:absolute;bottom:10px;right:10px;width:22px;height:22px;border-bottom:2px solid #c2ae7c;border-right:2px solid #c2ae7c;z-index:2"></div>
      <img src="${logoCUrl}" alt="" crossorigin="anonymous" style="position:absolute;top:9%;left:50%;transform:translateX(-50%);width:74%;opacity:0.05;filter:grayscale(1);pointer-events:none;user-select:none" />
      <div style="position:relative;display:flex;flex-direction:column;padding:34px 40px 24px 56px;box-sizing:border-box">
        <div style="display:flex;align-items:flex-end;gap:9px">
          <img src="${wordmarkUrl}" alt="CATCHAP" crossorigin="anonymous" style="height:40px;width:auto;display:block" />
          <span style="width:11px;height:11px;border-radius:50%;background:#b39b5b;margin-bottom:5px"></span>
        </div>
        <div style="font-family:'Space Grotesk',sans-serif;font-size:10px;letter-spacing:0.42em;text-transform:uppercase;color:#8b857a;margin-top:13px">Learning &amp; Certification</div>
        <div style="margin-top:auto;padding-top:20px">
          <div style="font-family:'Space Grotesk',sans-serif;font-size:9px;letter-spacing:0.34em;text-transform:uppercase;color:#a08a56">This certifies that</div>
          <div style="font-family:'Noto Serif KR',serif;font-size:48px;font-weight:500;letter-spacing:0.06em;line-height:1.1;margin-top:8px;color:#1d1a14">${name}</div>
          <div style="font-family:'Noto Serif KR',serif;font-size:14.5px;color:#565049;margin-top:16px;letter-spacing:0.01em">위 사람은 아래의 과정을 성실히 이수하였기에 이 증서를 수여합니다.</div>
          <div style="font-size:32px;line-height:1.3;margin-top:12px;max-width:24ch;color:#2a251c">${course}</div>
          <div style="display:flex;align-items:center;gap:7px;margin-top:18px">
            <div style="width:52px;height:1px;background:#a08a56"></div>
            <div style="width:4px;height:4px;background:#a08a56;transform:rotate(45deg)"></div>
            <div style="width:120px;height:1px;background:linear-gradient(90deg,rgba(160,138,86,0.7),rgba(160,138,86,0))"></div>
          </div>
          <div style="font-family:'Noto Serif KR',serif;font-size:12.5px;color:#7a746a;margin-top:14px;letter-spacing:0.02em">Catchap에서 인증하고 제공하는 온라인 강좌 · 수료일 ${koDate}</div>
        </div>
        <div style="margin-top:auto;padding-top:26px;display:flex;align-items:flex-end;justify-content:space-between;gap:36px">
          <div style="min-width:280px">
            <div style="font-family:'Mrs Saint Delafield',cursive;font-size:58px;line-height:0.9;color:#1d2a35;padding-left:8px;transform:rotate(-4deg);transform-origin:left bottom;letter-spacing:0.01em">Catchap</div>
            <div style="border-top:1px solid rgba(160,138,86,0.6);margin-top:10px;padding-top:9px;font-size:12.5px;color:#565049;line-height:1.55">
              <div style="font-weight:600;letter-spacing:0.01em">Amanda Brophy</div>
              <div style="color:#8b857a">Global Director, Catchap Career Certificates</div>
              <div style="font-family:'Noto Serif KR',serif;color:#a09a8c;margin-top:2px">주식회사 캣챱 · Catchap Inc.</div>
            </div>
          </div>
          <div style="text-align:right;font-size:11.5px;color:#8b857a;line-height:1.7">
            <div style="font-family:'Space Grotesk',sans-serif;letter-spacing:0.28em;text-transform:uppercase;font-size:9px;color:#a09a8c">Verify at</div>
            <div style="font-size:12.5px;letter-spacing:0.01em;border-bottom:1px solid rgba(160,138,86,0.35);color:#8c7a45;display:inline-block">catchap.com/verify/1A7DM0R1VK34</div>
            <div style="font-family:'Noto Serif KR',serif;max-width:34ch;margin-top:4px">Catchap에서 이 사용자의 신원과 강좌 참여 상태를 확인하였습니다.</div>
          </div>
        </div>
        <div style="font-family:'Noto Serif KR',serif;font-size:9px;line-height:1.7;color:#aaa496;margin-top:14px;border-top:1px solid rgba(160,138,86,0.22);padding-top:10px;margin-right:-34px">
          이 인증서는 학습자가 Catchap을 통해 제공된 온라인 강좌/프로젝트를 완료했음을 증명합니다. 이 인증서는 대학이나 기관에 정식으로 등록한 것으로 간주되지 않으며, 그 자체로 학점, 성적 또는 학위를 부여하지 않습니다.
        </div>
      </div>
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;background:linear-gradient(155deg,#fdfbf6 0%,#f6f1e6 46%,#efe7d7 100%);clip-path:polygon(0 0,100% 0,100% 82%,50% 100%,0 82%);overflow:hidden;box-shadow:inset 1px 0 0 rgba(160,138,86,0.35)">
        <div style="position:absolute;inset:0;opacity:0.9;background:repeating-linear-gradient(45deg,rgba(160,138,86,0.05) 0 0.5px,transparent 0.5px 7px),repeating-linear-gradient(-45deg,rgba(160,138,86,0.04) 0 0.5px,transparent 0.5px 7px),repeating-radial-gradient(circle at 50% 33%,rgba(160,138,86,0.07) 0 0.5px,transparent 0.5px 13px)"></div>
        <div style="position:absolute;top:9px;left:9px;right:9px;bottom:9px;border:1px solid rgba(160,138,86,0.28);clip-path:polygon(0 0,100% 0,100% 80%,50% 99%,0 80%);pointer-events:none"></div>
        <div style="position:relative;width:100%;background:#131c26;border-bottom:1px solid rgba(160,138,86,0.4);padding:12px 0;text-align:center">
          <div style="font-family:'Space Grotesk',sans-serif;font-size:8.5px;letter-spacing:0.46em;text-transform:uppercase;color:#d8c391">Catchap Academy</div>
        </div>
        <div style="position:relative;display:flex;flex-direction:column;align-items:center;padding:22px 26px 0;width:100%;box-sizing:border-box">
          <div style="font-family:'Space Grotesk',sans-serif;font-size:17px;font-weight:400;letter-spacing:0.34em;text-transform:uppercase;text-align:center;line-height:1.8;color:#2a251c">Course<br />Certificate</div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:14px">
            <div style="width:40px;height:1px;background:rgba(160,138,86,0.6)"></div>
            <div style="width:5px;height:5px;background:#a08a56;transform:rotate(45deg)"></div>
            <div style="width:40px;height:1px;background:rgba(160,138,86,0.6)"></div>
          </div>
          <div style="margin-top:18px;width:172px;height:172px;border-radius:50%;border:1px dashed rgba(160,138,86,0.5);display:flex;align-items:center;justify-content:center;background:radial-gradient(circle,#fffdf9 60%,rgba(255,255,255,0.35) 100%)">
            <div style="width:140px;height:140px;border-radius:50%;border:3px double #a08a56;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px">
              <div style="font-family:'Space Grotesk',sans-serif;font-size:6.5px;letter-spacing:0.14em;text-transform:uppercase;color:#8c7a45;max-width:112px;text-align:center">Education for everyone</div>
              <div style="font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#2b2a26">catchap</div>
              <div style="width:26px;height:1px;background:rgba(160,138,86,0.7)"></div>
              <div style="font-family:'Space Grotesk',sans-serif;font-size:6.5px;letter-spacing:0.14em;text-transform:uppercase;color:#8c7a45;max-width:112px;text-align:center">Verified ${year}</div>
            </div>
          </div>
          <div style="width:100%;margin-top:22px;display:grid;gap:9px;font-family:'Space Grotesk',sans-serif;font-size:9.5px">
            <div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid rgba(160,138,86,0.28);padding-bottom:6px"><span style="letter-spacing:0.16em;text-transform:uppercase;color:#948d7d">Credential ID</span><span style="font-weight:500;color:#2b2a26">1A7DM0R1VK34</span></div>
            <div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid rgba(160,138,86,0.28);padding-bottom:6px"><span style="letter-spacing:0.16em;text-transform:uppercase;color:#948d7d">Issued</span><span style="font-weight:500;color:#2b2a26">${enDate}</span></div>
            <div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid rgba(160,138,86,0.28);padding-bottom:6px"><span style="letter-spacing:0.16em;text-transform:uppercase;color:#948d7d">Level</span><span style="font-weight:500;color:#2b2a26">Professional</span></div>
            <div style="display:flex;justify-content:space-between;align-items:baseline"><span style="letter-spacing:0.16em;text-transform:uppercase;color:#948d7d">Hours</span><span style="font-weight:500;color:#2b2a26">32</span></div>
          </div>
          <div style="margin-top:16px;font-family:'Space Grotesk',sans-serif;font-size:5.5px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(120,105,70,0.42);text-align:center;line-height:1.6;width:230px;white-space:nowrap;overflow:hidden">CATCHAP·AUTHENTIC·CATCHAP·AUTHENTIC·CATCHAP</div>
        </div>
      </div>
    </div>
  </div>
</section>`;
}

/**
 * 코스 수료증 캔버스 — 참조 HTML을 오프스크린에 렌더한 뒤 html2canvas로 캡처한다.
 * 반환 타입(Promise<canvas>)은 종전과 같아 호출부(CertificateModal, pdf.ts)는 그대로 쓴다.
 */
export async function drawCourseCertificate(d: CourseCertificateData): Promise<HTMLCanvasElement> {
  await ensureCertFonts();
  const host = document.createElement('div');
  host.style.cssText =
    'position:fixed;left:-99999px;top:0;z-index:-1;width:1056px;height:816px;pointer-events:none';
  host.innerHTML = certHtml(d);
  document.body.appendChild(host);
  try {
    // 워터마크 로고가 다 실린 뒤 캡처(빈 이미지 방지)
    const img = host.querySelector('img');
    if (img && !img.complete) {
      await new Promise<void>((res) => {
        img.addEventListener('load', () => res(), { once: true });
        img.addEventListener('error', () => res(), { once: true });
      });
    }
    const html2canvas = (await import('html2canvas')).default;
    return await html2canvas(host.firstElementChild as HTMLElement, {
      scale: 2,
      backgroundColor: '#fdfcfa',
      useCORS: true,
      logging: false,
      width: 1056,
      height: 816,
      windowWidth: 1056,
      windowHeight: 816,
    });
  } finally {
    host.remove();
  }
}
