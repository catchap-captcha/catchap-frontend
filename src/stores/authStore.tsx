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
  opsLogin: (email: string, password: string) => Promise<MeResponse>;
  studentLogin: (req: StudentLoginRequest) => Promise<MeResponse>;
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
    async (email: string, password: string) => {
      const res = await client.post<TokenPair>('/auth/ops-login', { email, password });
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
    () => ({ me, loading, login, opsLogin, studentLogin, logout, reloadMe }),
    [me, loading, login, opsLogin, studentLogin, logout, reloadMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
