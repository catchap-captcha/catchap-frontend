import { useEffect } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import AppRoutes from './routes';
import ForcePasswordGate from './components/auth/ForcePasswordGate';
import './styles/page-enter.css';
import { AuthProvider } from './stores/authStore';
import { StudentSettingsProvider } from './stores/studentSettingsStore';

/** 라우트 전환 시 항상 맨 위에서 시작 (설정 등 페이지가 중간부터 보이는 문제 방지) */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/**
 * 라우트 전환 시 페이지가 부드럽게 페이드-인.
 * pathname을 key로 줘 새 페이지 마운트마다 애니메이션 재생.
 * ※ transform이 아닌 opacity만 사용 → sticky/fixed 요소에 영향 없음.
 */
function AnimatedRoutes() {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="cc-page-enter">
      <AppRoutes />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StudentSettingsProvider>
          <ScrollToTop />
          <AnimatedRoutes />
          <ForcePasswordGate />
        </StudentSettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
