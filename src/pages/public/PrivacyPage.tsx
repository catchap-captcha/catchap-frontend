import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { useTheme } from '../../hooks/useTheme';
import wordmark from '../../assets/brand/catchap-wordmark.png';
import wordmarkWhite from '../../assets/brand/catchap-wordmark-white.png';
import './PrivacyPage.css';

export default function PrivacyPage() {
  const { theme } = useTheme();
  return (
    <div className="pv-page">
      {/* NAV — 공개 페이지 공통(문의하기와 동일한 워드마크 내비) */}
      <div className="pv-nav">
        <div className="pv-nav-inner">
          <Link to={PATHS.HOME} className="pv-back-link"><i className="ph-bold ph-arrow-left" />뒤로</Link>
          <div className="pv-nav-divider"></div>
          <Link to={PATHS.HOME} className="pv-brand">
            <img
              src={theme === 'dark' ? wordmarkWhite : wordmark}
              alt="CATCHAP"
              className="pv-brand-wordmark"
            />
          </Link>
          <div className="pv-nav-spacer"></div>
          <Link to={PATHS.LOGIN} className="pv-login-link">로그인</Link>
        </div>
      </div>

      {/* HEADER */}
      <div className="pv-header">
        <span className="pv-badge"><i className="ph-fill ph-shield-check" />개인정보처리방침</span>
        <h1 className="pv-title">개인정보 처리방침</h1>
        <p className="pv-meta">시행일 2026. 07. 01. · 최종 개정 2026. 07. 31. · 버전 v1.3 · 문서번호 CC-PRV-2026</p>
      </div>

      {/* CONTENT SHEET */}
      <div className="pv-sheet-wrap">
        <article className="pv-sheet">
          {/* PREAMBLE */}
          <p className="pv-preamble">
            CatChap(이하 ‘서비스’)은 이용자의 개인정보를 소중히 다루며 「개인정보 보호법」 등 관련 법령을 준수합니다. 서비스는 영상 강의를 실제로 시청·이해했는지 확인하는 시청 검증형 온라인 강의 플랫폼으로, 회원 인증에 필요한 정보와 학습·시청 행동 데이터를 분리하여 최소한으로만 수집·이용합니다. 만 14세 미만 이용자는 법정대리인의 동의 아래에서만 가입·이용할 수 있습니다.
          </p>

          {/* INDEX */}
          <div className="pv-index">
            <div className="pv-index-title">목 차</div>
            <div className="pv-index-grid">
              <a href="#p1" className="pv-index-link"><span className="pv-index-num">01</span>수집하는 개인정보 항목</a>
              <a href="#p2" className="pv-index-link"><span className="pv-index-num">02</span>수집 및 이용 목적</a>
              <a href="#p3" className="pv-index-link"><span className="pv-index-num">03</span>만 14세 미만 이용자</a>
              <a href="#p4" className="pv-index-link"><span className="pv-index-num">04</span>보유 및 이용 기간</a>
              <a href="#p5" className="pv-index-link"><span className="pv-index-num">05</span>개인정보의 제3자 제공</a>
              <a href="#p6" className="pv-index-link"><span className="pv-index-num">06</span>개인정보 처리의 위탁</a>
              <a href="#p7" className="pv-index-link"><span className="pv-index-num">07</span>정보주체의 권리</a>
              <a href="#p8" className="pv-index-link"><span className="pv-index-num">08</span>안전성 확보 조치</a>
              <a href="#p9" className="pv-index-link"><span className="pv-index-num">09</span>개인정보 보호책임자</a>
            </div>
          </div>

          <section id="p1" className="pv-section">
            <h2 className="pv-h2">제1조 {' '}수집하는 개인정보 항목</h2>
            <p className="pv-body-lead">서비스는 회원 유형에 따라 아래와 같은 최소한의 개인정보를 수집합니다.</p>
            <div className="pv-table">
              <div className="pv-row">
                <div className="pv-row-th">학생</div>
                <div className="pv-row-td">아이디·이메일, 닉네임, 수강·시청 기록(진도·완주), 확인문제 풀이 행동 로그(풀이 경로·소요 시간·재시도), 수료 이력</div>
              </div>
              <div className="pv-row">
                <div className="pv-row-th">강사</div>
                <div className="pv-row-td">이름·이메일, 담당 강의·코스 정보, 수강료 정산에 필요한 정보</div>
              </div>
              <div className="pv-row">
                <div className="pv-row-th">기관</div>
                <div className="pv-row-td">기관명, 담당자 이름·이메일·연락처, 사업자 정보, 결제 내역</div>
              </div>
              <div className="pv-row">
                <div className="pv-row-th">자동 수집</div>
                <div className="pv-row-td">접속 IP, 브라우저·기기 정보, 쿠키, 서비스 이용 기록(보안 및 오류 분석 목적)</div>
              </div>
            </div>
            <p className="pv-note">카드 등 결제수단 정보는 결제대행사(PG)가 처리하며, 서비스는 이를 저장하지 않습니다.</p>
          </section>

          <section id="p2" className="pv-section">
            <h2 className="pv-h2">제2조 {' '}개인정보의 수집 및 이용 목적</h2>
            <p className="pv-body-lead">수집한 개인정보는 다음의 목적으로만 이용하며, 목적이 변경될 경우 사전에 동의를 받습니다.</p>
            <ol className="pv-ol">
              <li className="pv-li">회원 식별 및 인증, 서비스 로그인·본인확인(이메일 인증)</li>
              <li className="pv-li">강의 수강 제공 및 시청 검증(재생 중 확인문제 출제·정오 판정)</li>
              <li className="pv-li">학습 진도·수료 관리 및 학습 리포트 제공</li>
              <li className="pv-li">수강료 결제·환불 처리 및 강사·기관 정산</li>
              <li className="pv-li">부정 이용·시청 검증 우회 탐지, 보안 위협 대응 및 시스템 안정성 확보</li>
              <li className="pv-li">고객 문의 대응 및 공지사항 전달</li>
            </ol>
          </section>

          <section id="p3" className="pv-section">
            <h2 className="pv-h2">제3조 {' '}만 14세 미만 이용자의 개인정보 처리</h2>
            <p className="pv-body-lead">서비스는 만 14세 미만 이용자의 개인정보를 처리할 때 「개인정보 보호법」 제22조의2에 따라 다음을 준수합니다.</p>
            <ol className="pv-ol">
              <li className="pv-li">개인정보 수집·이용 시 법정대리인의 동의를 받습니다.</li>
              <li className="pv-li">알기 쉬운 표현으로 개인정보 처리 내용을 안내합니다.</li>
              <li className="pv-li">실명 대신 가명(닉네임)을 사용하여 식별 위험을 최소화합니다.</li>
              <li className="pv-li">법정대리인은 언제든지 개인정보의 열람·정정·삭제를 요청할 수 있습니다.</li>
            </ol>
          </section>

          <section id="p4" className="pv-section">
            <h2 className="pv-h2">제4조 {' '}개인정보의 보유 및 이용 기간</h2>
            <p className="pv-body-lead">원칙적으로 개인정보의 수집·이용 목적이 달성되면 지체 없이 파기합니다. 다만 관련 법령에 따라 아래 정보는 명시된 기간 동안 보관합니다.</p>
            <ol className="pv-ol">
              <li className="pv-li">회원 가입 및 관리 정보 — 회원 탈퇴 시까지</li>
              <li className="pv-li">계약·결제 및 재화·서비스 공급 기록 — 5년 (전자상거래법)</li>
              <li className="pv-li">소비자 불만 및 분쟁 처리 기록 — 3년 (전자상거래법)</li>
              <li className="pv-li">서비스 접속 로그 — 3개월 (통신비밀보호법)</li>
            </ol>
          </section>

          <section id="p5" className="pv-section">
            <h2 className="pv-h2">제5조 {' '}개인정보의 제3자 제공</h2>
            <p className="pv-body">서비스는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만 이용자가 사전에 동의한 경우, 또는 법령의 규정에 의거하거나 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우에 한하여 제공합니다.</p>
          </section>

          <section id="p6" className="pv-section">
            <h2 className="pv-h2">제6조 {' '}개인정보 처리의 위탁</h2>
            <p className="pv-body-lead">서비스는 원활한 운영을 위해 아래와 같이 개인정보 처리 업무를 위탁하며, 위탁 시 관련 법령에 따라 안전하게 관리되도록 필요한 사항을 규정합니다.</p>
            <div className="pv-table">
              <div className="pv-row-wide">
                <div className="pv-row-th">카카오클라우드</div>
                <div className="pv-row-td">클라우드 인프라 및 데이터 보관</div>
              </div>
              <div className="pv-row-wide">
                <div className="pv-row-th">결제대행사(PG)</div>
                <div className="pv-row-td">수강료 결제 및 환불 처리</div>
              </div>
              <div className="pv-row-wide">
                <div className="pv-row-th">이메일 발송 대행사</div>
                <div className="pv-row-td">본인확인 인증코드 및 알림 이메일 발송</div>
              </div>
            </div>
          </section>

          <section id="p7" className="pv-section">
            <h2 className="pv-h2">제7조 {' '}정보주체와 법정대리인의 권리</h2>
            <p className="pv-body-lead">이용자 및 법정대리인은 언제든지 다음의 권리를 행사할 수 있습니다.</p>
            <ol className="pv-ol-lead">
              <li className="pv-li">개인정보 열람 요구</li>
              <li className="pv-li">오류에 대한 정정 요구</li>
              <li className="pv-li">삭제 요구 및 처리 정지 요구</li>
            </ol>
            <p className="pv-body">권리 행사는 서비스 내 설정 또는 개인정보 보호책임자에게 서면·이메일로 요청할 수 있으며, 서비스는 지체 없이 조치합니다.</p>
          </section>

          <section id="p8" className="pv-section">
            <h2 className="pv-h2">제8조 {' '}개인정보의 안전성 확보 조치</h2>
            <p className="pv-body-lead">서비스는 개인정보의 안전한 처리를 위해 다음과 같은 기술적·관리적 조치를 시행합니다.</p>
            <ol className="pv-ol">
              <li className="pv-li">인증 데이터와 학습·시청 행동 데이터의 분리 저장 및 접근 권한 최소화</li>
              <li className="pv-li">개인정보의 암호화 저장 및 전송 구간 암호화(SSL/TLS)</li>
              <li className="pv-li">접속 기록 보관 및 위·변조 방지</li>
              <li className="pv-li">최소 수집 원칙 적용 및 정기적인 접근 권한 점검</li>
            </ol>
          </section>

          <section id="p9" className="pv-section-last">
            <h2 className="pv-h2">제9조 {' '}개인정보 보호책임자</h2>
            <p className="pv-body-gap18">개인정보 처리에 관한 문의, 불만 처리, 피해 구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.</p>
            <div className="pv-contact">
              <div className="pv-contact-row"><span className="pv-contact-label">책임자</span><span className="pv-contact-value">CatChap 개인정보 보호팀</span></div>
              <div className="pv-contact-row"><span className="pv-contact-label">이메일</span><span className="pv-contact-value">privacy@catchap.io</span></div>
              <div className="pv-contact-row"><span className="pv-contact-label">문의 시간</span><span className="pv-contact-value">평일 10:00 – 18:00 (주말·공휴일 제외)</span></div>
            </div>
            <p className="pv-note">기타 개인정보 침해에 대한 신고·상담이 필요하신 경우 개인정보침해신고센터(privacy.kisa.or.kr / 118), 대검찰청 사이버수사과(spo.go.kr / 1301), 경찰청 사이버수사국(ecrm.police.go.kr / 182)으로 문의하실 수 있습니다.</p>
          </section>
        </article>

        <div className="pv-footer-links">
          <Link to={PATHS.HOME} className="pv-footer-link">
            <i className="ph-bold ph-arrow-left pv-footer-icon-left" />메인으로
          </Link>
          <Link to={PATHS.TERMS} className="pv-footer-link">
            이용약관 보기<i className="ph-bold ph-arrow-right pv-footer-icon-right" />
          </Link>
        </div>
        <p className="pv-copyright">© 2026 CatChap · 카카오클라우드 AIaaS 마스터 클래스 5기</p>
      </div>
    </div>
  );
}
