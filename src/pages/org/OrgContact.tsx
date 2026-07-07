import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { useAuth } from '../../hooks/useAuth';
import { inquiryApi } from '../../api/misc';
import OrgLayout from '../../layouts/OrgLayout';
import './OrgContact.css';

/** 관리자 문의 폼 — 사이드바 '문의하기' 버튼 연동 (POST /inquiries 실백엔드 접수) */

// 이미 도입한 기관의 운영 문의 유형 (신규 도입 문의는 공개 '문의하기' 페이지에서 받음)
const TYPES = [
  { key: '계약·요금제 변경', icon: 'ph-fill ph-file-text' },
  { key: '정산·결제', icon: 'ph-fill ph-credit-card' },
  { key: '기술 지원·오류', icon: 'ph-fill ph-wrench' },
  { key: '계정·권한', icon: 'ph-fill ph-user-gear' },
  { key: '데이터·보안', icon: 'ph-fill ph-shield-check' },
  { key: '기타', icon: 'ph-fill ph-chat-circle-dots' },
];

export default function OrgContact() {
  const { me } = useAuth();
  const [type, setType] = useState(TYPES[0].key);
  const [content, setContent] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  const submit = () => {
    const body = content.trim();
    if (!body || state === 'sending') return;
    setState('sending');
    inquiryApi
      .submit({
        inquiry_type: type,
        name: me?.name ?? '기관 관리자',
        affiliation: me?.organization_name ?? undefined,
        email: me?.email ?? 'unknown@catchap.io',
        content: body,
      })
      .then(() => setState('done'))
      .catch(() => setState('error'));
  };

  return (
    <OrgLayout active={null} widget="none">
      <div className="ogc-head">
        <div className="ogc-breadcrumb">
          <Link to={PATHS.ORG_CLASSES}>기관 콘솔</Link>
          <i className="ph-bold ph-caret-right" />
          <span>관리자 문의</span>
        </div>
        <h1 className="ogc-title">관리자 문의</h1>
        <p className="ogc-sub">이용 중 생긴 계약·정산·기술 문의를 남기면 전담 매니저가 이메일로 답변드려요.</p>
      </div>

      {state === 'done' ? (
        <div className="ogc-done">
          <span className="ogc-doneIcon"><i className="ph-fill ph-check-circle" /></span>
          <h2 className="ogc-doneTitle">문의가 접수됐어요</h2>
          <p className="ogc-doneText">
            <b>{me?.email}</b>(으)로 답변을 보내드릴게요.<br />영업일 기준 1~2일 안에 전담 매니저가 연락드려요.
          </p>
          <button
            className="ogc-doneBtn"
            onClick={() => {
              setContent('');
              setState('idle');
            }}
          >
            <i className="ph-bold ph-plus" />새 문의 작성
          </button>
        </div>
      ) : (
        <div className="ogc-card">
          <label className="ogc-label">문의 유형</label>
          <div className="ogc-types">
            {TYPES.map((t) => (
              <button
                key={t.key}
                className={type === t.key ? 'ogc-type ogc-typeOn' : 'ogc-type'}
                onClick={() => setType(t.key)}
              >
                <i className={t.icon} />
                {t.key}
              </button>
            ))}
          </div>

          <div className="ogc-row">
            <div className="ogc-field">
              <label className="ogc-label">담당자</label>
              <div className="ogc-readonly">
                <i className="ph-fill ph-user" />
                {me?.name ?? '—'}
              </div>
            </div>
            <div className="ogc-field">
              <label className="ogc-label">답변 받을 이메일</label>
              <div className="ogc-readonly">
                <i className="ph-fill ph-envelope-simple" />
                {me?.email ?? '—'}
              </div>
            </div>
          </div>
          <div className="ogc-field">
            <label className="ogc-label">소속 기관</label>
            <div className="ogc-readonly">
              <i className="ph-fill ph-buildings" />
              {me?.organization_name ?? '—'}
            </div>
          </div>

          <label className="ogc-label">문의 내용</label>
          <textarea
            className="ogc-textarea"
            value={content}
            maxLength={5000}
            placeholder="문의하실 내용을 자세히 적어주세요. (예: 학생 수 확대에 따른 요금제 변경 문의)"
            onChange={(e) => setContent(e.target.value)}
          />
          <div className="ogc-count">{content.length} / 5000</div>

          {state === 'error' && (
            <div className="ogc-error">
              <i className="ph-fill ph-warning-circle" />
              접수에 실패했어요. 잠시 후 다시 시도해 주세요.
            </div>
          )}

          <button className="ogc-submit" disabled={!content.trim() || state === 'sending'} onClick={submit}>
            <i className="ph-fill ph-paper-plane-tilt" />
            {state === 'sending' ? '접수 중…' : '문의 접수하기'}
          </button>
        </div>
      )}
    </OrgLayout>
  );
}
