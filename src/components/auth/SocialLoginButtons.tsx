/**
 * 간편 로그인 버튼 (카카오·네이버·구글).
 *
 * 서버가 켜 준 provider만 그린다(GET /auth/social/providers) — 키가 없는 provider의 버튼을
 * 보여 주면 누르는 순간 503이라, 되는 척하지 않는다는 백엔드 규약과 화면을 맞춘다.
 * 하나도 안 켜져 있으면 이 컴포넌트는 아무것도 렌더하지 않는다(구분선까지 함께 사라진다).
 *
 * 클릭 → authorize URL을 받아 그 주소로 이동. 돌아오는 곳은 /auth/social/callback 이다.
 *
 * ⚠ 브랜드 마크는 근사 SVG다. 카카오·네이버는 로그인 버튼 디자인 가이드(색·비율·문구)를
 *   규정하므로, 실서비스 배포 전 각 사의 공식 버튼 리소스로 교체할 것.
 */
import { useEffect, useState, type ReactElement } from 'react';
import {
  rememberSocialIntent,
  socialApi,
  type SocialIntent,
  type SocialProvider,
  type SocialProviderInfo,
} from '../../api/social';
import './SocialLoginButtons.css';

function KakaoMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 3C6.5 3 2 6.5 2 10.9c0 2.8 1.8 5.2 4.6 6.6-.2.7-.7 2.7-.8 3.1-.1.5.2.5.4.4.2-.1 2.6-1.8 3.7-2.5.7.1 1.4.2 2.1.2 5.5 0 10-3.5 10-7.8S17.5 3 12 3z"
      />
    </svg>
  );
}

function NaverMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M14.2 12.6 9.7 6H5.5v12h4.3v-6.6l4.5 6.6h4.2V6h-4.3v6.6z" />
    </svg>
  );
}

function GoogleMark() {
  // 구글 G — 4색 규정 마크(단색으로 바꾸면 안 된다)
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.63v3.01h3.86c2.26-2.09 3.57-5.17 3.57-8.88z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3.01c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.29a12 12 0 0 0 0 10.74l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.63l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

const MARKS: Record<SocialProvider, () => ReactElement> = {
  kakao: KakaoMark,
  naver: NaverMark,
  google: GoogleMark,
};

interface Props {
  /** login = "카카오로 로그인", signup = "카카오로 시작하기" */
  mode?: 'login' | 'signup';
  /** connect면 콜백이 '연결' 흐름으로 처리한다(마이페이지에서 사용) */
  intent?: SocialIntent;
  /** 위쪽 '또는' 구분선을 함께 그릴지 */
  withDivider?: boolean;
}

export default function SocialLoginButtons({
  mode = 'login',
  intent = 'login',
  withDivider = false,
}: Props) {
  const [providers, setProviders] = useState<SocialProviderInfo[]>([]);
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    socialApi
      .providers()
      .then((list) => {
        if (alive) setProviders(list.filter((p) => p.enabled));
      })
      .catch(() => {
        // 목록 조회 실패는 조용히 넘긴다 — 소셜은 보조 수단이고, 아이디·비밀번호 로그인이
        // 이 화면의 주 경로다. 버튼이 안 보일 뿐 로그인은 그대로 된다.
        if (alive) setProviders([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const start = async (provider: SocialProvider) => {
    setError('');
    setBusy(provider);
    try {
      const res = await socialApi.authorize(provider);
      rememberSocialIntent(provider, intent);
      window.location.href = res.authorize_url;
    } catch {
      setBusy(null);
      setError('간편 로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  };

  if (providers.length === 0) return null;

  return (
    <>
      {withDivider && (
        <div className="lg-divider">
          <div className="lg-divider-line" />
          <span>{mode === 'signup' ? '간편 가입' : '간편 로그인'}</span>
          <div className="lg-divider-line" />
        </div>
      )}

      <div className="sl-list">
        {providers.map((p) => {
          const Mark = MARKS[p.provider];
          return (
            <button
              key={p.provider}
              type="button"
              className={`sl-btn sl-btn--${p.provider}`}
              onClick={() => start(p.provider)}
              disabled={busy !== null}
              aria-label={`${p.label} 계정으로 ${mode === 'signup' ? '시작하기' : '로그인'}`}
            >
              <span className="sl-mark">
                {busy === p.provider ? <i className="ph-bold ph-circle-notch sl-spin" /> : <Mark />}
              </span>
              <span className="sl-text">
                {p.label}
                {intent === 'connect'
                  ? ' 계정 연결하기'
                  : mode === 'signup'
                    ? '로 시작하기'
                    : '로 로그인'}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="lg-formerr">
          <i className="ph-fill ph-warning-circle" />
          <span>{error}</span>
        </div>
      )}
    </>
  );
}
