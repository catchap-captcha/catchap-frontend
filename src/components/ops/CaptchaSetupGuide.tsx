import { useState } from 'react';

import { CAPTCHA_PRODUCT_META, type CaptchaProduct } from '../../constants/captchaProducts';
import './CaptchaSetupGuide.css';

/**
 * 「이 키를 사이트에 어떻게 붙이나」를 처음 보는 운영자도 알 수 있게 적는다.
 *
 * ★지금 쓰임 — 우리 학생 화면·강의 체크포인트가 이 방식으로 붙어 있다(edu 키, 6만 건 넘게 호출).
 *   밖에 파는 라인은 0716 학습 강화 전환·0720 이수 검증형 포지셔닝으로 접었다.
 *   그래서 이 안내는 "파는 법" 이 아니라 ★"우리가 이렇게 붙였고, 같은 방식으로 다른 사이트에도
 *   붙일 수 있다" 는 기록이다.
 *
 * ★왜 필요한가 — 0816 확인: 발급 화면에 임베드 코드 버튼만 있고
 *   ① 이게 무슨 캡차인지 ② 붙이면 화면이 어떻게 바뀌는지 ③ 어디에 넣는지
 *   ④ 서버에서 마지막으로 확인하는 절차가 ★아무 데도 없었다.
 *   운영자가 이 화면만 보고 「우리가 어떻게 붙였나」를 설명할 수 있어야 한다.
 *
 * ★코드는 하드코딩하지 않는다 — 실제 발급된 키(siteKey)와 이 배포의 API 주소를 그대로 넣는다.
 */
export default function CaptchaSetupGuide({
  apiBase,
  siteKey,
  product,
}: {
  apiBase: string;
  /** 실제 발급된 키. 없으면 자리표시자를 쓰고 "발급 후 채워집니다" 라고 알린다. */
  siteKey?: string;
  product?: CaptchaProduct;
}) {
  const [open, setOpen] = useState(false);
  const key = siteKey || 'ck_...(발급하면 여기에 들어갑니다)';
  const meta = product ? CAPTCHA_PRODUCT_META[product] : null;

  const htmlSnippet = `<!-- ① 캡차가 뜰 자리 — 보통 '가입'·'로그인' 버튼 바로 위 -->
<div class="catchap"
     data-site-key="${key}"
     data-api="${apiBase}"></div>

<!-- ② 페이지 아무 곳(</body> 앞이 무난)에 한 번만 -->
<script src="${apiBase}/widget/catchap-widget.js" defer></script>`;

  const serverSnippet = `# ③ 그 페이지의 서버에서 마지막 확인 (이 단계를 빼면 캡차가 무의미합니다)
#    폼이 제출되면 catchap-token 이라는 값이 같이 옵니다. 그걸 우리에게 물어보세요.
curl -X POST ${apiBase}/captcha/v1/validate \
  -H "Content-Type: application/json" \
  -H "X-Secret-Key: sk_...(발급 때 한 번만 보여 준 비밀키)" \
  -d '{"verdict_token": "<폼으로 받은 catchap-token 값>"}'

# 응답: {"success": true}  → 통과시킨다
#       {"success": false} → 막는다 (200 이라고 통과시키면 안 됩니다)
# 토큰은 한 번만 쓸 수 있고, 짧게 만료됩니다.`;

  return (
    <section className="csg">
      <button type="button" className="csg-toggle" onClick={() => setOpen((v) => !v)}>
        <i className={`ph-bold ${open ? 'ph-caret-down' : 'ph-caret-right'}`} />
        캡차를 사이트에 붙이는 법 — 3단계
        <span className="csg-toggle-sub">우리 학생 화면도 이 방식으로 붙어 있어요</span>
      </button>

      {open && (
        <div className="csg-body">
          <p className="csg-now">
            <b>지금은 우리 사이트에 붙여 쓰고 있어요.</b> 학생 학습 화면과 강의 중간 확인 문항이
            아래 방식 그대로 붙어 있습니다. 밖에 파는 것은 지금 계획에 없지만, 같은 방식으로
            다른 사이트에도 붙일 수 있게 만들어 뒀습니다.
          </p>

          {meta && (
            <p className="csg-what">
              <b>{meta.label}</b> — {meta.detail}
            </p>
          )}

          <div className="csg-source">
            <b>문제는 어디서 오나</b>
            <ul>
              <li>
                <b>봇 차단 캡차</b> — 우리 서버가 그때그때 만듭니다(그림 고르기·간단 셈·따라 그리기).
                붙이는 쪽에서 문제를 넣거나 고를 수는 없습니다.
              </li>
              <li>
                <b>학습 문제 캡차</b> — 우리 <b>문제은행</b>에서 냅니다. 키에 박힌 과목의 문항만
                나오고, 그 과목을 구독해야 열립니다.
              </li>
            </ul>
            <p>
              어느 쪽이든 <b>문제·정답·채점이 전부 우리 서버</b>에 있습니다. 붙인 페이지에는 정답이
              내려가지 않으므로, 페이지를 뜯어봐도 답을 알 수 없습니다.
            </p>
          </div>

          <ol className="csg-flow">
            <li>
              <b>사용자가 캡차를 푼다</b>
              <span>붙인 페이지에 위젯이 뜨고, 사용자가 문제를 풉니다.</span>
            </li>
            <li>
              <b>우리 서버가 채점해 표를 준다</b>
              <span>
                맞으면 <code>catchap-token</code> 이 폼에 심깁니다. 이 표는 <b>한 번만</b> 쓸 수
                있고 짧게 만료됩니다.
              </span>
            </li>
            <li>
              <b>그 페이지의 서버가 표를 우리에게 확인받는다</b>
              <span>
                <b>이 단계를 빼면</b> 누구나 표를 지어내 보낼 수 있습니다. 반드시 서버에서 확인하세요.
              </span>
            </li>
          </ol>

          <div className="csg-block">
            <div className="csg-block-h">
              <b>페이지(HTML)에 넣을 것</b>
              <span>가입·로그인 폼 안, 제출 버튼 위</span>
            </div>
            <pre className="csg-pre">{htmlSnippet}</pre>
          </div>

          <div className="csg-block">
            <div className="csg-block-h">
              <b>그 페이지의 서버에서 마지막 확인</b>
              <span>비밀키(sk_…)는 서버에만 두세요 — 화면에 두면 뚫립니다</span>
            </div>
            <pre className="csg-pre">{serverSnippet}</pre>
          </div>

          <ul className="csg-notes">
            <li>
              <b>허용 도메인</b>을 지정한 키는 그 도메인·서브도메인에서만 뜹니다. 비워 두면 어디서든
              떠서 <b>남이 우리 키를 갖다 쓸 수 있습니다</b> — 실서비스 키는 꼭 지정하세요.
            </li>
            <li>
              <b>site_key</b>는 화면에 드러나도 괜찮습니다(공개값). <b>secret_key</b>는 발급 때 한
              번만 보여 주고 다시 못 봅니다 — 잃어버리면 <b>secret 재발급</b>을 누르세요.
            </li>
            <li>
              붙였는데 안 뜨면 ① 허용 도메인이 맞는지 ② 키가 <b>사용 중</b>인지 ③ 브라우저 콘솔에
              CORS 오류가 있는지 순서로 보세요.
            </li>
          </ul>
        </div>
      )}
    </section>
  );
}
