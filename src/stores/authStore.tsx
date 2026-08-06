import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { client, clearTokens, getAccessToken, setTokens } from '../api/client';
import type { LoginRequest, MeResponse, StudentLoginRequest, TokenPair } from '../types/auth';

interface AuthContextValue {
  me: MeResponse | null;
  loading: boolean;
  login: (req: LoginRequest) => Promise<MeResponse>;
  opsLogin: (email: string, password: string, captchaToken?: string) => Promise<MeResponse>;
  studentLogin: (req: StudentLoginRequest) => Promise<MeResponse>;
  // 공개 로그인 폼(/login) 단일 진입 — 서버가 학생·강사를 판별(운영자 제외).
  publicLogin: (req: StudentLoginRequest) => Promise<MeResponse>;
  logout: () => Promise<void>;
  reloadMe: () => Promise<MeResponse | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const reloadMe = useCallback(async () => {
    if (!getAccessToken()) {
      setMe(null);
      setLoading(false);
      return null;
    }
    try {
      const res = await client.get<MeResponse>('/auth/me');
      setMe(res.data);
      return res.data;
    } catch {
      setMe(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadMe();
    const onLogout = () => setMe(null);
    window.addEventListener('catchap:logout', onLogout);
    return () => window.removeEventListener('catchap:logout', onLogout);
  }, [reloadMe]);

  // 브라우저 탭 제목 — 역할별로 바꾼다. 로그아웃·수강생은 '캣챱스터디', 강사/운영자는 포털 표기.
  useEffect(() => {
    const base = '캣챱스터디';
    document.title =
      me?.role === 'instructor'
        ? `${base} - 강사포털`
        : me?.role === 'ops'
          ? `${base} - 운영포털`
          : base;
  }, [me]);

  const login = useCallback(
    async (req: LoginRequest) => {
      const res = await client.post<TokenPair>('/auth/login', req);
      setTokens(res.data.access_token, res.data.refresh_token);
      localStorage.setItem('catchap_login_ts', String(Date.now()));
      const loaded = await reloadMe();
      if (!loaded) throw new Error('로그인 정보를 불러오지 못했어요.');
      return loaded;
    },
    [reloadMe],
  );

  const opsLogin = useCallback(
    async (email: string, password: string, captchaToken?: string) => {
      // 운영자 전용 /ops/login 진입. 공개 로그인 폼(학생·강사)은 publicLogin이 전담한다.
      const res = await client.post<TokenPair>('/auth/ops-login', {
        email,
        password,
        ...(captchaToken ? { captcha_token: captchaToken } : {}),
      });
      setTokens(res.data.access_token, res.data.refresh_token);
      localStorage.setItem('catchap_login_ts', String(Date.now()));
      const loaded = await reloadMe();
      if (!loaded) throw new Error('로그인 정보를 불러오지 못했어요.');
      return loaded;
    },
    [reloadMe],
  );

  const studentLogin = useCallback(
    async (req: StudentLoginRequest) => {
      const res = await client.post<TokenPair>('/auth/student-login', req);
      setTokens(res.data.access_token, res.data.refresh_token);
      localStorage.setItem('catchap_login_ts', String(Date.now()));
      const loaded = await reloadMe();
      if (!loaded) throw new Error('로그인 정보를 불러오지 못했어요.');
      return loaded;
    },
    [reloadMe],
  );

  const publicLogin = useCallback(
    async (req: StudentLoginRequest) => {
      // 서버가 학생·강사를 판별하는 단일 진입(운영자 제외). 프론트 try-then-fallback 대체.
      const res = await client.post<TokenPair>('/auth/public-login', req);
      setTokens(res.data.access_token, res.data.refresh_token);
      localStorage.setItem('catchap_login_ts', String(Date.now()));
      const loaded = await reloadMe();
      if (!loaded) throw new Error('로그인 정보를 불러오지 못했어요.');
      return loaded;
    },
    [reloadMe],
  );

  const logout = useCallback(async () => {
    try {
      await client.post('/auth/logout');
    } catch {
      /* 서버 실패와 무관하게 로컬 세션은 정리 */
    }
    clearTokens();
    localStorage.removeItem('catchap_login_ts');
    localStorage.removeItem('catchap_break_shown');
    setMe(null);
  }, []);

  const value = useMemo(
    () => ({ me, loading, login, opsLogin, studentLogin, publicLogin, logout, reloadMe }),
    [me, loading, login, opsLogin, studentLogin, publicLogin, logout, reloadMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
