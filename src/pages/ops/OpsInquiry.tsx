import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OpsNav from '../../components/ops/OpsNav';
import { useAuth } from '../../hooks/useAuth';
import { inquiryApi } from '../../api/misc';
import { errorDetail } from '../../api/lectures';
import { PATHS } from '../../routes/paths';
import './OpsApproval.css';
import './OpsInquiry.css';

/**
 * 강사·운영자 콘솔 문의하기.
 *
 * 공개 문의하기(/contact)와 나눈 이유: 강사가 막히는 지점은 학습자와 전혀 다르다.
 * 영상 업로드·문항 생성·정산처럼 콘솔 안에서만 생기는 일이라, 유형을 그쪽으로 맞추고
 * 각 유형마다 '무엇을 적어야 빨리 해결되는지' 힌트를 붙였다.
 *
 * 로그인 상태이므로 이름·이메일은 계정에서 채운다 — 콘솔 안에서 다시 입력하게 하면
 * 밖으로 나가 공개 양식을 쓰는 것과 다를 게 없다.
 */

/** 강사가 실제로 겪는 상황들. inquiry_type 은 서버에서 자유 문자열(30자)이라 그대로 저장된다. */
const TYPES: { key: string; label: string; icon: string; hint: string }[] = [
  {
    key: '강의 업로드·영상',
    label: '강의 업로드·영상',
    icon: 'ph-fill ph-video-camera',
    hint: '업로드가 실패하거나 재생이 안 되나요? 강의명·파일 크기·형식(mp4 등)과 언제 시도하셨는지 적어 주세요.',
  },
  {
    key: '확인 문항·문항 검수',
    label: '확인 문항·검수',
    icon: 'ph-fill ph-seal-question',
    hint: 'AI 문항이 생성되지 않거나 내용이 이상한가요? 강의명과 해당 문항이 어떤 점에서 문제인지 적어 주세요.',
  },
  {
    key: '코스·수강료 설정',
    label: '코스·수강료',
    icon: 'ph-fill ph-stack',
    hint: '코스 구성이나 가격 설정에서 막히셨나요? 코스명과 원하시는 설정을 알려 주세요.',
  },
  {
    key: '수료 시험·수료증',
    label: '수료 시험·수료증',
    icon: 'ph-fill ph-certificate',
    hint: '수료 시험 문항 등록이나 수료증 발급 관련 문의예요. 코스명을 함께 적어 주세요.',
  },
  {
    key: '수강생·학습 현황',
    label: '수강생·학습 현황',
    icon: 'ph-fill ph-users-three',
    hint: '수강생 진도나 학습 분석 수치가 이상한가요? 어떤 화면의 어떤 숫자인지 알려 주세요.',
  },
  {
    key: '정산·수익',
    label: '정산·수익',
    icon: 'ph-fill ph-receipt',
    hint: '정산 주기·금액·세금계산서 관련 문의예요. 해당 기간을 적어 주세요.',
  },
  {
    key: '계정·권한',
    label: '계정·권한',
    icon: 'ph-fill ph-user-gear',
    hint: '계정 정보 변경이나 접근 권한 문의예요. 어떤 메뉴에 들어가지 못하는지 알려 주세요.',
  },
  {
    key: '오류 신고·기능 제안',
    label: '오류 신고·기능 제안',
    icon: 'ph-fill ph-bug',
    hint: '오류라면 어떤 화면에서 무엇을 눌렀을 때 어떻게 됐는지 순서대로 적어 주시면 빠릅니다.',
  },
];

