import { Link, useNavigate } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import mascot from '../../assets/characters/catchap-logo.png';
import './NotFoundPage.css';

/* CatChap 404 — handoff `CatChap 404.dc.html` */
export default function NotFoundPage() {
  const navigate = useNavigate();

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(PATHS.STUDENT_HOME);
  };

  return (
    <div className="nf-page">
      <div className="nf-card">
        {/* 4 [logo] 4 */}
        <div className="nf-code-row">
          <span className="nf-digit">4</span>
          <span className="nf-badge">
            <img src={mascot} alt="CatChap" className="nf-badge-img" />
          </span>
          <span className="nf-digit">4</span>
        </div>

        <div className="nf-pill">
          <i className="ph-fill ph-compass nf-pill-icon" />
          페이지를 찾을 수 없습니다
        </div>

        <h1 className="nf-title">요청하신 페이지가 없습니다</h1>
        <p className="nf-desc">
          찾으시는 페이지가 사라졌거나 주소가 바뀌었을 수 있습니다. 홈으로 돌아가거나 검색으로 원하는
          화면을 찾아보세요.
        </p>

        {/* actions */}
        <div className="nf-actions">
          <button onClick={goBack} className="nf-btn-back">
            <i className="ph-fill ph-arrow-u-up-left nf-btn-back-icon" />
            이전 페이지로 돌아가기
          </button>
          <Link to={PATHS.STUDENT_SEARCH} className="nf-link-search">
            <i className="ph ph-magnifying-glass nf-link-search-icon" />
            검색하기
          </Link>
        </div>

        <div className="nf-error-row">
          <i className="ph ph-warning-circle nf-error-icon" />
          <span className="nf-error-text">오류 코드 404 · 페이지를 찾을 수 없음</span>
        </div>
      </div>
    </div>
  );
}
