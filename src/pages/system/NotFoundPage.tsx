import { Link, useNavigate } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import mascot from '../../assets/characters/catchap-logo.png';
import './NotFoundPage.css';

export default function NotFoundPage() {
  const navigate = useNavigate();

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(PATHS.STUDENT_HOME);
  };

  return (
    <div className="nf-page">
      {/* decorative shapes */}
      <div className="nf-shape-square" />
      <div className="nf-shape-circle" />
      <i className="ph-fill ph-star-four nf-star-1" />
      <i className="ph-fill ph-star-four nf-star-2" />

      <div className="nf-card">
        {/* 4 🐾 4 */}
        <div className="nf-code-row">
          <span className="nf-digit">4</span>
          <div className="nf-mascot-wrap">
            <img src={mascot} alt="CatChap 마스코트" className="nf-mascot" />
            <span className="nf-mascot-badge">
              <i className="ph-fill ph-magnifying-glass nf-mascot-badge-icon" />
            </span>
          </div>
          <span className="nf-digit">4</span>
        </div>

        <div className="nf-pill">
          <i className="ph-fill ph-compass nf-pill-icon" />
          페이지를 찾을 수 없어요
        </div>

        <h1 className="nf-title">냥이가 길을 잃었어요!</h1>
        <p className="nf-desc">찾으시는 페이지가 사라졌거나 주소가 바뀌었나 봐요. 냥이랑 다시 홈으로 돌아가 볼까요?</p>

        {/* actions */}
        <div className="nf-actions">
          <button onClick={goBack} className="nf-btn-back">
            <i className="ph-fill ph-arrow-u-up-left nf-btn-back-icon" />
            이전 페이지로 돌아가기
          </button>
          <Link to={PATHS.STUDENT_SEARCH} className="nf-link-search">
            <i className="ph-fill ph-magnifying-glass nf-link-search-icon" />
            검색하기
          </Link>
        </div>

        <div className="nf-error-row">
          <i className="ph-fill ph-warning-circle nf-error-icon" />
          <span className="nf-error-text">오류 코드 404 · 페이지를 찾을 수 없음</span>
        </div>
      </div>
    </div>
  );
}
