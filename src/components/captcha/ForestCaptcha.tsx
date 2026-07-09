import { useEffect, useRef } from 'react';

import { client } from '../../api/client';
import './ForestCaptcha.css';

/**
 * ForestCaptcha — 메인 캡차(숲속 마을 동물 방향)를 로그인 흐름에 임베드하는 React 래퍼.
 *
 * 3D 엔진(Three.js)은 정적 번들(public/forest-captcha/)에서 iframe으로 격리 실행하고,
 * 통과 시 위젯이 window.parent.postMessage로 단일사용 captcha_token을 보낸다. 여기서 받아
 * onToken으로 넘기면 로그인 요청에 실어 서버가 검증한다. 정답은 서버에만 있으므로 클라이언트
 * (이 컴포넌트 포함)는 정답을 알지 못한다.
 */
interface Props {
  onToken: (token: string) => void;
  onClose?: () => void;
}

export default function ForestCaptcha({ onToken, onClose }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      // 우리 iframe이 보낸 메시지만 신뢰(source 확인) — 임의 창의 위조 메시지 무시
      if (iframeRef.current && e.source !== iframeRef.current.contentWindow) return;
      const d = e.data;
      if (d && d.type === 'forest-captcha-token' && typeof d.token === 'string') {
        onToken(d.token);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onToken]);

  // 백엔드 base(예: http://localhost:8000/api/v1)를 iframe에 주입 — 위젯 api.js가 ?api=로 읽는다.
  const api = encodeURIComponent(client.defaults.baseURL || '/api/v1');
  const src = `/forest-captcha/index.html?api=${api}`;

  return (
    <div className="fc-wrap">
      <iframe
        ref={iframeRef}
        title="보안 확인 캡차"
        src={src}
        className="fc-iframe"
        // 3D 캔버스만 실행 — 팝업/폼제출/최상위 이동 등은 불필요하므로 최소 권한
        sandbox="allow-scripts allow-same-origin"
      />
      {onClose && (
        <button type="button" className="fc-close" onClick={onClose} aria-label="닫기">
          ✕
        </button>
      )}
    </div>
  );
}
