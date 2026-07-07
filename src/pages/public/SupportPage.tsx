import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { inquiryApi } from '../../api/misc';
import { useAuth } from '../../hooks/useAuth';
import mascot from '../../assets/characters/catchap-logo.png';
import './SupportPage.css';

/** 원본 DCLogic의 TAG 색상 매핑 → 접두사 클래스 */
const TAG_CLASS: Record<string, string> = {
  '계정': 'sp-faq-tag--account',
  '학습': 'sp-faq-tag--learn',
  '결제': 'sp-faq-tag--pay',
  '기술 문제': 'sp-faq-tag--tech',
};

const DATA = [
  { tag: '계정', q: '비밀번호를 잊어버렸어요.', a: '로그인 화면의 "비밀번호를 잊으셨나요?"를 눌러 가입하신 이메일로 인증코드를 받으면 새 비밀번호를 설정할 수 있어요. 학생 계정은 보호자 또는 소속 기관 이메일로도 재설정할 수 있습니다.' },
  { tag: '계정', q: '자녀 계정을 어떻게 연결하나요?', a: '학부모 페이지에서 "자녀 연결"을 누르고, 자녀의 학생 코드(나의 기록 > 설정에서 확인)를 입력하면 바로 연동됩니다. 여러 자녀도 추가로 연결할 수 있어요.' },
  { tag: '학습', q: '학습 기록이 저장되지 않아요.', a: '학습은 문제를 끝까지 완료해야 기록에 반영돼요. 네트워크가 불안정한 경우 잠시 후 자동으로 동기화되며, 계속 문제가 있으면 기술 문의로 알려주세요.' },
  { tag: '결제', q: '구독을 해지하고 환불받을 수 있나요?', a: '기관 구독은 관리자 설정에서 해지할 수 있고, 결제일로부터 7일 이내 미사용 시 전액 환불됩니다. 이후에는 남은 기간에 따라 부분 환불이 적용돼요.' },
  { tag: '기술 문제', q: '화면이 하얗게 보이거나 멈춰요.', a: '브라우저를 최신 버전으로 업데이트하고 새로고침해 보세요. 그래도 안 되면 사용 중인 기기·브라우저 정보와 함께 문의해 주시면 빠르게 도와드릴게요.' },
  { tag: '학습', q: '눈 보호 모드는 어떻게 켜나요?', a: '설정 페이지 또는 게임 화면 우측 상단의 눈 아이콘을 누르면 화면 톤이 따뜻하게 바뀌어 눈부심을 줄여줘요. 저녁 학습에 특히 도움이 됩니다.' },
];

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export default function SupportPage() {
  const { me } = useAuth();
  const [open, setOpen] = useState(0);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState('');

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const typeRef = useRef<HTMLSelectElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const displayName = me?.student?.nickname || me?.name || '하은';

  const submitInquiry = async () => {
    // 서버 성공/실패를 사용자에게 명확히 보여준다(조용히 삼키지 않음)
    const name = (nameRef.current?.value ?? '').trim();
    const email = (emailRef.current?.value ?? '').trim();
    const content = (contentRef.current?.value ?? '').trim();
    if (!name || !email || !isEmail(email) || !content) {
      setFormError('이름·이메일·문의 내용을 모두 정확히 입력해 주세요.');
      return;
    }
    setFormError('');
    setSending(true);
    try {
      await inquiryApi.submit({
        inquiry_type: typeRef.current?.value ?? '',
        name,
        email,
        content,
      });
      setSent(true);
    } catch {
      setFormError('문의 접수에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSending(false);
    }
  };

  const resetInquiry = () => {
    setSent(false);
    setFormError('');
    if (nameRef.current) nameRef.current.value = '';
    if (emailRef.current) emailRef.current.value = '';
    if (contentRef.current) contentRef.current.value = '';
  };

  return (
    <div className="sp-page">
      {/* NAV */}
      <div className="sp-nav">
        <div className="sp-nav-inner">
          <Link to={PATHS.STUDENT_HOME} className="sp-brand">
            <img src={mascot} alt="CatChap" className="sp-brand-logo" />
            <div className="sp-brand-text">
              <span className="sp-brand-name">CatChap</span>
              <span className="sp-brand-tagline">놀면서 배우는 캡챠 학습</span>
            </div>
          </Link>
          <nav className="sp-nav-menu">
            <Link to={PATHS.STUDENT_HOME} className="sp-nav-link">홈</Link>
            <Link to={PATHS.STUDENT_ALL_LEARNING} className="sp-nav-link">전체 학습</Link>
            <a href="#" className="sp-nav-link--active">고객 지원</a>
          </nav>
          <div className="sp-nav-right">
            <Link to={PATHS.STUDENT_SEARCH} title="검색" className="sp-icon-btn"><i className="ph-bold ph-magnifying-glass" /></Link>
            <button className="sp-bell-btn"><i className="ph-fill ph-bell" /><span className="sp-bell-dot"></span></button>
            <Link to={PATHS.STUDENT_PROFILE} title="마이페이지" className="sp-profile">
              <div className="sp-profile-avatar">{displayName.charAt(0)}</div>
              <span className="sp-profile-name">{displayName}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* HERO */}
      <section className="sp-hero">
        <div className="sp-hero-panel">
          <div className="sp-hero-bubble1"></div>
          <div className="sp-hero-bubble2"></div>
          <div className="sp-hero-content">
            <span className="sp-hero-badge"><i className="ph-fill ph-lifebuoy" />고객 지원 센터</span>
            <h1 className="sp-hero-title">무엇을 도와드릴까요?</h1>
            <p className="sp-hero-sub">궁금한 점을 검색하거나, 아래에서 자주 묻는 질문을 확인해 보세요.</p>
            <div className="sp-search-box">
              <i className="ph-bold ph-magnifying-glass sp-search-icon" />
              <input type="text" placeholder="예) 비밀번호를 잊어버렸어요" className="sp-search-input" />
            </div>
            <div className="sp-hero-chips">
              <span className="sp-hero-chip">로그인 문제</span>
              <span className="sp-hero-chip">자녀 계정 연결</span>
              <span className="sp-hero-chip">결제·환불</span>
              <span className="sp-hero-chip">학습 기록</span>
            </div>
          </div>
        </div>
      </section>

      {/* QUICK CATEGORIES */}
      <section className="sp-cats">
        <div className="sp-cats-grid">
          <div className="sp-cat-card">
            <span className="sp-cat-icon sp-cat-icon--account"><i className="ph-fill ph-user-circle" /></span>
            <div className="sp-cat-name">계정</div>
            <p className="sp-cat-desc">로그인·비밀번호</p>
          </div>
          <div className="sp-cat-card">
            <span className="sp-cat-icon sp-cat-icon--learn"><i className="ph-fill ph-book-open-text" /></span>
            <div className="sp-cat-name">학습</div>
            <p className="sp-cat-desc">놀이·진도·기록</p>
          </div>
          <div className="sp-cat-card">
            <span className="sp-cat-icon sp-cat-icon--pay"><i className="ph-fill ph-credit-card" /></span>
            <div className="sp-cat-name">결제</div>
            <p className="sp-cat-desc">구독·환불</p>
          </div>
          <div className="sp-cat-card">
            <span className="sp-cat-icon sp-cat-icon--tech"><i className="ph-fill ph-wrench" /></span>
            <div className="sp-cat-name">기술 문제</div>
            <p className="sp-cat-desc">오류·접속</p>
          </div>
        </div>
      </section>

      {/* FAQ + CONTACT */}
      <section className="sp-main">
        {/* FAQ */}
        <div>
          <h2 className="sp-faq-title">자주 묻는 질문</h2>
          <div className="sp-faq-list">
            {DATA.map((f, i) => {
              const isOpen = open === i;
              return (
                <div key={i} className="sp-faq-item">
                  <button
                    onClick={() => setOpen((prev) => (prev === i ? -1 : i))}
                    className="sp-faq-q-btn"
                  >
                    <span className={`sp-faq-tag ${TAG_CLASS[f.tag]}`}>{f.tag}</span>
                    <span className="sp-faq-q">{f.q}</span>
                    <i className={`${isOpen ? 'ph-bold ph-caret-up' : 'ph-bold ph-caret-down'} sp-faq-caret`} />
                  </button>
                  {isOpen && (
                    <div className="sp-faq-a-wrap">
                      <div className="sp-faq-a">{f.a}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* CONTACT + HOURS */}
        <div className="sp-side">
          <div className="sp-contact-card">
            <div className="sp-contact-head">
              <span className="sp-contact-head-icon"><i className="ph-fill ph-paper-plane-tilt" /></span>
              <h3 className="sp-contact-title">문의하기</h3>
            </div>
            {sent ? (
              <div style={{ textAlign: 'center', padding: '20px 4px' }}>
                <span style={{ fontSize: 44, color: '#17B08C', lineHeight: 1 }}><i className="ph-fill ph-check-circle" /></span>
                <div style={{ fontWeight: 700, fontSize: 18, margin: '12px 0 6px' }}>문의가 접수되었어요!</div>
                <p style={{ color: '#6B6B76', fontSize: 14, marginBottom: 16 }}>영업일 기준 1일 이내에 입력해 주신 이메일로 답변드려요.</p>
                <button onClick={resetInquiry} className="sp-submit-btn">새 문의 작성하기</button>
              </div>
            ) : (
              <>
                <label className="sp-label">이름</label>
                <input ref={nameRef} type="text" placeholder="이름을 입력해 주세요" className="sp-input" />
                <label className="sp-label">이메일</label>
                <input ref={emailRef} type="email" placeholder="example@email.com" className="sp-input" />
                <label className="sp-label">문의 유형</label>
                <div className="sp-select-wrap">
                  <select ref={typeRef} className="sp-select">
                    <option>계정·로그인</option>
                    <option>학습·진도</option>
                    <option>결제·환불</option>
                    <option>기술 문제</option>
                    <option>기타</option>
                  </select>
                  <i className="ph-bold ph-caret-down sp-select-caret" />
                </div>
                <label className="sp-label">문의 내용</label>
                <textarea ref={contentRef} placeholder="궁금한 내용을 자세히 적어주세요" rows={4} className="sp-textarea"></textarea>
                {formError && (
                  <div className="sp-form-error" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#E23D3D', margin: '8px 0' }}>
                    <i className="ph-fill ph-warning-circle" />
                    <span>{formError}</span>
                  </div>
                )}
                <button onClick={submitInquiry} disabled={sending} className="sp-submit-btn">
                  <i className="ph-fill ph-paper-plane-right" />{sending ? '접수 중…' : '문의 보내기'}
                </button>
              </>
            )}
          </div>

          <div className="sp-hours-card">
            <div className="sp-hours-head">
              <span className="sp-hours-head-icon"><i className="ph-fill ph-clock" /></span>
              <h3 className="sp-hours-title">운영 시간</h3>
            </div>
            <div className="sp-hours-list">
              <div className="sp-hours-row"><span className="sp-hours-day">평일</span><span className="sp-hours-time">오전 10:00 – 오후 6:00</span></div>
              <div className="sp-hours-row"><span className="sp-hours-day">주말·공휴일</span><span className="sp-hours-time sp-hours-time--off">휴무 (이메일 접수)</span></div>
            </div>
            <p className="sp-hours-note">문의는 접수 후 영업일 기준 1일 이내에 답변드려요. 급한 문의는 support@catchap.io 로 보내주세요.</p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="sp-footer">
        <div className="sp-footer-inner">
          <div className="sp-footer-brand">
            <img src={mascot} alt="CatChap" className="sp-footer-logo" />
            <div>
              <div className="sp-footer-name">CatChap</div>
              <div className="sp-footer-tagline">놀면서 배우는 어린이 캡챠 학습 서비스</div>
            </div>
          </div>
          <div className="sp-footer-links">
            <Link to={PATHS.PRIVACY} className="sp-footer-link">개인정보 보호</Link>
            <Link to={PATHS.TERMS} className="sp-footer-link">이용약관</Link>
          </div>
        </div>
        <p className="sp-footer-copy">© 2026 CatChap · 카카오클라우드 AIaaS 마스터 클래스 5기</p>
      </footer>
    </div>
  );
}
