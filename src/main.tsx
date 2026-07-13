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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
