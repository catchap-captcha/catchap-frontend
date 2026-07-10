import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { useAuth } from '../../hooks/useAuth';
import { orgApi } from '../../api/org';
import OrgLayout from '../../layouts/OrgLayout';
import './SecurityPolicy.css';

/** handoff `CatChap 보안정책.dc.html` 포팅 — 보안·정책 센터 (콘텐츠는 원본 하드코딩 그대로, 정적) */

type SyTab = 'privacy' | 'behavior' | 'child' | 'retention';

interface SySection {
  heading: string;
  body: string;
  items: string[];
}

interface SyDoc {
  label: string;
  icon: string;
  title: string;
  intro: string;
  sections: SySection[];
}

const DOCS: Record<SyTab, SyDoc> = {
  privacy: {
    label: '개인정보 처리방침',
    icon: 'ph-fill ph-lock-key',
    title: '개인정보 처리방침',
    intro:
      'CatChap은 어린이 학습 서비스를 제공하며, 개인정보보호법 및 아동 개인정보 보호 기준에 따라 최소한의 정보만 수집·이용합니다.',
    sections: [
      { heading: '수집하는 개인정보 항목', body: '서비스 제공에 꼭 필요한 최소 항목만 수집합니다.', items: ['필수: 학생 별명, 학년, 소속 기관 코드, 학습 기록', '보호자: 성명, 이메일 또는 휴대전화(알림·동의용)', '자동 수집: 접속 로그, 기기·브라우저 정보, 캡차 응답 로그'] },
      { heading: '개인정보의 이용 목적', body: '수집한 정보는 아래 목적으로만 이용하며, 목적이 달라질 경우 별도 동의를 받습니다.', items: ['학습 콘텐츠 제공 및 성취도 분석', '봇 차단(캡차) 및 부정 사용 방지', '보호자·교사 대상 학습 리포트 및 알림 제공'] },
      { heading: '보유 및 이용 기간', body: '학습 기록은 수집일로부터 1년간 보관 후 지체 없이 파기합니다. 법령에 별도 보존 의무가 있는 경우 해당 기간 동안 분리 보관합니다.', items: [] },
      { heading: '제3자 제공 및 처리위탁', body: 'CatChap은 이용자의 개인정보를 외부에 판매하지 않습니다. 서비스 운영에 필요한 클라우드·알림 발송은 계약을 통해 위탁하며, 위탁 현황은 본 페이지의 관련 문서에서 확인할 수 있습니다.', items: [] },
      { heading: '이용자의 권리', body: '학생 본인 및 법정대리인은 언제든 개인정보 열람·정정·삭제·처리정지를 요구할 수 있으며, 보호자 계정 또는 개인정보 보호책임자를 통해 신청할 수 있습니다.', items: [] },
    ],
  },
  behavior: {
    label: '행동 데이터 방침',
    icon: 'ph-fill ph-cursor-click',
    title: '행동 데이터 방침',
    intro: '학습 개선과 봇 탐지를 위해 수집하는 상호작용(행동) 데이터의 범위와 사용 원칙을 안내합니다.',
    sections: [
      { heading: '수집하는 행동 데이터', body: '문제 풀이 과정에서 발생하는 상호작용 신호를 수집합니다.', items: ['정답·오답 여부, 시도 횟수, 풀이 소요 시간', '터치/클릭 좌표의 근접 실패(near_miss), 드래그 궤적 요약', '캡차 유형별 응답 결과 및 위험 신호(low/review/elevated)'] },
      { heading: '봇 탐지와 아동 조작 미숙의 분리', body: '어린이의 조작 미숙(예: 목표 근처 터치 실패)은 봇 위험 신호와 명확히 분리해 채점합니다. 조작 미숙은 학습 난이도 조정에만 활용되며, 계정 제한 사유가 되지 않습니다.', items: [] },
      { heading: '가명·익명 처리', body: '행동 데이터는 학생 식별정보와 분리된 가명 식별자로 저장되며, 통계·분석 목적에는 익명 처리된 집계값만 사용합니다.', items: [] },
      { heading: 'AI 학습 활용 여부', body: '어린이 학습·행동 데이터는 외부 상용 AI 모델의 학습에 사용되지 않습니다. 문제·힌트 생성 모델은 사전 검증된 데이터로만 학습됩니다.', items: [] },
      { heading: '보관 및 파기', body: '원시 행동 로그는 최대 90일간 보관 후 자동 파기하며, 익명 집계 지표만 분석 목적으로 유지합니다.', items: [] },
    ],
  },
  child: {
    label: '아동 보호 정책',
    icon: 'ph-fill ph-baby',
    title: '아동 보호 정책',
    intro: '만 14세 미만 아동을 주 이용자로 하는 서비스로서, 아동의 안전과 개인정보를 최우선으로 보호합니다.',
    sections: [
      { heading: '법정대리인 동의', body: '만 14세 미만 아동의 개인정보는 법정대리인(보호자)의 동의를 받은 후에만 수집·이용합니다. 동의는 보호자 계정 연결 시 확인하며, 언제든 철회할 수 있습니다.', items: [] },
      { heading: '최소 수집 원칙', body: '실명 대신 별명을 사용하고, 주소·주민등록번호 등 민감정보는 수집하지 않습니다. 학습에 불필요한 정보는 요구하지 않습니다.', items: [] },
      { heading: '안전한 콘텐츠', body: 'AI가 생성하는 문제·힌트·대화는 아동 안전 필터를 거쳐 제공되며, 부적절한 표현이 노출되지 않도록 상시 모니터링합니다.', items: [] },
      { heading: '광고 및 상업적 이용 금지', body: '아동을 대상으로 한 맞춤형 광고를 제공하지 않으며, 행동 데이터를 광고 목적으로 이용하지 않습니다.', items: [] },
    ],
  },
  retention: {
    label: '데이터 보관·파기',
    icon: 'ph-fill ph-database',
    title: '데이터 보관 · 파기 정책',
    intro: '데이터 종류별 보관 기간과 안전한 파기 절차를 정의합니다.',
    sections: [
      { heading: '항목별 보관 기간', body: '데이터 성격에 따라 보관 기간을 차등 적용합니다.', items: ['학습 기록·성취 데이터: 1년', '원시 행동/캡차 로그: 90일', '접속 로그: 관련 법령에 따라 3개월', '탈퇴 계정 정보: 지체 없이 파기(법령상 보존 항목 제외)'] },
      { heading: '파기 방법', body: '전자적 파일은 복구 불가능한 방식으로 완전 삭제하고, 출력물은 분쇄 또는 소각합니다.', items: [] },
      { heading: '접근 통제', body: '개인정보에 접근할 수 있는 인원을 최소한으로 지정하고, 접근 기록을 로그로 남겨 정기 점검합니다. 저장 데이터는 AES-256으로 암호화합니다.', items: [] },
      { heading: '유출 대응', body: '개인정보 유출이 확인되면 관련 법령에 따라 지체 없이 이용자와 보호자에게 통지하고 감독기관에 신고하며, 재발 방지 대책을 수립합니다.', items: [] },
    ],
  },
};

