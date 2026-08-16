import { useEffect, useState } from 'react';
import {
  opsApi,
  type OpsDeletedOperator,
  type OpsInstructor,
  type OpsInstructorCreated,
} from '../../api/ops';
import OpsNav from '../../components/ops/OpsNav';
import DeletedAccountsSection from '../../components/ops/DeletedAccountsSection';
import './OpsApproval.css';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  active: { label: '활성', cls: 'active' },
  disabled: { label: '중지', cls: 'disabled' },
};

function fmt(ts: string | null): string {
  if (!ts) return '-';
  return ts.replace('T', ' ').slice(0, 16);
}

/** 강사 계정 관리 — 운영자 초대로만 생성(공개 가입 없음).
 *  강사는 /ops/login 으로 들어와 강의 콘솔에서 자기 강의만 관리한다. */
export default function OpsInstructors() {
  const [rows, setRows] = useState<OpsInstructor[]>([]);
  /** 삭제된 계정 이력 — 감사 로그가 출처라 위 목록과 별개로 가져온다 */
  const [deleted, setDeleted] = useState<OpsDeletedOperator[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [created, setCreated] = useState<OpsInstructorCreated | null>(null);
  const [resetMode, setResetMode] = useState(false); // created 모달을 '재설정' 문구로 표시
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const say = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 2600);
  };

  const load = () => {
    setState('loading');
    opsApi
      .instructors()
      .then((d) => {
        setRows(Array.isArray(d) ? d : []);
        setState('ready');
      })
      .catch(() => setState('error'));
    // 삭제 이력은 실패해도 위 목록까지 '오류'로 만들지 않는다 — 보조 정보다.
    opsApi
      .deletedInstructors()
      .then((d) => setDeleted(Array.isArray(d) ? d : []))
      .catch(() => setDeleted([]));
  };
  useEffect(load, []);

  const openAdd = () => {
    setName('');
    setEmail('');
    setFormErr('');
    setAdding(true);
  };

  /** 이름 고치기 — 오타 정정용. 로그인 아이디(이메일)는 여기서 못 바꾼다(계정 식별자라).
   *  서버가 before/after 를 감사 로그에 남긴다. */
  const renameAccount = async (row: OpsInstructor) => {
    const next = window.prompt(`'${row.name}' 강사의 이름을 무엇으로 바꿀까요?`, row.name)?.trim();
    if (!next || next === row.name) return;
    setBusyId(row.id);
    try {
      await opsApi.updateInstructor(row.id, { name: next });
      say('이름을 바꿨어요.');
      await load();
    } catch {
      say('이름을 바꾸지 못했어요.');
    } finally {
      setBusyId(null);
    }
  };

  const submit = async () => {
    if (!name.trim()) return setFormErr('강사 이름을 입력해 주세요.');
    if (!email.trim()) return setFormErr('로그인용 이메일을 입력해 주세요.');
    setSaving(true);
    setFormErr('');
    try {
      const res = await opsApi.createInstructor({ name: name.trim(), email: email.trim() });
      setAdding(false);
      setResetMode(false);
      setCreated(res); // 임시 비밀번호 1회 노출
      load();
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } };
      setFormErr(err.response?.data?.detail ?? '추가에 실패했어요. 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (it: OpsInstructor) => {
    const next = it.status === 'active' ? 'disabled' : 'active';
    // 중지는 강사의 콘솔 접근을 즉시 끊는다(세션 폐기). 강의·데이터는 남는다.
    if (
      next === 'disabled' &&
      !window.confirm(
        `'${it.name}' 강사를 중지할까요? 즉시 콘솔에 접근할 수 없게 돼요. 올린 강의와 문항은 그대로 남아요.`,
      )
    )
      return;
    setBusyId(it.id);
    try {
      await opsApi.updateInstructor(it.id, { status: next });
      say(next === 'disabled' ? '강사를 중지했어요.' : '강사를 다시 활성화했어요.');
      load();
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } };
      say(err.response?.data?.detail ?? '변경에 실패했어요.');
    } finally {
      setBusyId(null);
    }
  };

  // 삭제 — 되돌릴 수 없다. 서버가 '중지 상태 + 소유 코스·강의 없음'을 다시 검사한다
  // (강의가 남아 있으면 주인 없는 콘텐츠가 되므로 서버가 사유와 함께 막고, 그 문구를 그대로 보여준다).
  const remove = async (it: OpsInstructor) => {
    if (
      !window.confirm(
        `'${it.name}'(${it.email ?? '-'}) 강사 계정을 삭제할까요?\n\n` +
          '되돌릴 수 없어요. 계정은 완전히 사라지고 다시 초대해야 합니다.\n' +
          '(코스·강의가 남아 있으면 삭제되지 않아요.)',
      )
    )
      return;
    setBusyId(it.id);
    try {
      await opsApi.deleteInstructor(it.id);
      say('강사 계정을 삭제했어요.');
      load();
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } };
      say(err.response?.data?.detail ?? '삭제에 실패했어요.');
    } finally {
      setBusyId(null);
    }
  };

  const resetPw = async (it: OpsInstructor) => {
    const msg = `${it.name} 강사의 임시 비밀번호를 재설정할까요? 새 임시 비번이 이메일로 발송되고 기존 세션은 폐기됩니다.`;
    if (!window.confirm(msg)) return;
    setBusyId(it.id);
    try {
      const res = await opsApi.resetInstructorPassword(it.id);
      setResetMode(true);
      setCreated(res); // 임시 비밀번호 1회 노출(재설정 문구)
      load();
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } };
      say(err.response?.data?.detail ?? '재설정에 실패했어요.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="op-root">
      <OpsNav />
      <main className="op-main">
        <div className="op-head">
          <div>
            <h1 className="op-title">강사 계정</h1>
            <p className="op-sub">
              강의를 올리고 확인 문항을 만드는 강사 계정이에요. 공개 가입 없이 여기서 초대로만
              만들어지고, 강사는 콘솔에서 자기 강의만 관리할 수 있어요.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="op-addbtn" onClick={openAdd}>
              <i className="ph-bold ph-plus" />
              강사 초대
            </button>
            <button className="op-refresh" onClick={load}>
              <i className="ph-bold ph-arrows-clockwise" />
              새로고침
            </button>
          </div>
        </div>

        <div className="op-logcard">
          <div className="op-loghead op-ophead">
            <span>이름</span>
            <span>이메일(로그인)</span>
            <span>상태</span>
            <span>최근 로그인</span>
            <span className="op-col-right">관리</span>
          </div>

          {state === 'loading' && <div className="op-logrow">불러오는 중…</div>}
          {state === 'error' && (
            <div className="op-logrow">강사 목록을 불러오지 못했어요. 새로고침해 주세요.</div>
          )}
          {state === 'ready' && rows.length === 0 && (
            <div className="op-logrow">
              아직 초대한 강사가 없어요. ‘강사 초대’로 첫 강사 계정을 만들어 보세요.
            </div>
          )}
          {state === 'ready' &&
            rows.map((it) => {
              const m = STATUS_META[it.status] ?? { label: it.status, cls: 'disabled' };
              return (
                <div key={it.id} className="op-logrow op-oprow">
                  <span className="op-op-name">
                    <span className="op-org-ic"><i className="ph-fill ph-chalkboard-teacher" /></span>
                    {it.name}
                  {/* ★백엔드는 처음부터 이름 수정을 받고 감사 로그까지 남긴다(PATCH — name·status).
                      ★화면에만 길이 없어서 운영자가 오타를 고칠 수 없었다 — 실제로 강사 한 명이
                      「조조성성원원」로 저장돼 있었다(0816). */}
                  <button
                    className="op-name-edit"
                    disabled={busyId === it.id}
                    title="이름 고치기"
                    onClick={() => renameAccount(it)}
                  >
                    <i className="ph-bold ph-pencil-simple" />
                  </button>
                </span>
                  <span className="op-mono">{it.email ?? '-'}</span>
                  <span>
                    <span className={`op-orgstatus op-orgstatus--${m.cls}`}>{m.label}</span>
                  </span>
                  <span className="op-op-login">{fmt(it.last_login_at)}</span>
                  <span className="op-col-right op-op-actions">
                    <button
                      className="op-op-toggle op-op-toggle--reset"
                      disabled={busyId === it.id}
                      title="임시 비밀번호 재설정 → 이메일 발송"
                      onClick={() => resetPw(it)}
                    >
                      <i className="ph-bold ph-key" /> 비번 재설정
                    </button>
                    <button
                      className={
                        'op-op-toggle' + (it.status === 'active' ? ' op-op-toggle--off' : ' op-op-toggle--on')
                      }
                      disabled={busyId === it.id}
                      title={it.status === 'active' ? '중지' : '활성화'}
                      onClick={() => toggle(it)}
                    >
                      {it.status === 'active' ? '중지' : '활성화'}
                    </button>
                    {/* 삭제는 중지된 계정만 — 행마다 버튼 수가 달라지지 않게 항상 자리를 두고 비활성만 바꾼다 */}
                    <button
                      className="op-op-toggle op-op-toggle--del"
                      disabled={busyId === it.id || it.status !== 'disabled'}
                      title={
                        it.status !== 'disabled'
                          ? '먼저 중지한 뒤에 삭제할 수 있어요'
                          : '계정 삭제(되돌릴 수 없어요)'
                      }
                      onClick={() => remove(it)}
                    >
                      <i className="ph-bold ph-trash" /> 삭제
                    </button>
                  </span>
                </div>
              );
            })}
        </div>

        <DeletedAccountsSection kind="강사" items={deleted} loading={state === 'loading'} />
      </main>

      {/* 강사 초대 모달 */}
      {adding && (
        <div className="op-bh-overlay" onClick={() => !saving && setAdding(false)}>
          <div className="op-formmodal" onClick={(e) => e.stopPropagation()}>
            <div className="op-bh-modal-h">
              <span><i className="ph-fill ph-chalkboard-teacher" /> 강사 초대</span>
              <button className="op-bh-modal-x" onClick={() => !saving && setAdding(false)}>
                <i className="ph-bold ph-x" />
              </button>
            </div>
            <div className="op-form">
              <p className="op-form-hint">
                강사는 일반 로그인 화면에서 이메일·비밀번호로 로그인합니다(운영자 전용
                /ops/login도 가능). 임시 비밀번호가 만들어져 이메일로 발송되고, 저장 직후 한 번만
                표시돼요.
              </p>
              <label className="op-form-row">
                <span className="op-form-lb">이름 <b>*</b></span>
                <input className="op-form-in" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 김강사" />
              </label>
              <label className="op-form-row">
                <span className="op-form-lb">이메일(로그인) <b>*</b></span>
                <input className="op-form-in" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="instructor@example.com" />
              </label>
              {formErr && <div className="op-form-err"><i className="ph-fill ph-warning-circle" />{formErr}</div>}
              <div className="op-form-actions">
                <button className="op-btn op-btn--reject" disabled={saving} onClick={() => setAdding(false)}>취소</button>
                <button className="op-btn op-btn--approve" disabled={saving} onClick={submit}>
                  <i className="ph-bold ph-check" />
                  {saving ? '초대 중…' : '강사 초대'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 생성/재설정 결과 — 임시 비밀번호 1회 노출 */}
      {created && (
        <div className="op-bh-overlay" onClick={() => { setCreated(null); setResetMode(false); }}>
          <div className="op-formmodal" onClick={(e) => e.stopPropagation()}>
            <div className="op-bh-modal-h">
              <span>
                <i className="ph-fill ph-check-circle" />{' '}
                {resetMode ? '임시 비밀번호를 재설정했어요' : '강사를 초대했어요'}
              </span>
              <button className="op-bh-modal-x" onClick={() => { setCreated(null); setResetMode(false); }}><i className="ph-bold ph-x" /></button>
            </div>
            <div className="op-form">
              <p className="op-form-hint">
                {resetMode ? (
                  <>
                    <b>{created.name}</b> 강사의 임시 비밀번호를 재설정했어요. 새 임시 비밀번호를{' '}
                    <b>{created.email}</b>로 발송했고, 기존 세션은 폐기됐습니다.{' '}
                    <b>첫 로그인 시 새 비밀번호를 반드시 설정</b>해야 합니다.
                  </>
                ) : (
                  <>
                    <b>{created.name}</b> 강사 계정을 만들었어요. 임시 비밀번호를 <b>{created.email}</b>로
                    자동 발송했고, 이 계정은 <b>첫 로그인 시 새 비밀번호를 반드시 설정</b>해야 합니다.
                  </>
                )}
              </p>
              {/* 이메일 발송 결과 — 실패/dry-run이면 아래 임시 비번을 수동 전달 */}
              {created.email_status === 'sent' ? (
                <div className="op-mailstat op-mailstat--ok">
                  <i className="ph-fill ph-check-circle" /> 임시 비밀번호를 이메일로 보냈어요.
                </div>
              ) : created.email_status === 'dry_run' ? (
                <div className="op-mailstat op-mailstat--warn">
                  <i className="ph-fill ph-warning-circle" /> 메일 서버(SMTP)가 꺼져 있어 실제 발송되지
                  않았어요. 아래 임시 비밀번호를 직접 전달해 주세요.
                </div>
              ) : (
                <div className="op-mailstat op-mailstat--bad">
                  <i className="ph-fill ph-warning-circle" /> 이메일 발송에 실패했어요. 아래 임시
                  비밀번호를 직접 전달해 주세요.
                </div>
              )}
              <div className="op-cred">
                <div className="op-cred-row"><span>이메일</span><b>{created.email}</b></div>
                <div className="op-cred-row op-cred-row--pw">
                  <span>임시 비밀번호</span>
                  <b className="op-mono">{created.temp_password}</b>
                  <button
                    className="op-iconbtn"
                    title="복사"
                    onClick={() => {
                      navigator.clipboard?.writeText(created.temp_password);
                      say('임시 비밀번호를 복사했어요.');
                    }}
                  >
                    <i className="ph-bold ph-copy" />
                  </button>
                </div>
              </div>
              <div className="op-form-actions">
                <button className="op-btn op-btn--approve" onClick={() => { setCreated(null); setResetMode(false); }}>확인</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="op-toast"><i className="ph-fill ph-check-circle" />{toast}</div>}
    </div>
  );
}
