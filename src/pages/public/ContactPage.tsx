import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { inquiryApi } from '../../api/misc';
import { useTheme } from '../../hooks/useTheme';
import wordmark from '../../assets/brand/catchap-wordmark.png';
import wordmarkWhite from '../../assets/brand/catchap-wordmark-white.png';
import './ContactPage.css';

/* 서버는 inquiry_type 을 자유 문자열(30자)로 받으므로 여기 문구가 곧 운영 콘솔에 보이는 분류다.
   학습자가 실제로 겪는 순서대로 둔다 — 수강·결제가 가장 많고, 도입 상담은 기관 담당자용이다. */
const TYPES = ['수강·학습 문의', '결제·환불 문의', '기술 지원', '기관·기업 도입', '기타 문의'];

/* 자주 묻는 질문 — 고객지원 페이지를 접으면서 이쪽으로 옮겼다(0730).
   옛 내용(자녀 계정 연결·눈 보호 모드·게임 화면)은 게임형 아동 서비스 시절 것이라 걷어내고,
   지금 서비스(시청 검증형 강의)에서 실제로 묻는 것으로 다시 썼다. */
const FAQ = [
  {
    q: '수강 신청한 강의는 어디서 보나요?',
    a: '결제가 끝나면 바로 수강할 수 있어요. 로그인 후 [강의 홈]에서 신청한 코스가 보이고, 강의를 누르면 이어보기 지점부터 재생됩니다.',
  },
  {
    q: '강의를 보다가 확인 문제가 뜨는 이유가 뭔가요?',
    a: '캣챱은 영상을 실제로 보셨는지 확인합니다. 재생 중 정해진 지점에서 방금 본 내용에 대한 확인 문제가 나오고, 맞히면 그대로 이어서 보실 수 있어요. 틀리면 해당 대목으로 조금 되돌아갑니다.',
  },
  {
    q: '수료증은 어떻게 받나요?',
    a: '코스의 강의를 모두 완주한 뒤 수료 시험을 통과하면 발급됩니다. [나의 기록 > 수료 현황]에서 언제든 다시 내려받을 수 있어요.',
  },
  {
    q: '결제한 강의를 환불받을 수 있나요?',
    a: '결제 후 7일 이내이고 아직 강의를 재생하지 않으셨다면 전액 환불됩니다. [마이페이지 > 계정·개인정보 > 결제 내역·환불]에서 직접 요청하실 수 있어요. 이미 수강을 시작하셨다면 이 문의 양식으로 사정을 알려주세요.',
  },
  {
    q: '비밀번호를 잊어버렸어요.',
    a: '로그인 화면의 [비밀번호를 잊으셨나요?]를 눌러 가입하신 이메일로 인증코드를 받으면 새 비밀번호를 설정할 수 있어요.',
  },
  {
    q: '영상이 멈추거나 화면이 하얗게 보여요.',
    a: '브라우저를 최신 버전으로 업데이트하고 새로고침해 보세요. 그래도 안 되면 사용 중인 기기·브라우저와 강의명을 알려주시면 빠르게 확인하겠습니다.',
  },
];

/** 필수 필드 오류 표시 — 시맨틱 위험색 토큰(리뉴얼) */
const BAD_STYLE = { borderColor: 'var(--danger)', background: 'var(--danger-soft)' } as const;

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export default function ContactPage() {
  const { theme } = useTheme();
  // 펼친 FAQ 인덱스(-1 = 전부 접힘). 한 번에 하나만 열어 옆 문의 양식을 밀어내지 않는다.
  const [faqOpen, setFaqOpen] = useState(-1);
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
          <div className="ct-nav-divider"></div>
          <Link to={PATHS.HOME} className="ct-brand">
            <img
              src={theme === 'dark' ? wordmarkWhite : wordmark}
              alt="CATCHAP"
              className="ct-brand-wordmark"
            />
          </Link>
          <div className="ct-nav-spacer"></div>
          <Link to={PATHS.LOGIN} className="ct-login-link">로그인</Link>
        </div>
      </div>

      <div className="ct-container">
        {/* HEADER */}
        <div className="ct-header">
          <span className="ct-header-badge"><i className="ph-fill ph-chat-circle-text" />문의하기</span>
          <h1 className="ct-header-title">무엇을 도와드릴까요?</h1>
          <p className="ct-header-sub">수강·결제부터 기관 도입까지, 캣챱 팀이 빠르게 답해 드립니다.</p>
        </div>

        <div className="ct-grid">
          {/* FORM */}
          <div className="ct-form-card">
            {sent ? (
              <div className="ct-sent">
                <div className="ct-sent-icon"><i className="ph-fill ph-check-circle" /></div>
                <h2 className="ct-sent-title">문의가 접수되었어요!</h2>
                <p className="ct-sent-desc">보통 1영업일 안에 입력해 주신 이메일로<br />답변드려요. 조금만 기다려 주세요.</p>
                <button onClick={reset} className="ct-reset-btn">새 문의 작성하기</button>
              </div>
            ) : (
              /* ct-form-body — 카드 높이를 오른쪽 열에 맞추려면 이 중간 래퍼도 늘어나야
                 문의 내용 입력칸까지 flex 사슬이 이어진다 */
              <div className="ct-form-body">
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
                    <input ref={affRef} type="text" placeholder="예) OO기업 인재개발팀" className="ct-input" />
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
                <span className="ct-faq-head-icon"><i className="ph ph-question" /></span>
                <span className="ct-faq-head-title">자주 묻는 질문</span>
              </div>
              {/* 종전엔 고객지원 페이지로 넘기는 링크였는데 그 페이지를 접었다(0730).
                  갈 곳이 없어졌으므로 여기서 바로 펼쳐 읽게 한다 — 답을 보려고 페이지를
                  옮기는 것보다 문의 양식 옆에서 바로 확인하는 편이 낫다. */}
              <div className="ct-faq-list">
                {FAQ.map((f, i) => (
                  <div key={f.q} className="ct-faq-item">
                    <button
                      type="button"
                      className="ct-faq-qbtn"
                      aria-expanded={faqOpen === i}
                      onClick={() => setFaqOpen(faqOpen === i ? -1 : i)}
                    >
                      <span className="ct-faq-q">{f.q}</span>
                      <i
                        className={`ph-bold ${faqOpen === i ? 'ph-caret-up' : 'ph-caret-down'} ct-faq-caret`}
                      />
                    </button>
                    {faqOpen === i && <p className="ct-faq-a">{f.a}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
