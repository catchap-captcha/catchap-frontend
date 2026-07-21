import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import mascot from '../../assets/characters/catchap-logo.png';

/** 학생 코드 활성화 가입(/activate) — 학교 발급 코드 흐름 종료 안내(2026-07-17).
 * 종전에는 학교가 준 가입 코드로 별명·비밀번호만 정하면 가입됐지만, 학교(기관) 기능
 * 은퇴로 코드 발급 주체가 사라졌다. 이제 이메일 가입(/login)으로 안내한다.
 * 종전 활성화 폼은 git 이력 참고 — 백엔드 엔드포인트 정리는 별도 단계. */
export default function ActivatePage() {
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
          maxWidth: 440,
          width: '100%',
          boxShadow: '0 22px 46px -28px rgba(180,120,90,0.5)',
        }}
      >
        <img src={mascot} alt="CatChap" style={{ width: 60, marginBottom: 12 }} />
        <h1 style={{ fontSize: 20, color: '#3A3340', margin: '0 0 10px' }}>
          학교 코드 가입이 종료됐어요
        </h1>
        <p style={{ fontSize: 14, color: '#8A8072', lineHeight: 1.7, margin: '0 0 20px' }}>
          CatChap은 개인 학습자 대상 강의 서비스로 전환되어, 학교에서 받은 가입
          코드는 더 이상 사용할 수 없어요. <b>이메일로 간편하게 가입</b>할 수 있어요.
        </p>
        <Link
          to={PATHS.LOGIN}
          style={{
            display: 'inline-block',
            background: '#ea5443',
            color: '#fff',
            borderRadius: 14,
            padding: '12px 26px',
            fontSize: 15,
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          이메일로 가입하기
        </Link>
      </div>
    </div>
  );
}
