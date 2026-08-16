import { useState } from 'react';

import { CAPTCHA_PRODUCT_META, type CaptchaProduct } from '../../constants/captchaProducts';
import './CaptchaSetupGuide.css';

/**
 * 「발급한 키를 남의 사이트에 어떻게 붙이나」를 처음 보는 운영자도 알 수 있게 적는다.
 *
 * ★왜 필요한가 — 0816 확인: 발급 화면에 임베드 코드 버튼만 있고
 *   ① 이게 무슨 캡차인지 ② 붙이면 화면이 어떻게 바뀌는지 ③ 어디에 넣는지
 *   ④ 서버에서 마지막으로 확인하는 절차가 ★아무 데도 없었다.
 *   운영자가 붙이는 쪽에 안내하려면 이 화면만 보고 설명할 수 있어야 한다.
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

  const serverSnippet = `# ③ 붙이는 사이트의 서버에서 마지막 확인 (★이 단계를 빼면 캡차가 무의미합니다)
#    폼이 제출되면 catchap-token 이라는 값이 같이 옵니다. 그걸 우리에게 물어보세요.
curl -X POST ${apiBase}/captcha/v1/validate \
  -H "Content-Type: application/json" \
  -H "X-Secret-Key: sk_...(발급 때 한 번만 보여 준 비밀키)" \
  -d '{"verdict_token": "<폼으로 받은 catchap-token 값>"}'

# 응답: {"success": true}  → 통과시킨다
#       {"success": false} → ★막는다 (200 이라고 통과시키면 안 됩니다)
# 토큰은 한 번만 쓸 수 있고, 짧게 만료됩니다.`;

  return (
    <section className="csg">
      <button type="button" className="csg-toggle" onClick={() => setOpen((v) => !v)}>
        <i className={`ph-bold ${open ? 'ph-caret-down' : 'ph-caret-right'}`} />
        다른 사이트에 붙이는 법 — 3단계
        <span className="csg-toggle-sub">발급한 키를 그 사이트에 넣는 순서</span>
      </button>

      {open && (
        <div className="csg-body">
          {meta && (
            <p className="csg-what">
              <b>{meta.label}</b> — {meta.detail}
            </p>
          )}

          <ol className="csg-flow">
            <li>
              <b>사용자가 캡차를 푼다</b>
              <span>그 사이트에 우리 위젯이 뜨고, 사용자가 문제를 풉니다.</span>
            </li>
            <li>
              <b>우리 서버가 채점해 표를 준다</b>
              <span>
                맞으면 <code>catchap-token</code> 이 폼에 심깁니다. 이 표는 <b>한 번만</b> 쓸 수
                있고 짧게 만료됩니다.
              </span>
            </li>
            <li>
              <b>그 사이트의 서버가 그 표를 우리에게 확인받는다</b>
              <span>
                ★이 단계를 빼면 누구나 표를 지어내 보낼 수 있습니다. 반드시 서버에서 확인하세요.
              </span>
            </li>
          </ol>

          <div className="csg-block">
            <div className="csg-block-h">
              <b>그 사이트의 화면(HTML)에 넣을 것</b>
              <span>가입·로그인 폼 안, 제출 버튼 위</span>
            </div>
            <pre className="csg-pre">{htmlSnippet}</pre>
          </div>

          <div className="csg-block">
            <div className="csg-block-h">
              <b>그 사이트의 서버에서 마지막 확인</b>
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
