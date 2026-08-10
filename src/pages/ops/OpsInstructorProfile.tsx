import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { settingsApi } from '../../api/settings';
import { loadInstructorBio, saveInstructorBio } from '../../api/instructorBio';
import OpsNav from '../../components/ops/OpsNav';
import SocialConnections from '../../components/account/SocialConnections';
import { PATHS } from '../../routes/paths';
import './OpsApproval.css';
import './OpsInstructorProfile.css';

/**
 * 강사 프로필 — 상단바 아바타 클릭 시 착지하는 화면.
 *
 * 왜: 종전엔 아바타를 누르면 프로필 확인 없이 곧장 '비밀번호 변경' 모달이 떠서 어색했다
 * (운영자는 '운영자 계정 관리' 페이지로 가는데 강사만 예외). 이름·이메일·역할을 보여주는
 * 프로필 화면을 두고, 비밀번호 변경은 그 안의 한 액션(모달)으로 옮겼다.
 */
export default function OpsInstructorProfile() {
  const { me } = useAuth();

  const [pwOpen, setPwOpen] = useState(false);
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const roleLabel = me?.role === 'ops' ? '운영자' : '강사';
  const name = me?.name ?? roleLabel;
  const avatarInitial = name.slice(0, 1);

  // ---- 강사 이력 — 학생의 '강사 소개' 모달에 그대로 실리는 내용 ----
  const [headline, setHeadline] = useState('');
  const [career, setCareer] = useState('');
  const [bioSavedAt, setBioSavedAt] = useState<string | null>(null);
  const [bioMsg, setBioMsg] = useState('');
  const [bioErr, setBioErr] = useState('');
  // me는 비동기로 채워지므로 이름이 잡히는 시점에 저장된 이력을 끌어온다.
  useEffect(() => {
    if (!me?.name) return;
    const saved = loadInstructorBio(me.name);
    setHeadline(saved?.headline ?? '');
    setCareer(saved?.career ?? '');
    setBioSavedAt(saved?.updatedAt ?? null);
  }, [me?.name]);

  const saveBio = () => {
    if (!me?.name) return setBioErr('계정 정보를 불러오는 중이에요. 잠시 후 다시 시도해 주세요.');
    setBioErr('');
    setBioMsg('');
    const saved = saveInstructorBio(me.name, { headline, career });
    if (!saved) return setBioErr('저장에 실패했어요. 브라우저 저장공간을 확인해 주세요.');
    setBioSavedAt(saved.updatedAt);
    setBioMsg('이력을 저장했어요. 학생의 ‘강사 소개’에 바로 보여요.');
    setTimeout(() => setBioMsg(''), 2600);
  };

  const openPw = () => {
    setCurPw('');
    setNewPw('');
    setNewPw2('');
    setPwErr('');
    setPwMsg('');
    setPwOpen(true);
  };
  const changePw = async () => {
    if (!curPw) return setPwErr('현재 비밀번호를 입력해 주세요.');
    if (newPw.length < 8) return setPwErr('새 비밀번호는 8자 이상으로 정해 주세요.');
    if (newPw !== newPw2) return setPwErr('새 비밀번호가 서로 달라요.');
    if (newPw === curPw) return setPwErr('현재 비밀번호와 다른 비밀번호로 정해 주세요.');
    setPwSaving(true);
    setPwErr('');
    try {
      await settingsApi.changePassword(curPw, newPw);
      setPwMsg('비밀번호를 변경했어요.');
      setTimeout(() => setPwOpen(false), 900);
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } };
      setPwErr(err.response?.data?.detail ?? '변경에 실패했어요. 현재 비밀번호를 확인해 주세요.');
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="op-root">
      <OpsNav />
      <main className="op-main">
        <div className="op-head">
          <div>
            <h1 className="op-title">{roleLabel} 프로필</h1>
            <p className="op-sub">내 계정 정보를 확인하고 비밀번호를 변경해요.</p>
          </div>
        </div>

        <div className="ipf-card">
          <span className="ipf-avatar">{avatarInitial}</span>
          <div className="ipf-info">
            <div className="ipf-name">{name}</div>
            <div className="ipf-meta">
              {me?.email && <span>{me.email}</span>}
              <span className="ipf-role">{roleLabel}</span>
            </div>
          </div>
        </div>

        {/* 강사 이력 — 학생이 코스의 '강사 소개'를 누르면 이 내용이 그대로 보인다.
            운영자 프로필엔 띄우지 않는다(운영자는 코스의 강사로 노출되지 않으므로). */}
        {me?.role === 'instructor' && (
          <div className="ipf-card ipf-bio">
            <div className="ipf-biohead">
              <span className="ipf-rowicon">
                <i className="ph-fill ph-identification-card" />
              </span>
              <div className="ipf-rowinfo">
                <div className="ipf-rowtitle">강사 이력</div>
                <div className="ipf-rowsub">
                  학생이 내 코스에서 ‘강사 소개’를 누르면 이 내용이 보여요.
                </div>
              </div>
              {bioSavedAt && (
                <span className="ipf-biosaved">
                  {new Date(bioSavedAt).toLocaleDateString('ko-KR')} 저장됨
                </span>
              )}
            </div>

            <label className="ipf-biofield">
              <span className="ipf-biolabel">한 줄 소개</span>
              <input
                className="ipf-bioin"
                value={headline}
                maxLength={60}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="예) 10년째 중등 수학을 가르치고 있습니다"
              />
              <span className="ipf-biocount">{headline.length}/60</span>
            </label>

            <label className="ipf-biofield">
              <span className="ipf-biolabel">이력</span>
              <textarea
                className="ipf-bioarea"
                value={career}
                maxLength={1000}
                rows={7}
                onChange={(e) => setCareer(e.target.value)}
                placeholder={'한 줄에 하나씩 적으면 학생 화면에도 줄바꿈 그대로 보여요.\n\n예)\n· ○○대학교 수학교육과 졸업\n· 前 ○○학원 중등부 대표강사\n· 저서 「개념부터 잡는 중학 수학」'}
              />
              <span className="ipf-biocount">{career.length}/1000</span>
            </label>

            {bioErr && (
              <div className="op-form-err">
                <i className="ph-fill ph-warning-circle" />
                {bioErr}
              </div>
            )}
            {bioMsg && <div className="ipf-biook">{bioMsg}</div>}

            <div className="ipf-bioactions">
              <button className="op-btn op-btn--approve" onClick={saveBio}>
                <i className="ph-bold ph-check" /> 이력 저장
              </button>
            </div>
          </div>
        )}

        <div className="ipf-card ipf-section">
          <div className="ipf-row">
            <span className="ipf-rowicon">
              <i className="ph-fill ph-lock-key" />
            </span>
            <div className="ipf-rowinfo">
              <div className="ipf-rowtitle">비밀번호 변경</div>
              <div className="ipf-rowsub">로그인 비밀번호를 새로 정해요.</div>
            </div>
            <button className="op-btn op-btn--soft" onClick={openPw}>
              변경
            </button>
          </div>
        </div>

        {/* 간편 로그인 연결 — 콘솔 계정은 여기서 직접 연결해야만 소셜 로그인이 열린다.
            서버는 이메일이 같아도 자동으로 붙이지 않는다(고권한 계정 탈취 경로 차단). */}
        <SocialConnections
          cardClassName="sx-card"
          titleClassName="sx-cardtitle"
          returnTo={PATHS.OPS_INSTRUCTOR_PROFILE}
        />
      </main>

      {pwOpen && (
        <div className="op-bh-overlay" onClick={() => !pwSaving && setPwOpen(false)}>
          <div className="op-formmodal" onClick={(e) => e.stopPropagation()}>
            <div className="op-bh-modal-h">
              <span><i className="ph-fill ph-lock-key" /> 비밀번호 변경</span>
              <button className="op-bh-modal-x" onClick={() => !pwSaving && setPwOpen(false)}>
                <i className="ph-bold ph-x" />
              </button>
            </div>
            <div className="op-form">
              <p className="op-form-hint">현재 비밀번호를 확인한 뒤 새 비밀번호(8자 이상)로 바꿔요.</p>
              <label className="op-form-row">
                <span className="op-form-lb">현재 비밀번호 <b>*</b></span>
                <input className="op-form-in" type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} placeholder="현재 비밀번호" />
              </label>
              <label className="op-form-row">
                <span className="op-form-lb">새 비밀번호 <b>*</b></span>
                <input className="op-form-in" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="8자 이상" />
              </label>
              <label className="op-form-row">
                <span className="op-form-lb">새 비밀번호 확인 <b>*</b></span>
                <input className="op-form-in" type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} placeholder="새 비밀번호 다시" />
              </label>
              {pwErr && <div className="op-form-err"><i className="ph-fill ph-warning-circle" />{pwErr}</div>}
              {pwMsg && <div className="op-form-hint" style={{ color: '#1d9e6f', fontWeight: 700 }}>{pwMsg}</div>}
              <div className="op-form-actions">
                <button className="op-btn op-btn--reject" disabled={pwSaving} onClick={() => setPwOpen(false)}>취소</button>
                <button className="op-btn op-btn--approve" disabled={pwSaving} onClick={changePw}>
                  <i className="ph-bold ph-check" />
                  {pwSaving ? '변경 중…' : '비밀번호 변경'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
