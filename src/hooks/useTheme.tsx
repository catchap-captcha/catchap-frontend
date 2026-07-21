import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * 테마(라이트/다크) 전역 상태.
 *
 * 왜: 라이트/다크는 앱 전체가 공유하는 단일 상태여야 한다(상단바 토글 → 모든 페이지 반영).
 * document.documentElement 의 data-theme 속성 하나로 styles/theme.css 의 토큰이 통째로 바뀐다.
 * 선택은 localStorage에 저장하고, 최초 방문(저장값 없음)엔 OS 설정(prefers-color-scheme)을 따른다.
 * 공부 키워드: "theme context", "prefers-color-scheme", "FOUC 방지(index.html 인라인 스크립트)".
 */

export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'catchap-theme';

function readInitial(): Theme {
  if (typeof document !== 'undefined') {
    // index.html 인라인 스크립트가 이미 정해둔 값을 그대로 신뢰(깜빡임 방지)
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'light' || attr === 'dark') return attr;
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* localStorage 접근 불가(프라이빗 모드 등) — 무시 */
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}
const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readInitial);

  // 상태 → DOM 속성 + 저장소 + 모바일 브라우저 크롬 색 반영
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#15171e' : '#fbfaf8');
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* 무시 */
    }
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggle = useCallback(() => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')), []);

  return <Ctx.Provider value={{ theme, toggle, setTheme }}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx;
}
