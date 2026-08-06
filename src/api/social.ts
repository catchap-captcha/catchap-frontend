/**
 * 소셜 로그인(카카오·네이버·구글) API.
 *
 * 흐름은 백엔드 docs/social-login-design.md 와 1:1이다:
 *   authorize → (provider 동의 화면) → callback → logged_in | signup_required → signup
 *
 * redirect_uri는 **보내지 않는다.** 서버가 허용목록(SOCIAL_REDIRECT_URIS)의 기본값을 쓰고
 * state 안에 박아 콜백에서 대조한다 — 프론트가 임의 주소를 보내면 목록 밖이라 400이 되고,
 * 보낼 이유도 없다(콜백 경로는 하나다).
 */
import { client } from './client';
import type { TokenPair } from '../types/auth';

export type SocialProvider = 'kakao' | 'naver' | 'google';

export interface SocialProviderInfo {
  provider: SocialProvider;
  label: string;
  /** 서버에 키가 설정된 provider만 true — false면 버튼을 그리지 않는다 */
  enabled: boolean;
}

export interface SocialAuthorizeResponse {
  provider: SocialProvider;
  authorize_url: string;
  state: string;
}

export interface SocialProfilePreview {
  email: string | null;
  nickname: string | null;
  birth_date: string | null;
  /** true면 provider가 생년월일을 주지 않았다 → 가입 화면에서 직접 받아야 한다 */
  needs_birth_date: boolean;
}

export interface SocialLoginResponse {
  status: 'logged_in' | 'signup_required';
  provider: SocialProvider;
  tokens?: TokenPair | null;
  signup_token?: string | null;
  profile?: SocialProfilePreview | null;
  student?: { id: string; nickname: string; student_code: string } | null;
  /** 기존 계정에 이번 요청으로 연결됐는가(안내 문구용) */
  linked_now: boolean;
  is_new_account: boolean;
}

export interface SocialConnection {
  provider: SocialProvider;
  label: string;
  email: string | null;
  connected_at: string | null;
  last_login_at: string | null;
}

export interface SocialConnectionsResponse {
  /** false면 소셜 전용 계정 — 마지막 연결은 해제할 수 없다(서버가 400) */
  has_password: boolean;
  connections: SocialConnection[];
  available: SocialProviderInfo[];
}

export const socialApi = {
  providers: () =>
    client
      .get<{ providers: SocialProviderInfo[] }>('/auth/social/providers')
      .then((r) => r.data.providers),

  authorize: (provider: SocialProvider) =>
    client
      .get<SocialAuthorizeResponse>(`/auth/social/${provider}/authorize`)
      .then((r) => r.data),

  callback: (provider: SocialProvider, code: string, state: string) =>
    client
      .post<SocialLoginResponse>(`/auth/social/${provider}/callback`, { code, state })
      .then((r) => r.data),

  /** 신규 가입 마무리 — 만 14세 미만이면 서버가 400으로 막는다(보호자 동의 게이트) */
  signup: (signupToken: string, birthDate?: string, nickname?: string) =>
    client
      .post<SocialLoginResponse>('/auth/social/signup', {
        signup_token: signupToken,
        ...(birthDate ? { birth_date: birthDate } : {}),
        ...(nickname ? { nickname } : {}),
      })
      .then((r) => r.data),

  connections: () =>
    client.get<SocialConnectionsResponse>('/auth/social/connections').then((r) => r.data),

  /** 로그인한 상태에서 소셜 계정 추가 연결(마이페이지) */
  connect: (provider: SocialProvider, code: string, state: string) =>
    client
      .post<SocialConnectionsResponse>(`/auth/social/${provider}/connect`, { code, state })
      .then((r) => r.data),

  disconnect: (provider: SocialProvider) =>
    client.delete<SocialConnectionsResponse>(`/auth/social/${provider}`).then((r) => r.data),
};

// --- 리다이렉트 왕복 컨텍스트 -------------------------------------------------
// provider 동의 화면을 거쳐 돌아오면 페이지가 새로 뜬다. "어느 provider였는지"와
// "로그인인지 연결인지"를 넘겨야 하는데, 콜백 URL에는 code·state만 온다.
// sessionStorage에 남기고, 탭이 바뀌어 사라진 경우엔 state(JWT) payload에서 복원한다.
const INTENT_KEY = 'catchap_social_intent';
const PROVIDER_KEY = 'catchap_social_provider';

export type SocialIntent = 'login' | 'connect';

export function rememberSocialIntent(provider: SocialProvider, intent: SocialIntent) {
  sessionStorage.setItem(PROVIDER_KEY, provider);
  sessionStorage.setItem(INTENT_KEY, intent);
}

export function readSocialIntent(): SocialIntent {
  return sessionStorage.getItem(INTENT_KEY) === 'connect' ? 'connect' : 'login';
}

export function clearSocialIntent() {
  sessionStorage.removeItem(PROVIDER_KEY);
  sessionStorage.removeItem(INTENT_KEY);
}

/** state(JWT)의 payload에서 provider를 읽는다 — 서명 검증은 서버 몫, 여기선 식별용. */
function providerFromState(state: string | null): SocialProvider | null {
  if (!state) return null;
  try {
    const payload = JSON.parse(
      atob(state.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
    ) as { provider?: string };
    const p = payload.provider;
    return p === 'kakao' || p === 'naver' || p === 'google' ? p : null;
  } catch {
    return null;
  }
}

/** 콜백 화면에서 provider 판별 — sessionStorage 우선, 없으면 state에서 복원. */
export function resolveCallbackProvider(state: string | null): SocialProvider | null {
  const saved = sessionStorage.getItem(PROVIDER_KEY);
  if (saved === 'kakao' || saved === 'naver' || saved === 'google') return saved;
  return providerFromState(state);
}
