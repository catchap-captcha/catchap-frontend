import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './styles/globals.css';
import App from './App.tsx';

// 에러 트래킹 — VITE_SENTRY_DSN이 있으면 활성, 없으면 no-op. 아동 PII 보호를 위해
// sendDefaultPii=false(요청/유저 기본 미첨부). DSN은 빌드타임 주입(다른 VITE_* 와 동일).
const _sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (_sentryDsn) {
  Sentry.init({
    dsn: _sentryDsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
}

// 새 배포로 옛 청크(코드 분할) 해시가 사라지면 지연 로드 라우트가 로드에 실패한다 —
// 지금까진 화면이 안 뜨고 사용자가 '수동 새로고침'해야 했다(모든 페이지 새로고침해야 보이던 증상).
// Vite의 preload 실패 이벤트를 잡아 '한 번만' 자동 새로고침해 새 index.html·새 청크를 받게 한다.
// 10초 스로틀로 무한 새로고침 루프를 막는다(새로고침해도 안 고쳐지는 진짜 오류면 멈춘다).
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault(); // Vite의 미처리 오류 throw 억제(어차피 새로고침한다)
  const KEY = 'catchap_chunk_reload_at';
  const last = Number(sessionStorage.getItem(KEY) || '0');
  if (Date.now() - last > 10_000) {
    sessionStorage.setItem(KEY, String(Date.now()));
    window.location.reload();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
