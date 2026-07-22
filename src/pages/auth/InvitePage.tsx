import { useNavigate } from 'react-router-dom';
import { PATHS } from '../../routes/paths';

/** 교사 초대링크(/invite?token=...) 진입점 — 입구 차단(2026-07-17, 학교 기능 은퇴).
 * 종전에는 토큰을 검증해 교사 가입을 프리필했지만, 교사 신규 가입이 종료되어(서버도
 * 발급·가입 모두 410) 이제 종료 안내만 보여준다. 종전 프리필 흐름은 git 이력 참고 —
 * 페이지 자체는 3단계 정리에서 라우트와 함께 제거한다. */
export const INVITE_PREFILL_KEY = 'catchap_invite_prefill';

export default function InvitePage() {
  const navigate = useNavigate();
  const error =
    '교사 초대 가입이 종료되었어요. CatChap은 개인 학습자 대상 강의 서비스로 전환되었습니다.';

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        fontFamily: 'var(--font)',
        padding: 20,
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 28,
          padding: '36px 30px',
          textAlign: 'center',
          maxWidth: 420,
          width: '100%',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>🐾</div>
        <h1 style={{ fontSize: 20, color: 'var(--ink)', margin: '0 0 10px' }}>초대 가입이 종료됐어요</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, margin: '0 0 20px' }}>{error}</p>
        <button
          onClick={() => navigate(PATHS.LOGIN)}
          style={{
            background: 'var(--brand)',
            color: 'var(--on-brand)',
            border: 'none',
            borderRadius: 14,
            padding: '12px 26px',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          로그인 화면으로
        </button>
      </div>
    </div>
  );
}
