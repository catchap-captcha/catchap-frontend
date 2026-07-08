import axios, { AxiosError } from 'axios';

const _envBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
// 프로덕션 빌드에서 VITE_API_BASE_URL이 없으면 localhost로 조용히 깨지는 대신 크게 실패시킨다.
if (import.meta.env.PROD && !_envBase) {
  throw new Error(
    'VITE_API_BASE_URL이 설정되지 않았습니다. 배포 빌드에는 백엔드 URL을 반드시 주입해야 합니다.',
  );
}
const BASE_URL = _envBase ?? 'http://localhost:8000';

export const client = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
});

const ACCESS_KEY = 'catchap_access_token';
const REFRESH_KEY = 'catchap_refresh_token';

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

client.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

/** JWT exp가 margin초 안에 끝나는지 — 서명 검증 없이 payload만 읽는다(만료 판단용). */
function tokenExpiringSoon(token: string, marginSec = 60): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp !== 'number' || payload.exp * 1000 - Date.now() < marginSec * 1000;
  } catch {
    return true; // 못 읽으면 갱신 시도
  }
}

/** 항상 유효한 access token을 돌려준다 — 만료 임박 시 refresh 토큰으로 선제 갱신.
 *  캡차 위젯처럼 axios 인터셉터(401 재시도) 밖에서 fetch를 쓰는 소비자용. */
export async function getFreshAccessToken(): Promise<string | null> {
  const token = getAccessToken();
  if (token && !tokenExpiringSoon(token)) return token;
  refreshing = refreshing ?? refreshAccessToken();
  const renewed = await refreshing;
  return renewed ?? getAccessToken();
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    // 무토큰 조기 반환도 try 안에 — finally 밖에서 반환하면 공유 상태(refreshing)에
    // resolved Promise<null>이 영구 잔존해, 재로그인 후에도 갱신이 영영 안 도는 버그가 된다.
    const refresh = localStorage.getItem(REFRESH_KEY);
    if (!refresh) return null;
    const res = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, {
      refresh_token: refresh,
    });
    setTokens(res.data.access_token, res.data.refresh_token);
    return res.data.access_token as string;
  } catch {
    clearTokens();
    return null;
  } finally {
    // 동시 401 폭주 시 in-flight refresh를 공유하고, 완료 후 정확히 한 번만 해제한다.
    refreshing = null;
  }
}

client.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      original &&
      !(original as { _retried?: boolean })._retried &&
      !original.url?.includes('/auth/')
    ) {
      (original as { _retried?: boolean })._retried = true;
      refreshing = refreshing ?? refreshAccessToken();
      const token = await refreshing;
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return client(original);
      }
      window.dispatchEvent(new CustomEvent('catchap:logout'));
    }
    return Promise.reject(error);
  },
);
