import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import mascot from '../../assets/characters/catchap-logo.png';
import './TermsPage.css';

export default function TermsPage() {
  return (
    <div className="tm-page">
      {/* NAV */}
      <div className="tm-nav">
        <div className="tm-nav-inner">
          <Link to={PATHS.HOME} className="tm-brand">
            <img src={mascot} alt="CatChap" className="tm-brand-logo" />
            <span className="tm-brand-name">CatChap</span>
          </Link>
          <span className="tm-nav-legal">LEGAL</span>
          <Link to={PATHS.HOME} className="tm-nav-back">
            <i className="ph-bold ph-arrow-left tm-nav-back-icon" />
            메인으로 돌아가기
          </Link>
        </div>
      </div>

      {/* MASTHEAD */}
      <div className="tm-masthead">
        <div className="tm-masthead-rule">
          <div className="tm-masthead-row">
            <div>
              <div className="tm-eyebrow">TERMS OF SERVICE</div>
              <h1 className="tm-title">서비스 이용약관</h1>
            </div>
            <div className="tm-doc-meta">
              <div className="tm-doc-service">CatChap 어린이 학습 서비스</div>
              <div className="tm-doc-number">문서번호 CC-TOS-2026</div>
            </div>
          </div>
        </div>
        <div className="tm-meta-row">
          <span>시행일자 {' '}2026. 07. 01.</span>
          <span>최종 개정 {' '}2026. 06. 20.</span>
          <span>버전 {' '}v1.2</span>
        </div>
      </div>

      {/* CONTENT SHEET */}
      <div className="tm-sheet-wrap">
        <article className="tm-sheet">
          {/* PREAMBLE */}
          <p className="tm-preamble">
            본 약관은 CatChap(이하 ‘서비스’)이 제공하는 어린이 교육용 캡챠 학습 서비스의 이용조건과 절차, 서비스와 이용자의 권리·의무 및 책임사항을 규정합니다. 회원가입 시 본 약관에 동의한 것으로 간주되며, 서비스는 어린이 이용자의 안전을 최우선으로 합니다. 특히 만 14세 미만 아동 회원의 경우 법정대리인의 동의 아래에서만 서비스를 이용할 수 있습니다.
          </p>

          {/* INDEX */}
          <div className="tm-index">
            <div className="tm-index-title">목 차</div>
            <div className="tm-index-grid">
              <a href="#t1" className="tm-index-link"><span className="tm-index-num">01</span>목적</a>
              <a href="#t2" className="tm-index-link"><span className="tm-index-num">02</span>용어의 정의</a>
              <a href="#t3" className="tm-index-link"><span className="tm-index-num">03</span>약관의 효력 및 변경</a>
              <a href="#t4" className="tm-index-link"><span className="tm-index-num">04</span>회원가입 및 본인확인</a>
              <a href="#t5" className="tm-index-link"><span className="tm-index-num">05</span>아동 회원과 동의</a>
              <a href="#t6" className="tm-index-link"><span className="tm-index-num">06</span>서비스의 제공 및 변경</a>
              <a href="#t7" className="tm-index-link"><span className="tm-index-num">07</span>이용자의 의무</a>
              <a href="#t8" className="tm-index-link"><span className="tm-index-num">08</span>이용 제한 및 해지</a>
              <a href="#t9" className="tm-index-link"><span className="tm-index-num">09</span>책임의 제한</a>
              <a href="#t10" className="tm-index-link"><span className="tm-index-num">10</span>준거법 및 분쟁의 해결</a>
            </div>
          </div>

          <section id="t1" className="tm-section">
            <h2 className="tm-h2">제1조 {' '}목적</h2>
            <p className="tm-body">본 약관은 CatChap이 제공하는 어린이 교육용 캡챠 학습 서비스 및 관련 제반 서비스의 이용조건 및 절차, 서비스와 이용자의 권리·의무·책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.</p>
          </section>

          <section id="t2" className="tm-section">
            <h2 className="tm-h2">제2조 {' '}용어의 정의</h2>
            <p className="tm-body-lead">본 약관에서 사용하는 용어의 정의는 다음과 같습니다.</p>
            <div className="tm-table">
              <div className="tm-row">
                <div className="tm-row-th">서비스</div>
                <div className="tm-row-td">CatChap이 제공하는 캡챠 기반 어린이 학습 및 학습 분석 서비스</div>
              </div>
              <div className="tm-row">
                <div className="tm-row-th">이용자</div>
                <div className="tm-row-td">본 약관에 동의하고 서비스를 이용하는 학생·학부모·기관 회원</div>
              </div>
              <div className="tm-row">
                <div className="tm-row-th">아동 회원</div>
                <div className="tm-row-td">만 14세 미만의 학생 회원</div>
              </div>
              <div className="tm-row">
                <div className="tm-row-th">법정대리인</div>
                <div className="tm-row-td">아동 회원의 부모 또는 후견인 등 법률상 대리 권한을 가진 자</div>
              </div>
            </div>
          </section>

          <section id="t3" className="tm-section">
            <h2 className="tm-h2">제3조 {' '}약관의 효력 및 변경</h2>
            <ol className="tm-ol">
              <li className="tm-li">본 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력이 발생합니다.</li>
              <li className="tm-li">서비스는 관련 법령을 위배하지 않는 범위에서 본 약관을 개정할 수 있으며, 개정 시 적용일자 및 개정 사유를 명시하여 최소 7일 전(이용자에게 불리한 변경은 30일 전)에 공지합니다.</li>
              <li className="tm-li">이용자가 개정 약관의 적용일까지 거부 의사를 표시하지 않으면 개정 약관에 동의한 것으로 봅니다.</li>
            </ol>
          </section>

          <section id="t4" className="tm-section">
            <h2 className="tm-h2">제4조 {' '}회원가입 및 본인확인</h2>
            <ol className="tm-ol">
              <li className="tm-li">회원가입은 이용자가 약관에 동의하고 가입 신청을 한 후, 서비스가 이를 승낙함으로써 성립합니다.</li>
              <li className="tm-li">서비스는 이메일 인증을 통해 본인확인을 진행하며, 인증이 완료되지 않은 경우 가입이 제한될 수 있습니다.</li>
              <li className="tm-li">이용자는 가입 신청 시 사실에 부합하는 정보를 제공해야 하며, 타인의 정보를 도용해서는 안 됩니다.</li>
            </ol>
          </section>

          <section id="t5" className="tm-section">
            <h2 className="tm-h2">제5조 {' '}아동 회원과 법정대리인의 동의</h2>
            <ol className="tm-ol">
              <li className="tm-li">만 14세 미만 아동이 회원으로 가입하려는 경우 법정대리인의 동의를 받아야 합니다.</li>
              <li className="tm-li">법정대리인은 아동 회원의 서비스 이용 및 개인정보 처리에 대해 언제든지 확인·수정·철회를 요청할 수 있습니다.</li>
              <li className="tm-li">기관을 통해 학급 단위로 가입하는 경우, 기관은 법정대리인의 동의를 확보할 책임이 있습니다.</li>
            </ol>
          </section>

          <section id="t6" className="tm-section">
            <h2 className="tm-h2">제6조 {' '}서비스의 제공 및 변경</h2>
            <ol className="tm-ol">
              <li className="tm-li">서비스는 연중무휴, 1일 24시간 제공함을 원칙으로 합니다.</li>
              <li className="tm-li">서비스는 시스템 점검·보수·교체, 통신 장애 등 부득이한 사유가 있는 경우 서비스 제공을 일시 중단할 수 있으며, 이 경우 사전에 공지합니다.</li>
              <li className="tm-li">서비스는 학습 콘텐츠 및 기능을 개선하기 위해 서비스의 전부 또는 일부를 변경할 수 있습니다.</li>
            </ol>
          </section>

          <section id="t7" className="tm-section">
            <h2 className="tm-h2">제7조 {' '}이용자의 의무</h2>
            <p className="tm-body-lead">이용자는 다음 행위를 하여서는 안 됩니다.</p>
            <ol className="tm-ol">
              <li className="tm-li">타인의 정보 도용 또는 허위 정보 등록</li>
              <li className="tm-li">서비스의 정상적인 운영을 방해하는 행위 및 자동화된 방법으로 데이터를 수집하는 행위</li>
              <li className="tm-li">서비스의 소프트웨어를 역설계·복제·배포하는 행위</li>
              <li className="tm-li">법령 또는 공서양속에 위배되는 행위</li>
            </ol>
          </section>

          <section id="t8" className="tm-section">
            <h2 className="tm-h2">제8조 {' '}서비스 이용 제한 및 계약 해지</h2>
            <ol className="tm-ol">
              <li className="tm-li">이용자가 본 약관을 위반한 경우, 서비스는 사전 통지 후 이용을 제한하거나 계약을 해지할 수 있습니다. 다만 긴급하거나 중대한 위반의 경우 즉시 조치할 수 있습니다.</li>
              <li className="tm-li">이용자는 언제든지 서비스 내 설정 또는 고객센터를 통해 회원 탈퇴를 요청할 수 있으며, 서비스는 지체 없이 이를 처리합니다.</li>
            </ol>
          </section>

          <section id="t9" className="tm-section">
            <h2 className="tm-h2">제9조 {' '}책임의 제한</h2>
            <ol className="tm-ol">
              <li className="tm-li">서비스는 천재지변, 불가항력, 이용자의 귀책사유로 인한 서비스 이용 장애에 대하여 책임을 지지 않습니다.</li>
              <li className="tm-li">서비스가 제공하는 학습 분석 결과는 참고 자료이며, 특정 결과나 성과를 보증하지 않습니다.</li>
              <li className="tm-li">이용자 상호간 또는 이용자와 제3자 간에 발생한 분쟁에 대해서는 서비스가 개입할 의무가 없습니다.</li>
            </ol>
          </section>

          <section id="t10" className="tm-section-last">
            <h2 className="tm-h2">제10조 {' '}준거법 및 분쟁의 해결</h2>
            <p className="tm-body-gap18">본 약관은 대한민국 법령에 따라 규율되며, 서비스와 이용자 간 발생한 분쟁에 대해서는 상호 협의를 통해 원만히 해결함을 원칙으로 합니다. 협의가 이루어지지 않을 경우 관할 법원은 민사소송법에 따릅니다.</p>
            <div className="tm-contact">
              <div className="tm-contact-row"><span className="tm-contact-label">문의</span><span className="tm-contact-value">CatChap 고객지원팀</span></div>
              <div className="tm-contact-row"><span className="tm-contact-label">이메일</span><span className="tm-contact-value">support@catchap.io</span></div>
              <div className="tm-contact-row"><span className="tm-contact-label">운영 시간</span><span className="tm-contact-value">평일 10:00 – 18:00 (주말·공휴일 제외)</span></div>
            </div>
            <p className="tm-note">본 약관은 2026년 7월 1일부터 시행됩니다.</p>
          </section>
        </article>

        <div className="tm-footer-links">
          <Link to={PATHS.HOME} className="tm-footer-link">
            <i className="ph-bold ph-arrow-left tm-footer-icon-left" />메인으로
          </Link>
          <Link to={PATHS.PRIVACY} className="tm-footer-link">
            개인정보 처리방침 보기<i className="ph-bold ph-arrow-right tm-footer-icon-right" />
          </Link>
        </div>
        <p className="tm-copyright">© 2026 CatChap · 카카오클라우드 AIaaS 마스터 클래스 5기</p>
      </div>
    </div>
  );
}
