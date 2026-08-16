/**
 * 소셜 로그인(카카오·네이버·구글) API.
 *
 * 흐름은 백엔드 docs/social-login-design.md 와 1:1이다:
 *   authorize → (provider 동의 화면) → callback → logged_in | signup_required → signup
 *
 * redirect_uri는 **지금 떠 있는 오리진 기준으로 보낸다**(window.location.origin + 콜백 경로).
 * 서버는 허용목록(SOCIAL_REDIRECT_URIS)과 대조해 목록 밖이면 400으로 막고, 통과한 값을
 * state 안에 박아 콜백에서 다시 대조한다. 보내지 않으면 서버가 목록의 '첫 번째' 값을 쓰는데,
 * 로컬과 운영 주소가 한 목록에 있을 때 순서에 따라 엉뚱한 도메인으로 튕긴다 —
 * 자기 오리진을 명시하면 같은 목록을 모든 환경이 공유해도 항상 자기 자신으로 돌아온다.
 */
import { client } from './client';
import type { TokenPair } from '../types/auth';

export type SocialProvider = 'kakao' | 'naver' | 'google';

/** provider가 돌아올 주소 — 서버 허용목록(SOCIAL_REDIRECT_URIS)에 이 값이 있어야 한다.
 *  경로는 routes/paths.ts 의 SOCIAL_CALLBACK 과 같아야 한다(하드코딩 대신 여기 한 곳). */
export function callbackUrl(): string {
  return `${window.location.origin}/auth/social/callback`;
}

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

  /** reauth=true면 '다른 계정으로 로그인' — provider 세션이 살아 있어도 로그인·계정선택
   *  화면을 다시 띄운다. 우리가 로그아웃해도 provider 세션은 남아서, 버튼을 누르는 즉시
   *  같은 계정으로 되돌아온다(OAuth 표준 동작). 계정을 바꾸려면 이 경로가 필요하다. */
  authorize: (provider: SocialProvider, reauth = false) =>
    client
      .get<SocialAuthorizeResponse>(`/auth/social/${provider}/authorize`, {
        params: { redirect_uri: callbackUrl(), ...(reauth ? { reauth: true } : {}) },
      })
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
const RETURN_KEY = 'catchap_social_return';

export type SocialIntent = 'login' | 'connect';

export function rememberSocialIntent(
  provider: SocialProvider,
  intent: SocialIntent,
  /** connect 왕복이 끝나고 돌아갈 앱 내부 경로 — 출발한 화면이 지정한다.
   *  학생 마이페이지와 콘솔 프로필이 같은 콜백 화면을 공유하기 때문에 필요하다. */
  returnTo?: string,
) {
  sessionStorage.setItem(PROVIDER_KEY, provider);
  sessionStorage.setItem(INTENT_KEY, intent);
  if (returnTo) sessionStorage.setItem(RETURN_KEY, returnTo);
  else sessionStorage.removeItem(RETURN_KEY);
}

/** 연결 후 돌아갈 경로. 없으면 null(호출부가 기본값을 정한다).
 *  ★'/'로 시작하되 '//'·'/\'가 아닌 값만 통과시킨다 — sessionStorage는 확장프로그램이나
 *  XSS로 오염될 수 있고, 그 값을 그대로 navigate하면 외부 주소로 튀는 오픈 리다이렉트가 된다. */
export function readSocialReturn(): string | null {
  const v = sessionStorage.getItem(RETURN_KEY);
  return v && /^\/(?![/\\])/.test(v) ? v : null;
}

export function readSocialIntent(): SocialIntent {
  return sessionStorage.getItem(INTENT_KEY) === 'connect' ? 'connect' : 'login';
}

export function clearSocialIntent() {
  sessionStorage.removeItem(PROVIDER_KEY);
  sessionStorage.removeItem(INTENT_KEY);
  sessionStorage.removeItem(RETURN_KEY);
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
