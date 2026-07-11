import { useEffect, useState } from 'react';
import { opsApi, type OpsOperator, type OpsOperatorCreated } from '../../api/ops';
import { settingsApi } from '../../api/settings';
import { useAuth } from '../../hooks/useAuth';
import OpsNav from '../../components/ops/OpsNav';
import './OpsApproval.css';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  active: { label: '활성', cls: 'active' },
  disabled: { label: '중지', cls: 'disabled' },
};

function fmt(ts: string | null): string {
  if (!ts) return '-';
  return ts.replace('T', ' ').slice(0, 16);
}

export default function OpsOperators() {
  const { me } = useAuth();
  const [rows, setRows] = useState<OpsOperator[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [created, setCreated] = useState<OpsOperatorCreated | null>(null);
  const [resetMode, setResetMode] = useState(false); // created 모달을 '재설정' 문구로 표시
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  // 본인 비밀번호 변경 모달
  const [pwOpen, setPwOpen] = useState(false);
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const say = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 2600);
  };

  const load = () => {
    setState('loading');
    opsApi
      .operators()
      .then((d) => {
        setRows(Array.isArray(d) ? d : []);
        setState('ready');
      })
      .catch(() => setState('error'));
  };
  useEffect(load, []);

  const openAdd = () => {
    setName('');
    setEmail('');
    setFormErr('');
    setAdding(true);
  };

  const submit = async () => {
    if (!name.trim()) return setFormErr('운영자 이름을 입력해 주세요.');
    if (!email.trim()) return setFormErr('로그인용 이메일을 입력해 주세요.');
    setSaving(true);
    setFormErr('');
    try {
      const res = await opsApi.createOperator({ name: name.trim(), email: email.trim() });
      setAdding(false);
      setCreated(res); // 임시 비밀번호 1회 노출
      load();
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } };
      setFormErr(err.response?.data?.detail ?? '추가에 실패했어요. 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (op: OpsOperator) => {
    const next = op.status === 'active' ? 'disabled' : 'active';
    // 중지는 그 운영자의 콘솔 접근을 즉시 끊는다 — 원클릭 방지(재활성화는 확인 불필요)
    if (
      next === 'disabled' &&
      !window.confirm(`'${op.name}' 운영자를 중지할까요? 즉시 콘솔에 접근할 수 없게 돼요.`)
    )
      return;
    setBusyId(op.id);
    try {
      await opsApi.updateOperator(op.id, { status: next });
      say(next === 'disabled' ? '운영자를 중지했어요.' : '운영자를 다시 활성화했어요.');
      load();
    } catch (e) {
      // 자기 계정·마지막 운영자 중지 등은 서버가 사유와 함께 막는다 — 그대로 안내
      const err = e as { response?: { data?: { detail?: string } } };
      say(err.response?.data?.detail ?? '변경에 실패했어요.');
    } finally {
      setBusyId(null);
    }
  };

  const resetPw = async (op: OpsOperator) => {
    const self = me?.id === op.id;
    const msg = self
      ? '내 임시 비밀번호를 재설정할까요? 기존 세션이 로그아웃되고, 새 임시 비번을 이메일로 받게 돼요.'
      : `${op.name} 운영자의 임시 비밀번호를 재설정할까요? 새 임시 비번이 이메일로 발송되고 기존 세션은 폐기됩니다.`;
    if (!window.confirm(msg)) return;
    setBusyId(op.id);
    try {
      const res = await opsApi.resetOperatorPassword(op.id);
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

  const openMyPw = () => {
    setCurPw('');
    setNewPw('');
    setNewPw2('');
    setPwErr('');
    setPwOpen(true);
  };
  const changeMyPw = async () => {
    if (!curPw) return setPwErr('현재 비밀번호를 입력해 주세요.');
    if (newPw.length < 8) return setPwErr('새 비밀번호는 8자 이상으로 정해 주세요.');
    if (newPw !== newPw2) return setPwErr('새 비밀번호가 서로 달라요.');
    if (newPw === curPw) return setPwErr('현재 비밀번호와 다른 비밀번호로 정해 주세요.');
    setPwSaving(true);
    setPwErr('');
    try {
      await settingsApi.changePassword(curPw, newPw);
      setPwOpen(false);
      say('비밀번호를 변경했어요.');
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
            <h1 className="op-title">운영자 계정</h1>
            <p className="op-sub">
              플랫폼 운영자(내부 직원) 계정이에요. 공개 가입이 아니라 여기서만 추가되고, 모든 변경은
              감사 로그에 남아요.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="op-refresh" onClick={openMyPw}>
              <i className="ph-bold ph-lock-key" />
              내 비밀번호 변경
            </button>
            <button className="op-addbtn" onClick={openAdd}>
              <i className="ph-bold ph-plus" />
              운영자 추가
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
            <div className="op-logrow">운영자 목록을 불러오지 못했어요. 새로고침해 주세요.</div>
          )}
          {state === 'ready' &&
            rows.map((o) => {
              const m = STATUS_META[o.status] ?? { label: o.status, cls: 'disabled' };
              const isMe = me?.id === o.id;
              return (
                <div key={o.id} className="op-logrow op-oprow">
                  <span className="op-op-name">
                    <span className="op-org-ic"><i className="ph-fill ph-shield-star" /></span>
                    {o.name}
                    {isMe && <span className="op-op-you">나</span>}
                  </span>
                  <span className="op-mono">{o.email ?? '-'}</span>
                  <span>
                    <span className={`op-orgstatus op-orgstatus--${m.cls}`}>{m.label}</span>
                  </span>
                  <span className="op-op-login">{fmt(o.last_login_at)}</span>
                  <span className="op-col-right" style={{ display: 'inline-flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button
                      className="op-op-toggle op-op-toggle--reset"
                      disabled={busyId === o.id}
                      title="임시 비밀번호 재설정 → 이메일 발송"
                      onClick={() => resetPw(o)}
                    >
                      <i className="ph-bold ph-key" /> 비번 재설정
                    </button>
                    <button
                      className={
                        'op-op-toggle' + (o.status === 'active' ? ' op-op-toggle--off' : ' op-op-toggle--on')
                      }
                      disabled={busyId === o.id || isMe}
                      title={isMe ? '자기 계정은 중지할 수 없어요' : o.status === 'active' ? '중지' : '활성화'}
                      onClick={() => toggle(o)}
                    >
                      {o.status === 'active' ? '중지' : '활성화'}
                    </button>
                  </span>
                </div>
              );
            })}
        </div>
      </main>

      {/* 운영자 추가 모달 */}
      {adding && (
        <div className="op-bh-overlay" onClick={() => !saving && setAdding(false)}>
          <div className="op-formmodal" onClick={(e) => e.stopPropagation()}>
            <div className="op-bh-modal-h">
              <span><i className="ph-fill ph-shield-plus" /> 운영자 추가</span>
              <button className="op-bh-modal-x" onClick={() => !saving && setAdding(false)}>
                <i className="ph-bold ph-x" />
              </button>
            </div>
            <div className="op-form">
              <p className="op-form-hint">
                로그인은 숨겨진 운영자 전용 경로(/ops/login)에서만 됩니다. 임시 비밀번호가 생성되고,
                저장 직후 한 번만 표시돼요.
              </p>
              <label className="op-form-row">
                <span className="op-form-lb">이름 <b>*</b></span>
                <input className="op-form-in" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 김운영" />
              </label>
              <label className="op-form-row">
                <span className="op-form-lb">이메일(로그인) <b>*</b></span>
                <input className="op-form-in" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="operator@catchap.dev" />
              </label>
              {formErr && <div className="op-form-err"><i className="ph-fill ph-warning-circle" />{formErr}</div>}
              <div className="op-form-actions">
                <button className="op-btn op-btn--reject" disabled={saving} onClick={() => setAdding(false)}>취소</button>
                <button className="op-btn op-btn--approve" disabled={saving} onClick={submit}>
                  <i className="ph-bold ph-check" />
                  {saving ? '추가 중…' : '운영자 추가'}
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
                {resetMode ? '임시 비밀번호를 재설정했어요' : '운영자를 추가했어요'}
              </span>
              <button className="op-bh-modal-x" onClick={() => { setCreated(null); setResetMode(false); }}><i className="ph-bold ph-x" /></button>
            </div>
            <div className="op-form">
              <p className="op-form-hint">
                {resetMode ? (
                  <>
                    <b>{created.name}</b> 운영자의 임시 비밀번호를 재설정했어요. 새 임시 비밀번호를 <b>{created.email}</b>로
                    발송했고, 기존 세션은 폐기됐습니다. <b>첫 로그인 시 새 비밀번호를 반드시 설정</b>해야 합니다.
                  </>
                ) : (
                  <>
                    <b>{created.name}</b> 운영자 계정을 만들었어요. 임시 비밀번호를 <b>{created.email}</b>로
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

      {/* 본인 비밀번호 변경 모달 */}
      {pwOpen && (
        <div className="op-bh-overlay" onClick={() => !pwSaving && setPwOpen(false)}>
          <div className="op-formmodal" onClick={(e) => e.stopPropagation()}>
            <div className="op-bh-modal-h">
              <span><i className="ph-fill ph-lock-key" /> 내 비밀번호 변경</span>
              <button className="op-bh-modal-x" onClick={() => !pwSaving && setPwOpen(false)}><i className="ph-bold ph-x" /></button>
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
              <div className="op-form-actions">
                <button className="op-btn op-btn--reject" disabled={pwSaving} onClick={() => setPwOpen(false)}>취소</button>
                <button className="op-btn op-btn--approve" disabled={pwSaving} onClick={changeMyPw}>
                  <i className="ph-bold ph-check" />
                  {pwSaving ? '변경 중…' : '비밀번호 변경'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="op-toast"><i className="ph-fill ph-check-circle" />{toast}</div>}
    </div>
  );
}
