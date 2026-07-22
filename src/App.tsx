import { useEffect } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import AppRoutes from './routes';
import ForcePasswordGate from './components/auth/ForcePasswordGate';
import ThemeToggle from './components/common/ThemeToggle';
import { useAuth } from './hooks/useAuth';
import './styles/page-enter.css';
import { AuthProvider } from './stores/authStore';
import { StudentSettingsProvider } from './stores/studentSettingsStore';
import { ThemeProvider } from './hooks/useTheme';

/** 로그인 전 모든 화면(공개·인증·404)에 라이트/다크 토글을 상단 우측에 고정 노출한다.
 *  로그인 후에는 각 레이아웃(학생 상단바·ops 사이드바)에 이미 토글이 있어 중복을 피해 숨긴다.
 *  (사용자 요구: 로그인 여부와 무관하게 테마 토글이 항상 상단에 있어야 한다.) */
function GlobalThemeToggle() {
  const { me, loading } = useAuth();
  if (loading || me) return null;
  return <ThemeToggle className="theme-toggle--fixed" />;
}

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
      <ThemeProvider>
        <AuthProvider>
          <StudentSettingsProvider>
            <ScrollToTop />
            <AnimatedRoutes />
            <GlobalThemeToggle />
            <ForcePasswordGate />
          </StudentSettingsProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