const TAB_KEYS = Object.keys(DOCS) as SyTab[];

export default function SecurityPolicy() {
  const { me } = useAuth();
  const orgId = me?.organization_id ?? null;
  const [tab, setTab] = useState<SyTab>('privacy');
  // 단위 %는 별도 span으로 렌더 — 숫자 부분만 상태로 관리 (API는 "98.6%" 문자열). 실집계 전엔 0.
  const [consentRate, setConsentRate] = useState('0');
  const doc = DOCS[tab];

  useEffect(() => {
    if (!orgId) return;
    let on = true;
    orgApi
      .securityStats(orgId)
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      .then((res: any) => {
        if (!on || typeof res?.consent_rate !== 'string' || !res.consent_rate) return;
        setConsentRate(res.consent_rate.replace(/%$/, ''));
      })
      .catch(() => {
        // TODO(api): 실패 시 FALLBACK_CONSENT_RATE 유지
      });
    return () => {
      on = false;
    };
  }, [orgId]);

  return (
    <OrgLayout active="security" widget="compliance">
      {/* HEADER */}
      <div className="sy-header">
        <div>
          <div className="sy-breadcrumb">
            <Link to={PATHS.ORG_HOME}>기관 콘솔</Link>
            <i className="ph-bold ph-caret-right" />
            <span>보안·정책</span>
          </div>
          <h1 className="sy-title">보안 · 정책 센터</h1>
          <p className="sy-subtitle">
            개인정보 처리방침, 행동 데이터 방침, 아동 보호와 데이터 보관 정책을 한곳에서 확인해요. · 최종 개정 2026-07-01
          </p>
        </div>
        <button className="sy-pdfBtn">
          <i className="ph-fill ph-file-pdf" />전체 방침 PDF
        </button>
      </div>

      {/* STATUS ROW */}
      <div className="sy-statusRow">
        <div className="sy-statusCard">
          <span className="sy-statusIcon" style={{ background: '#E1F5EC', color: '#17B08C' }}>
            <i className="ph-fill ph-lock-key" />
          </span>
          <div className="sy-statusValue">AES-256</div>
          <div className="sy-statusLabel">저장 데이터 암호화</div>
        </div>
        <div className="sy-statusCard">
          <span className="sy-statusIcon" style={{ background: '#E6F0FF', color: '#2E7BFF' }}>
            <i className="ph-fill ph-calendar-x" />
          </span>
          <div className="sy-statusValue">1년</div>
          <div className="sy-statusLabel">학습 기록 보관 기간</div>
        </div>
        <div className="sy-statusCard">
          <span className="sy-statusIcon" style={{ background: '#EDE9FF', color: '#8B6BFF' }}>
            <i className="ph-fill ph-user-circle-check" />
          </span>
          <div className="sy-statusValue">
            {consentRate}<span className="sy-statusUnit">%</span>
          </div>
          <div className="sy-statusLabel">보호자 동의 완료율</div>
        </div>
        <div className="sy-statusCard">
          <span className="sy-statusIcon" style={{ background: '#FFF3D6', color: '#F0A400' }}>
            <i className="ph-fill ph-shield-star" />
          </span>
          <div className="sy-statusValue">지정 완료</div>
          <div className="sy-statusLabel">개인정보 보호책임자</div>
        </div>
      </div>

      <div className="sy-grid">
        {/* POLICY BODY */}
        <div className="sy-policy">
          <div className="sy-tabs">
            {TAB_KEYS.map((k) => (
              <button
                key={k}
                className={tab === k ? 'sy-tab sy-tabOn' : 'sy-tab'}
                onClick={() => setTab(k)}
              >
                <i className={DOCS[k].icon} />
                {DOCS[k].label}
              </button>
            ))}
          </div>
          <div className="sy-doc">
            <h2 className="sy-docTitle">{doc.title}</h2>
            <p className="sy-docIntro">{doc.intro}</p>
            <div className="sy-sections">
              {doc.sections.map((s, i) => (
                <div className="sy-section" key={s.heading}>
                  <span className="sy-sectionNo">{i + 1}</span>
                  <div className="sy-sectionBody">
                    <h3 className="sy-sectionHeading">{s.heading}</h3>
                    <p className="sy-sectionText">{s.body}</p>
                    {s.items.length > 0 && (
                      <ul className="sy-sectionList">
                        {s.items.map((it) => (
                          <li key={it}>{it}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SIDE INFO */}
        <div className="sy-side">
          <div className="sy-sideCard">
            <div className="sy-sideHead">
              <span className="sy-sideHeadIcon">
                <i className="ph-fill ph-user-focus" />
              </span>
              <h3 className="sy-sideTitle">개인정보 보호책임자</h3>
            </div>
            <div className="sy-officerList">
              <div className="sy-officerRow">
                <span className="sy-officerKey">성명</span>
                <span className="sy-officerVal">김보안</span>
              </div>
              <div className="sy-officerRow">
                <span className="sy-officerKey">직위</span>
                <span className="sy-officerVal">정보보호팀장</span>
              </div>
              <div className="sy-officerRow">
                <span className="sy-officerKey">이메일</span>
                <span className="sy-officerMono">privacy@catchap.kr</span>
              </div>
              <div className="sy-officerRow">
                <span className="sy-officerKey">문의</span>
                <span className="sy-officerValLight">1588-0000</span>
              </div>
            </div>
          </div>
          <div className="sy-sideCard">
            <h3 className="sy-docsTitle">관련 문서</h3>
            <div className="sy-docLinks">
              <Link to={PATHS.PRIVACY} className="sy-docLink">
                <i className="ph-fill ph-file-text sy-docLinkIcon" style={{ color: '#8B6BFF' }} />
                개인정보 처리방침 전문
                <i className="ph-bold ph-arrow-up-right sy-docLinkArrow" />
              </Link>
              <Link to={PATHS.TERMS} className="sy-docLink">
                <i className="ph-fill ph-scroll sy-docLinkIcon" style={{ color: '#2E7BFF' }} />
                서비스 이용약관
                <i className="ph-bold ph-arrow-up-right sy-docLinkArrow" />
              </Link>
              <a href="#" className="sy-docLink" onClick={(e) => e.preventDefault()}>
                <i className="ph-fill ph-download-simple sy-docLinkIcon" style={{ color: '#17B08C' }} />
                데이터 처리 위탁 현황
                <i className="ph-bold ph-arrow-up-right sy-docLinkArrow" />
              </a>
            </div>
          </div>
          <div className="sy-childCard">
            <div className="sy-childHead">
              <i className="ph-fill ph-baby" />
              <span className="sy-childTitle">아동 보호 우선</span>
            </div>
            <p className="sy-childText">
              만 14세 미만 아동의 개인정보는 법정대리인(보호자) 동의 후에만 수집하며, 최소한의 항목만 처리합니다.
            </p>
          </div>
        </div>
      </div>
    </OrgLayout>
  );
}
