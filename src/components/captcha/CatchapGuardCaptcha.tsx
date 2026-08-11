import { useEffect, useRef, useState } from 'react';
import './CatchapGuardCaptcha.css';

/**
 * CatchapGuardCaptcha — 로그인 스텝업에 "CatChap Guard"(성원/민서) 캡차를 붙인다.
 *
 * 왜 iframe 을 직접 그리는가: 배포된 로더 `widget.js` 는 iframe src 를
 * `<origin>/?embed=1&lecture=<id>` 로만 만든다. `purpose` 를 붙일 자리가 없는데,
 * 토큰 검증(`POST /api/verify-token`)이 발급 때의 `purpose` 와 대조하므로 로그인은
 * `purpose=login` 으로 발급받아야 한다. 그래서 로더를 거치지 않고 같은 규약의
 * iframe 을 직접 만든다. 로더가 쓰는 `window.catchapOnVerified` 는 문서 전역이라
 * 화면이 여럿이면 서로 덮어쓰는 문제도 함께 피한다(`CollectCaptcha` 주석 참조).
 *
 * 캡차 쪽 계약(실측 2026-08-11):
 *   · `?embed=1&purpose=login` — purpose 는 캡차 프론트가 URL 에서 읽는다.
 *   · 통과하면 부모로 postMessage:
 *       { type: 'catchap-verified', token, lecture_id, session_id, purpose }
 *   · 캡차는 허용 출처(`/api/config` 의 embedOrigins)로만 postMessage 한다.
 *     현재 `https://www.catchap5.com`, `https://catchap5.com` 이 등록돼 있다.
 *
 * 백엔드가 함께 있어야 동작한다: 이 위젯의 토큰은 백엔드가 캡차 서버에
 * `POST /api/verify-token` 으로 물어봐야 유효해진다(`session_id`·`purpose` 동반 필수,
 * 토큰은 1회용). 규약은 `ai-service/docs/SPEC_BACKEND_CAPTCHA_20260804.md` 에 있다.
 * 그래서 이 컴포넌트는 `VITE_LOGIN_CAPTCHA=catchap` 일 때만 쓰인다 — 기본값에서는
 * 기존 캡차가 그대로 뜬다.
 */

const GUARD_ORIGIN =
  (import.meta.env.VITE_COLLECT_CAPTCHA_ORIGIN as string | undefined) ?? 'https://captcha.catchap5.com';

export interface GuardVerification {
  token: string;
  sessionId: string;
  purpose: string;
}

interface Props {
  onToken: (token: string, meta?: GuardVerification) => void;
  onClose?: () => void;
}

export default function CatchapGuardCaptcha({ onToken, onClose }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      // 출처와 창을 둘 다 확인한다 — 출처만 보면 같은 오리진의 다른 창이 위조할 수 있다.
      if (e.origin !== GUARD_ORIGIN) return;
      if (iframeRef.current && e.source !== iframeRef.current.contentWindow) return;
      const data = e.data as Record<string, unknown> | null;
      if (!data || data.type !== 'catchap-verified') return;
      const token = typeof data.token === 'string' ? data.token : '';
      const sessionId = typeof data.session_id === 'string' ? data.session_id : '';
      const purpose = typeof data.purpose === 'string' ? data.purpose : 'login';
      // session_id 없이 보내면 백엔드 검증이 반드시 실패한다. 조용히 실패시키지 않는다.
      if (!token || !sessionId) {
        setFailed(true);
        return;
      }
      onToken(token, { token, sessionId, purpose });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onToken]);

  return (
    <div className="cg-wrap">
      {onClose && (
        <button type="button" className="cg-close" onClick={onClose} aria-label="닫기">
          <i className="ph-bold ph-x" />
        </button>
      )}
      <iframe
        ref={iframeRef}
        title="CatChap Guard 확인"
        src={`${GUARD_ORIGIN}/?embed=1&purpose=login`}
        className="cg-frame"
        sandbox="allow-scripts allow-same-origin"
      />
      {failed && (
        <p className="cg-error" role="status">
          확인 정보를 받지 못했어요. 잠시 후 다시 시도해 주세요.
        </p>
      )}
    </div>
  );
}
