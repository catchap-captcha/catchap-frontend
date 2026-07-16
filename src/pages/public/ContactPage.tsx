import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { inquiryApi } from '../../api/misc';
import mascot from '../../assets/characters/catchap-logo.png';
import './ContactPage.css';

const TYPES = ['기관 도입 상담', '요금·결제 문의', '기술 지원', '기타 문의'];

/** 원본 DCLogic의 필수 필드 오류 표시(borderColor #E23D3D + background #FFF5F5) */
const BAD_STYLE = { borderColor: '#E23D3D', background: '#FFF5F5' } as const;

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export default function ContactPage() {
  const [type, setType] = useState(0);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState('');
  const [invalid, setInvalid] = useState({ name: false, email: false, content: false });

  const nameRef = useRef<HTMLInputElement>(null);
  const affRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const clearInvalid = (key: 'name' | 'email' | 'content') => {
    setInvalid((prev) => (prev[key] ? { ...prev, [key]: false } : prev));
  };

  const submit = async () => {
    const name = nameRef.current?.value ?? '';
    const email = emailRef.current?.value ?? '';
    const content = contentRef.current?.value ?? '';

    const badName = !name.trim();
    const badEmail = !email.trim() || !isEmail(email.trim());
    const badContent = !content.trim();
    setInvalid({ name: badName, email: badEmail, content: badContent });

    if (badName || badEmail || badContent) {
      setFormError('입력하지 않은 필수 항목이 있어요. 표시된 곳을 확인해 주세요.');
      const firstBad = badName ? nameRef.current : badEmail ? emailRef.current : contentRef.current;
      firstBad?.focus();
      return;
    }

    setFormError('');
    try {
      const affiliation = affRef.current?.value.trim();
      await inquiryApi.submit({
        inquiry_type: TYPES[type],
        name: name.trim(),
        ...(affiliation ? { affiliation } : {}),
        email: email.trim(),
        content,
      });
      setSent(true);
    } catch {
      setFormError('문의 접수에 실패했어요. 잠시 후 다시 시도해 주세요.');
    }
  };

  const reset = () => {
    setSent(false);
    setFormError('');
    setInvalid({ name: false, email: false, content: false });
  };

  return (
    <div className="ct-page" data-screen-label="문의하기">
      {/* NAV */}
      <div className="ct-nav">
        <div className="ct-nav-inner">
          <Link to={PATHS.HOME} className="ct-back-link"><i className="ph-bold ph-arrow-left" />뒤로</Link>
          <Link to={PATHS.HOME} className="ct-brand">
            <img src={mascot} alt="CatChap" className="ct-brand-logo" />
            <span className="ct-brand-name">CatChap</span>
          </Link>
          <div className="ct-nav-spacer"></div>
          <Link to={PATHS.LOGIN} className="ct-login-link">로그인</Link>
        </div>
      </div>

      <div className="ct-container">
        {/* HEADER */}
        <div className="ct-header">
          <span className="ct-header-badge"><i className="ph-fill ph-chat-circle-text" />문의하기</span>
          <h1 className="ct-header-title">무엇을 도와드릴까요? 🐱</h1>
          <p className="ct-header-sub">도입 상담부터 기술 지원까지, CatChap 팀이 빠르게 답해드려요.</p>
        </div>

        <div className="ct-grid">
          {/* FORM */}
          <div className="ct-form-card">
            {sent ? (
              <div className="ct-sent">
                <div className="ct-sent-icon"><i className="ph-fill ph-check-circle" /></div>
                <h2 className="ct-sent-title">문의가 접수되었어요!</h2>
                <p className="ct-sent-desc">보통 1영업일 안에 입력해 주신 이메일로<br />답변드려요. 조금만 기다려 주세요 🐾</p>
                <button onClick={reset} className="ct-reset-btn">새 문의 작성하기</button>
              </div>
            ) : (
              <div>
                <div className="ct-field-group">
                  <label className="ct-type-label">문의 유형</label>
                  <div className="ct-type-row">
                    {TYPES.map((label, i) => (
                      <button
                        key={label}
                        onClick={() => setType(i)}
                        className={`ct-type-btn${type === i ? ' ct-type-btn--active' : ''}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="ct-field-row">
                  <div className="ct-field-half">
                    <label className="ct-label">이름</label>
                    <input
                      ref={nameRef}
                      type="text"
                      placeholder="성함을 입력해 주세요"
                      className="ct-input"
                      style={invalid.name ? BAD_STYLE : undefined}
                      onInput={() => clearInvalid('name')}
                    />
                  </div>
                  <div className="ct-field-half">
                    <label className="ct-label">소속 (선택)</label>
                    <input ref={affRef} type="text" placeholder="예) 햇살초등학교" className="ct-input" />
                  </div>
                </div>
                <div className="ct-field">
                  <label className="ct-label">이메일</label>
                  <input
                    ref={emailRef}
                    type="email"
                    placeholder="답변받으실 이메일을 입력해 주세요"
                    className="ct-input"
                    style={invalid.email ? BAD_STYLE : undefined}
                    onInput={() => clearInvalid('email')}
                  />
                </div>
                <div className="ct-textarea-group">
                  <label className="ct-label">문의 내용</label>
                  <textarea
                    ref={contentRef}
                    placeholder="궁금하신 점을 자유롭게 적어주세요."
                    rows={5}
                    className="ct-textarea"
                    style={invalid.content ? BAD_STYLE : undefined}
                    onInput={() => clearInvalid('content')}
                  ></textarea>
                </div>
                {formError && (
                  <div className="ct-form-error">
                    <i className="ph-fill ph-warning-circle" />
                    <span>{formError}</span>
                  </div>
                )}
                <button onClick={submit} className="ct-submit-btn"><i className="ph-fill ph-paper-plane-tilt" />문의 보내기</button>
              </div>
            )}
          </div>

          {/* CONTACT INFO */}
          <div className="ct-side">
            <div className="ct-info-card">
              <div className="ct-info-title">바로 연락하기</div>
              <div className="ct-info-list">
                <a href="mailto:help@catchap.io" className="ct-info-link">
                  <span className="ct-info-icon ct-info-icon--mail"><i className="ph-fill ph-envelope-simple" /></span>
                  <span><span className="ct-info-label">이메일</span><span className="ct-info-value">help@catchap.io</span></span>
                </a>
                <a href="tel:15990000" className="ct-info-link">
                  <span className="ct-info-icon ct-info-icon--phone"><i className="ph-fill ph-phone" /></span>
                  <span><span className="ct-info-label">고객센터</span><span className="ct-info-value">1599-0000</span></span>
                </a>
                <div className="ct-info-row">
                  <span className="ct-info-icon ct-info-icon--clock"><i className="ph-fill ph-clock" /></span>
                  <span><span className="ct-info-label">운영 시간</span><span className="ct-info-value">평일 09:00 – 18:00</span></span>
                </div>
              </div>
            </div>
            <div className="ct-faq-card">
              <div className="ct-faq-head">
                <span className="ct-faq-head-icon"><i className="ph-fill ph-question" /></span>
                <span className="ct-faq-head-title">자주 묻는 질문</span>
              </div>
              <div className="ct-faq-list">
                <Link to={PATHS.SUPPORT} className="ct-faq-item">
                  <span className="ct-faq-icon ct-faq-icon--key"><i className="ph-fill ph-key" /></span>
                  <span className="ct-faq-q">기관 코드는 어디서 받나요?</span>
                  <i className="ph-bold ph-caret-right ct-faq-caret" />
                </Link>
                <Link to={PATHS.SUPPORT} className="ct-faq-item">
                  <span className="ct-faq-icon ct-faq-icon--card"><i className="ph-fill ph-credit-card" /></span>
                  <span className="ct-faq-q">요금제와 결제는 어떻게 하나요?</span>
                  <i className="ph-bold ph-caret-right ct-faq-caret" />
                </Link>
                <Link to={PATHS.SUPPORT} className="ct-faq-item">
                  <span className="ct-faq-icon ct-faq-icon--shield"><i className="ph-fill ph-shield-check" /></span>
                  <span className="ct-faq-q">아이 정보는 안전하게 관리되나요?</span>
                  <i className="ph-bold ph-caret-right ct-faq-caret" />
                </Link>
              </div>
              <Link to={PATHS.SUPPORT} className="ct-faq-more">
                자주 묻는 질문 전체 보기 <i className="ph-bold ph-arrow-right" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
