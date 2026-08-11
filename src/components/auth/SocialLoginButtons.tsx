/**
 * 간편 로그인 버튼 (카카오·네이버·구글).
 *
 * 서버가 켜 준 provider만 그린다(GET /auth/social/providers) — 키가 없는 provider의 버튼을
 * 보여 주면 누르는 순간 503이라, 되는 척하지 않는다는 백엔드 규약과 화면을 맞춘다.
 * 하나도 안 켜져 있으면 이 컴포넌트는 아무것도 렌더하지 않는다(구분선까지 함께 사라진다).
 *
 * 클릭 → authorize URL을 받아 그 주소로 이동. 돌아오는 곳은 /auth/social/callback 이다.
 *
 * 브랜드 규정(각 사 로그인 버튼 디자인 가이드)을 따른다:
 *   카카오 — 배경 #FEE500, 심볼·문구는 검정 85% 불투명도, 문구 "카카오 로그인"
 *   네이버 — 배경 #03C75A, 흰색 N 심볼, 문구 "네이버 로그인"
 *   구글  — 흰 배경 + 회색 테두리, 4색 G(단색 변형 금지), 문구 "Google로 로그인"
 * ★문구를 임의로 바꾸지 말 것 — 네이버는 검수 항목이고, 카카오도 가이드 위반 시 제재 대상이다.
 * (픽셀 단위까지 맞춰야 하면 각 사 개발자센터에서 공식 버튼 이미지를 내려받아 교체한다)
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
    <svg viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M9 .5C4.03.5 0 3.61 0 7.44c0 2.48 1.66 4.66 4.15 5.89-.18.65-.66 2.37-.75 2.74-.12.46.17.45.36.33.15-.1 2.36-1.6 3.32-2.25.62.09 1.26.14 1.92.14 4.97 0 9-3.11 9-6.94S13.97.5 9 .5z"
      />
    </svg>
  );
}

function NaverMark() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M13.56 10.69 6.24 0H0v20h6.44V9.3L13.76 20H20V0h-6.44z" />
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

/** 각 사 가이드가 규정하는 버튼 문구. 임의 변경 금지(네이버 검수 항목). */
const BUTTON_LABELS: Record<SocialProvider, string> = {
  kakao: '카카오 로그인',
  naver: '네이버 로그인',
  google: 'Google로 로그인',
};

/** 접기 토글의 안내 힌트에 쓰는 축약 이름 — 규정 문구는 실제 버튼에만, 여긴 힌트라 축약 허용. */
const SHORT_NAMES: Record<SocialProvider, string> = {
  kakao: '카카오',
  naver: '네이버',
  google: 'Google',
};

interface Props {
  /** 화면 맥락만 구분한다 — 버튼 문구는 브랜드 가이드 고정값이라 모드와 무관하다 */
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
  // 간편 로그인 접기 — 기본 접힘(세로 길이 축소), 토글 클릭 시 펼침. 계정 연결(마이페이지)은 접지 않는다.
  const [expanded, setExpanded] = useState(false);

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

  const buttonList = (
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
            aria-label={intent === 'connect' ? `${p.label} 계정 연결` : BUTTON_LABELS[p.provider]}
          >
            <span className="sl-mark">
              {busy === p.provider ? <i className="ph-bold ph-circle-notch sl-spin" /> : <Mark />}
            </span>
            <span className="sl-text">
              {intent === 'connect' ? `${p.label} 계정 연결하기` : BUTTON_LABELS[p.provider]}
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      {withDivider && (
        <div className="lg-divider">
          <div className="lg-divider-line" />
          <span>{mode === 'signup' ? '간편 가입' : '간편 로그인'}</span>
          <div className="lg-divider-line" />
        </div>
      )}

      {intent === 'connect' ? (
        buttonList
      ) : (
        // 간편 로그인 접기/펼치기 — 기본 접힘(세로 축소). 토글을 다시 누르면 접힌다.
        <>
          <button
            type="button"
            className={'sl-toggle' + (expanded ? ' sl-toggle--open' : '')}
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            <span className="sl-toggle-main">
              <i className="ph-fill ph-lightning" />
              {mode === 'signup' ? '간편 가입' : '간편 로그인'}
            </span>
            <span className="sl-toggle-sub">
              {providers.map((p) => SHORT_NAMES[p.provider]).join(' · ')}
            </span>
            <i className="ph-bold ph-caret-down sl-toggle-caret" />
          </button>
          {expanded && buttonList}
        </>
      )}

      {error && (
        <div className="lg-formerr">
          <i className="ph-fill ph-warning-circle" />
          <span>{error}</span>
        </div>
      )}
    </>
  );
}
