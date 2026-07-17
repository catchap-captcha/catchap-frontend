import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import mascot from '../../assets/characters/catchap-logo.png';

/** 은퇴 역할(기관·교사 0717 / 학부모 0718) 서비스 종료 안내 — 제품 전환.
 *  기존 해당 계정이 로그인하면 여기로 온다(ROLE_HOME). 콘솔 화면은 제거됐고,
 *  백엔드 데이터 정리는 별도 단계로 진행된다. 문의 채널만 열어 둔다. */
export default function SchoolSunset() {
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
          padding: '40px 34px',
          textAlign: 'center',
          maxWidth: 480,
          width: '100%',
          boxShadow: '0 22px 46px -28px rgba(180,120,90,0.5)',
        }}
      >
        <img src={mascot} alt="CatChap" style={{ width: 64, marginBottom: 14 }} />
        <h1 style={{ fontSize: 21, color: '#3A3340', margin: '0 0 12px' }}>
          학교·기관·학부모 서비스가 종료되었어요
        </h1>
        <p style={{ fontSize: 14.5, color: '#8A8072', lineHeight: 1.7, margin: '0 0 8px' }}>
          CatChap은 <b>개인 학습자 대상 강의 서비스</b>로 전환되었습니다.
          기관·교사·학부모 콘솔은 더 이상 제공되지 않아요.
        </p>
        <p style={{ fontSize: 13.5, color: '#A89C8C', lineHeight: 1.7, margin: '0 0 22px' }}>
          자녀(만 14세 미만) 가입 동의는 자녀 가입 화면의 보호자 이메일 인증으로
          진행돼요. 보관 중인 데이터 처리나 기타 문의는 아래 문의하기로 알려주시면
          운영팀이 도와드릴게요.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Link
            to={PATHS.CONTACT}
            style={{
              background: '#FF5A4D',
              color: '#fff',
              borderRadius: 14,
              padding: '12px 24px',
              fontSize: 15,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            문의하기
          </Link>
          <Link
            to={PATHS.HOME}
            style={{
              background: '#FFF1E9',
              color: '#B0552F',
              borderRadius: 14,
              padding: '12px 24px',
              fontSize: 15,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}
