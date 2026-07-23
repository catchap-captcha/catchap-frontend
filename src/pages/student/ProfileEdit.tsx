import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { useAuth } from '../../hooks/useAuth';
import { studentApi } from '../../api/students';
import { StudentNav } from '../../layouts/StudentLayout';
import './ProfileEdit.css';

/**
 * 프로필 수정 — 학생이 이름·나이를 바꾼다. 설정의 '수정' 버튼에서 진입.
 * 저장은 PATCH /students/me/profile 후 reloadMe()로 me를 갱신해 상단 nav·설정에 즉시 반영한다.
 * 실패는 삼키지 않고 정직하게 노출(가짜 성공 금지).
 */
export default function ProfileEdit() {
  const { me, reloadMe } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // me가 로드되면(늦게 올 수 있음) 현재 값으로 폼을 한 번 채운다
  useEffect(() => {
    if (me && !ready) {
      setName(me.name ?? '');
      setAge(me.student?.age != null ? String(me.student.age) : '');
      setReady(true);
    }
  }, [me, ready]);

  const save = async () => {
    const n = name.trim();
    if (n.length < 1 || n.length > 50) {
      setErr('이름은 1~50자로 입력해 주세요.');
      return;
    }
    const hasAge = age.trim() !== '';
    const ageNum = Number(age);
    if (hasAge && (!Number.isInteger(ageNum) || ageNum < 1 || ageNum > 120)) {
      setErr('나이는 1~120 사이 숫자로 입력해 주세요.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      await studentApi.updateProfile({ name: n, ...(hasAge ? { age: ageNum } : {}) });
      await reloadMe();
      navigate(PATHS.STUDENT_MYPAGE);
    } catch {
      setErr('저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pe-root">
      <StudentNav />
      <div className="pe-main">
        <h1 className="pe-title">프로필 수정</h1>
        <p className="pe-sub">이름과 나이를 바꿀 수 있어요.</p>

        <div className="pe-card">
          <label className="pe-field">
            <span className="pe-label">이름</span>
            <input
              className="pe-input"
              value={name}
              maxLength={50}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름을 입력해 주세요"
            />
          </label>
          <label className="pe-field">
            <span className="pe-label">나이</span>
            <input
              className="pe-input"
              type="number"
              inputMode="numeric"
              min={1}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="나이"
            />
          </label>

          {err && <div className="pe-err">{err}</div>}

          <div className="pe-actions">
            <button className="pe-btn pe-btn--primary" onClick={save} disabled={saving}>
              {saving ? '저장 중…' : '저장'}
            </button>
            <button
              className="pe-btn pe-btn--ghost"
              onClick={() => navigate(PATHS.STUDENT_MYPAGE)}
              disabled={saving}
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
