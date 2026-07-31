import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StudentLayout from '../../layouts/StudentLayout';
import { useAuth } from '../../hooks/useAuth';
import { inquiryApi } from '../../api/misc';
import { errorDetail } from '../../api/lectures';
import { PATHS } from '../../routes/paths';
import './StudentInquiry.css';

/**
 * 학생 콘솔 문의하기 — 공개 /contact(로그인 없이 오는 방문자용)와 나눈 이유는, 로그인한
 * 학습자가 겪는 문제가 다르기 때문이다. 수강·결제·시청 오류·수료처럼 학습 중 생기는 일에
 * 유형을 맞추고, 이름은 계정에서 채운다(콘솔 안에서 다시 입력하게 하지 않는다).
 */
const TYPES: { key: string; label: string; icon: string; hint: string }[] = [
  { key: '수강·학습', label: '수강·학습', icon: 'ph-books', hint: '어떤 강의·코스가 궁금하신가요? 강의명·코스명을 함께 적어 주시면 빠르게 도와드려요.' },
  { key: '결제·환불', label: '결제·환불', icon: 'ph-receipt', hint: '결제·환불 관련 문의예요. 주문 번호나 코스명을 적어 주세요.' },
  { key: '영상·시청 오류', label: '영상·시청 오류', icon: 'ph-warning-circle', hint: '영상이 안 나오거나 자꾸 멈추나요? 사용 기기·브라우저와 강의명을 알려 주세요.' },
  { key: '수료·수료증', label: '수료·수료증', icon: 'ph-certificate', hint: '수료 시험·수료증 관련 문의예요. 코스명을 함께 적어 주세요.' },
  { key: '계정·로그인', label: '계정·로그인', icon: 'ph-user-gear', hint: '로그인·비밀번호·계정 정보 문의예요. 어떤 상황인지 알려 주세요.' },
  { key: '기타', label: '기타', icon: 'ph-chat-circle-dots', hint: '그 외 궁금한 점을 자유롭게 적어 주세요.' },
];

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export default function StudentInquiry() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const [type, setType] = useState(0);
  // 답변 받을 이메일 — 계정 이메일이 있으면 채우고, 없으면(학생 로그인 ID가 이메일이 아닐 수 있어) 직접 입력.
  const [email, setEmail] = useState(me?.email ?? '');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    const body = content.trim();
    if (body.length < 10) {
      setErr('문의 내용을 조금 더 자세히 적어 주세요(10자 이상).');
      return;
    }
    if (!isEmail(email.trim())) {
      setErr('답변 받을 이메일을 정확히 입력해 주세요.');
      return;
    }
    setErr('');
    setSending(true);
    try {
      await inquiryApi.submit({
        inquiry_type: TYPES[type].key,
        name: me?.name ?? '학습자',
        affiliation: '학습자',
        email: email.trim(),
        content: body,
      });
      setSent(true);
    } catch (e) {
      setErr(errorDetail(e, '문의를 보내지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <StudentLayout className="si-root">
      <section className="si-wrap">
        <div className="si-head">
          <h1 className="si-title">문의하기</h1>
          <p className="si-sub">학습 중 막히거나 궁금한 점이 있으면 알려 주세요. 보통 1영업일 안에 답해 드려요.</p>
        </div>

        {sent ? (
          <div className="si-card si-sent">
            <div className="si-sent-ic">
              <i className="ph-fill ph-check-circle" />
            </div>
            <h2 className="si-sent-title">문의가 접수됐어요</h2>
            <p className="si-sent-desc">
              <strong>{email}</strong>로 답변드릴게요.
              <br />
              보통 1영업일 안에 회신드립니다.
            </p>
            <div className="si-sent-actions">
              <button
                className="si-btn si-btn--ghost"
                onClick={() => {
                  setSent(false);
                  setContent('');
                  setType(0);
                }}
              >
                새 문의 작성
              </button>
              <button className="si-btn si-btn--primary" onClick={() => navigate(PATHS.STUDENT_HOME)}>
                홈으로 돌아가기
              </button>
            </div>
          </div>
        ) : (
          <div className="si-card">
            <div className="si-label">어떤 문의인가요?</div>
            <div className="si-types">
              {TYPES.map((t, i) => (
                <button
                  key={t.key}
                  type="button"
                  className={`si-type${type === i ? ' si-type--on' : ''}`}
                  onClick={() => setType(i)}
                >
                  <i className={`ph-fill ${t.icon}`} />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            <p className="si-hint">
              <i className="ph-fill ph-lightbulb" />
              {TYPES[type].hint}
            </p>

            <label className="si-label si-label--mt" htmlFor="si-email">
              답변 받을 이메일
            </label>
            <input
              id="si-email"
              className="si-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="답변받으실 이메일을 입력해 주세요"
              disabled={sending}
            />

            <label className="si-label si-label--mt" htmlFor="si-content">
              문의 내용
            </label>
            <textarea
              id="si-content"
              className="si-textarea"
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="상황을 자유롭게 적어 주세요. 강의명·코스명·화면 이름이 있으면 훨씬 빨리 확인할 수 있어요."
              maxLength={2000}
              disabled={sending}
            />
            <div className="si-count">{content.length} / 2000</div>

            {err && (
              <div className="si-err">
                <i className="ph-fill ph-warning-circle" /> {err}
              </div>
            )}

            <div className="si-actions">
              <button className="si-btn si-btn--primary" onClick={submit} disabled={sending}>
                <i className="ph-fill ph-paper-plane-tilt" />
                {sending ? '보내는 중…' : '문의 보내기'}
              </button>
            </div>
          </div>
        )}
      </section>
    </StudentLayout>
  );
}