export default function OpsInquiry() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const [type, setType] = useState(0);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

  const roleLabel = me?.role === 'instructor' ? '강사' : '운영자';

  const submit = async () => {
    const body = content.trim();
    // 한두 마디로는 되묻느라 왕복이 늘어난다. 최소 길이를 안내와 함께 걸어 둔다.
    if (body.length < 10) {
      setErr('문의 내용을 조금 더 자세히 적어 주세요(10자 이상).');
      return;
    }
    setErr('');
    setSending(true);
    try {
      await inquiryApi.submit({
        inquiry_type: TYPES[type].key,
        name: me?.name ?? roleLabel,
        affiliation: roleLabel,
        // 로그인 계정 이메일로 답을 받는다 — 콘솔 안에서 다시 물을 이유가 없다.
        email: me?.email ?? '',
        content: body,
      });
      setSent(true);
    } catch (e) {
      setErr(errorDetail(e, '문의를 보내지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setSent(false);
    setContent('');
    setType(0);
  };

  return (
    <div className="op-root ops-inquiry">
      <OpsNav />
      {/* 폭·여백은 콘솔 공용 .op-main 그대로 — 다른 콘솔 화면과 좌우 정렬선을 맞춘다 */}
      <main className="op-main">
        <div className="op-head">
          <div>
            <h1 className="op-title">문의하기</h1>
            <p className="op-sub">
              콘솔을 쓰다 막히거나 이상한 점이 있으면 알려 주세요. 보통 1영업일 안에 답해 드려요.
            </p>
          </div>
        </div>

        {sent ? (
          <div className="oq-card oq-sent">
            <div className="oq-sent-ic">
              <i className="ph-fill ph-check-circle" />
            </div>
            <h2 className="oq-sent-title">문의가 접수됐어요</h2>
            <p className="oq-sent-desc">
              {me?.email ? <strong>{me.email}</strong> : '가입하신 이메일'}로 답변드릴게요.
              <br />
              보통 1영업일 안에 회신드립니다.
            </p>
            <div className="oq-sent-actions">
              <button className="op-btn op-btn--reject" onClick={reset}>
                새 문의 작성
              </button>
              <button
                className="op-btn op-btn--approve"
                onClick={() => navigate(PATHS.OPS_INSTRUCTOR_HOME)}
              >
                콘솔로 돌아가기
              </button>
            </div>
          </div>
        ) : (
          <div className="oq-grid">
            <div className="oq-card">
              <div className="oq-label">어떤 문의인가요?</div>
              <div className="oq-types">
                {TYPES.map((t, i) => (
                  <button
                    key={t.key}
                    type="button"
                    className={`oq-type${type === i ? ' oq-type--on' : ''}`}
                    onClick={() => setType(i)}
                  >
                    <i className={t.icon} />
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>

              {/* 유형마다 무엇을 적어야 하는지 — 되묻는 왕복을 줄인다 */}
              <p className="oq-hint">
                <i className="ph-fill ph-lightbulb" />
                {TYPES[type].hint}
              </p>

              <label className="oq-label oq-label--mt">문의 내용</label>
              <textarea
                className="oq-textarea"
                rows={9}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="상황을 자유롭게 적어 주세요. 강의명·코스명·화면 이름이 있으면 훨씬 빨리 확인할 수 있어요."
                maxLength={2000}
                disabled={sending}
              />
              <div className="oq-count">{content.length} / 2000</div>

              {err && (
                <div className="oq-err">
                  <i className="ph-fill ph-warning-circle" /> {err}
                </div>
              )}

              <div className="oq-actions">
                <button className="op-btn op-btn--approve" onClick={submit} disabled={sending}>
                  <i className="ph-fill ph-paper-plane-tilt" />
                  {sending ? '보내는 중…' : '문의 보내기'}
                </button>
              </div>
            </div>

            <aside className="oq-side">
              <div className="oq-card oq-me">
                <div className="oq-side-title">이 계정으로 접수돼요</div>
                <div className="oq-me-row">
                  <span className="oq-me-k">이름</span>
                  <span className="oq-me-v">{me?.name ?? '-'}</span>
                </div>
                <div className="oq-me-row">
                  <span className="oq-me-k">역할</span>
                  <span className="oq-me-v">{roleLabel}</span>
                </div>
                <div className="oq-me-row">
                  <span className="oq-me-k">답변 받을 이메일</span>
                  <span className="oq-me-v">{me?.email ?? '-'}</span>
                </div>
                <p className="oq-me-note">
                  이메일을 바꾸려면 프로필에서 수정해 주세요.
                </p>
              </div>

              <div className="oq-card">
                <div className="oq-side-title">먼저 확인해 보세요</div>
                <ul className="oq-tips">
                  <li>
                    영상 업로드는 <strong>최대 5GB</strong>까지예요. 용량이 크면 시간이 오래
                    걸릴 수 있어요.
                  </li>
                  <li>
                    AI 문항 생성은 강의 음성을 전사한 뒤 진행돼서, 강의 길이에 따라 몇 분 걸려요.
                    완료되면 알림이 옵니다.
                  </li>
                  <li>
                    확인 문항이 하나도 없는 강의는 시청 검증이 걸리지 않아요. 강사 홈에서 확인할
                    수 있어요.
                  </li>
                  <li>
                    수강료는 <strong>0원(무료) 또는 100원 이상</strong>만 설정할 수 있어요.
                  </li>
                </ul>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
