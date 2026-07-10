import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { studentApi } from '../../api/students';
import { settingsApi } from '../../api/settings';
import './ForcePasswordGate.css';
import PasswordInput from '../common/PasswordInput';

/**
 * 학생 비밀번호 초기화(교사/기관) 후 첫 로그인 시, 새 비밀번호를 정하기 전까지
 * 앱 위에 덮어 막는 게이트. 변경 완료 시 사라짐.
 */
export default function ForcePasswordGate() {
  const { me, reloadMe } = useAuth();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // 강제 변경 플래그가 켜진 계정(학생=비번 초기화 / 기관 관리자=임시 비번 첫 로그인)에서 노출
  if (!me || !me.must_change_password) return null;
  const isStudent = me.role === 'student';
  const minLen = isStudent ? 4 : 8;

  const submit = async () => {
    if (pw.length < minLen) return setErr(`비밀번호는 ${minLen}자 이상으로 정해 주세요.`);
    if (pw !== pw2) return setErr('비밀번호가 서로 달라요.');
    setErr('');
    setBusy(true);
    try {
      if (isStudent) await studentApi.changePassword(pw);
      else await settingsApi.forceChangePassword(pw);
      await reloadMe();
    } catch {
      setErr('변경에 실패했어요. 다시 시도해 주세요.');
      setBusy(false);
    }
  };

  return (
    <div className="fpg-bg">
      <div className="fpg-card">
        <div className="fpg-ic"><i className="ph-fill ph-key" /></div>
        <h2 className="fpg-title">{isStudent ? '새 비밀번호를 정해줘' : '새 비밀번호를 설정해 주세요'}</h2>
        <p className="fpg-sub">
          {isStudent
            ? '선생님이 비밀번호를 초기화했어요. 나만 아는 새 비밀번호로 바꿔야 시작할 수 있어요.'
            : '임시 비밀번호로 로그인했어요. 보안을 위해 새 비밀번호로 변경해야 시작할 수 있어요.'}
        </p>
        <PasswordInput className="fpg-input" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={`새 비밀번호 (${minLen}자 이상)`} autoFocus />
        <PasswordInput className="fpg-input" value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="한 번 더" />
        {err && <div className="fpg-err"><i className="ph-fill ph-warning-circle" />{err}</div>}
        <button className="fpg-btn" onClick={submit} disabled={busy}>
          <i className="ph-fill ph-check" />{busy ? '바꾸는 중…' : '바꾸고 시작!'}
        </button>
      </div>
    </div>
  );
}
