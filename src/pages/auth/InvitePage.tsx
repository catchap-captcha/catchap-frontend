import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { PATHS } from '../../routes/paths';

/** 교사 초대링크(/invite?token=...) 진입점.
 * 토큰을 검증해 기관·교사코드를 받아 sessionStorage에 담고, 프리필된 가입화면(/login)으로 보낸다.
 * LoginPage가 마운트 시 이 값을 읽어 교사 가입을 자동 구성한다. */
export const INVITE_PREFILL_KEY = 'catchap_invite_prefill';

export default function InvitePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const ran = useRef(false); // StrictMode 이중 실행 방지 (토큰 1회 소비성 조회)

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const token = params.get('token')?.trim();
    if (!token) {
      setError('초대 링크가 올바르지 않아요. 링크를 다시 확인해 주세요.');
      return;
    }
    authApi
      .getInvite(token)
      .then((inv) => {
        sessionStorage.setItem(
          INVITE_PREFILL_KEY,
          JSON.stringify({
            token, // 가입 시 서버로 되돌려 이메일 인증코드를 생략(초대가 이메일 소유 증명)
            organizationId: inv.organization_id,
            organizationName: inv.organization_name,
            teacherCode: inv.teacher_code,
            name: inv.name ?? '',
            email: inv.email,
            role: inv.role,
            instType: inv.inst_type,
            sido: inv.sido,
            sigungu: inv.sigungu,
            dong: inv.dong,
            road: inv.road_address,
          }),
        );
        navigate(PATHS.LOGIN, { replace: true });
      })
      .catch((e) => {
        const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setError(detail ?? '초대 링크가 만료되었거나 유효하지 않아요.');
      });
  }, [params, navigate]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#FFF6EC',
        fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif",
        padding: 20,
      }}
    >
      <div
        style={{
          background: '#fff',
          border: '2px solid #FFEDE4',
          borderRadius: 28,
          padding: '36px 30px',
          textAlign: 'center',
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 22px 46px -28px rgba(180,120,90,0.5)',
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>🐾</div>
        {error ? (
          <>
            <h1 style={{ fontSize: 20, color: '#3A3340', margin: '0 0 10px' }}>초대를 열 수 없어요</h1>
            <p style={{ fontSize: 14, color: '#8A8072', lineHeight: 1.6, margin: '0 0 20px' }}>{error}</p>
            <button
              onClick={() => navigate(PATHS.LOGIN)}
              style={{
                background: '#FF5A4D',
                color: '#fff',
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
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 20, color: '#3A3340', margin: '0 0 10px' }}>초대를 확인하고 있어요</h1>
            <p style={{ fontSize: 14, color: '#8A8072', lineHeight: 1.6, margin: 0 }}>
              잠시만 기다려 주세요…
            </p>
          </>
        )}
      </div>
    </div>
  );
}
