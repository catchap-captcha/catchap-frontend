import { useEffect, useState } from 'react';

import OpsNav from '../../components/ops/OpsNav';
import { opsAccountApi, type OpsThrottleRow } from '../../api/ops';
import './OpsApproval.css';
import './OpsAccountUnlock.css';

/**
 * 계정 잠금 해제 — 로그인 실패가 임계를 넘어 캡차를 요구받는 계정을 운영자가 직접 풀어준다.
 *
 * 왜 필요한가(팀 학습용): 메인 캡차(드래그)는 사진 속 객체를 마우스로 끌어야 풀린다. 즉
 * 키보드·스크린리더 사용자는 임계를 넘는 순간 **로그인 자체가 불가능**해진다. 여기에 더해
 * 학생은 users 테이블에 없어 비밀번호 재설정 흐름이 아예 없었고, 로그인 아이디가 이메일이
 * 아닌 학생(실측 56명 중 47명)은 메일 재설정도 불가능하다. 자동 해제(30분 창)와 재설정으로
 * 대부분 해결되지만, 그래도 막히는 사람을 위한 최후 수단이 필요해 이 화면을 둔다.
 *
 * ★계정 실존 여부를 함께 보여주는 이유: 실측상 임계를 넘은 식별자 대부분은 '가입도 안 된
 * 아이디'(오타·탐색 흔적)라 뒤에 사람이 없다. 구분이 없으면 운영자가 실제 피해자를 못 찾는다.
 */
type Busy = { kind: 'unlock' | 'reset'; key: string } | null;

export default function OpsAccountUnlock() {
  const [rows, setRows] = useState<OpsThrottleRow[]>([]);
  const [threshold, setThreshold] = useState(0);
  const [onlyBlocked, setOnlyBlocked] = useState(true);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState<Busy>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** 메일을 보낼 수 없는 학생의 임시 비밀번호 — 화면에 1회만 보여준다(서버에 평문 저장 없음) */
  const [tempPw, setTempPw] = useState<{ loginId: string; password: string } | null>(null);

  const load = () => {
    setState('loading');
    opsAccountApi
      .throttles(onlyBlocked)
      .then((d) => {
        setRows(d.items);
        setThreshold(d.threshold);
        setState('ready');
      })
      .catch(() => setState('error'));
  };
  useEffect(load, [onlyBlocked]);

  const unlock = async (row: OpsThrottleRow) => {
    setBusy({ kind: 'unlock', key: row.identifier });
    setNotice(null);
    try {
      await opsAccountApi.unlock(row.identifier);
      setNotice(`${row.subject} 잠금을 해제했습니다.`);
      load();
    } catch {
      setNotice('해제에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(null);
    }
  };

  const resetPw = async (row: OpsThrottleRow) => {
    if (!row.account || row.account.type !== 'student') return;
    setBusy({ kind: 'reset', key: row.identifier });
    setNotice(null);
    setTempPw(null);
    try {
      const r = await opsAccountApi.resetStudentPassword(row.account.id);
      if (r.temp_password) {
        // 이메일이 없는 학생 — 운영자가 전화·대면 등 다른 경로로 전달해야 한다.
        setTempPw({ loginId: r.student_login_id, password: r.temp_password });
        setNotice('이메일을 보낼 수 없는 계정이라 임시 비밀번호를 화면에 표시했습니다.');
      } else if (r.email_status === 'sent') {
        setNotice(`${r.student_login_id} 로 임시 비밀번호를 보냈습니다.`);
      } else if (r.email_status === 'dry_run') {
        setNotice('메일 발송이 꺼져 있어(dry-run) 실제로 전송되지 않았습니다.');
      } else {
        setNotice('임시 비밀번호를 발급했지만 메일 발송에 실패했습니다.');
      }
      load();
    } catch {
      setNotice('임시 비밀번호 발급에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  };

  const real = rows.filter((r) => r.account);
  const orphan = rows.filter((r) => !r.account);

  return (
    <div className="op-root">
      <OpsNav />
      <main className="op-main">
        <div className="op-head">
          <div>
            <h1 className="op-title">계정 잠금 해제</h1>
            <p className="op-sub">
              로그인 {threshold || '—'}회 이상 실패해 보안 확인(캡차)을 요구받는 계정입니다. 마지막 실패 후
              30분이 지나면 자동으로 풀리지만, 캡차를 풀 수 없는 사용자를 위해 직접 해제할 수 있습니다.
            </p>
          </div>
          <button className="op-refresh" onClick={load} disabled={state === 'loading'}>
            <i className="ph-bold ph-arrows-clockwise" /> 새로고침
          </button>
        </div>

        <label className="au-toggle">
          <input
            type="checkbox"
            checked={onlyBlocked}
            onChange={(e) => setOnlyBlocked(e.target.checked)}
          />
          <span>잠긴 계정만 보기</span>
        </label>

        {notice && <div className="au-notice">{notice}</div>}

        {tempPw && (
          <div className="au-temppw" role="status">
            <div>
              <strong>{tempPw.loginId}</strong> 의 임시 비밀번호
              <p>이 값은 지금 한 번만 표시됩니다. 본인에게 직접 전달한 뒤 창을 닫아 주세요.</p>
            </div>
            <code>{tempPw.password}</code>
            <button className="op-btn--soft" onClick={() => setTempPw(null)}>
              닫기
            </button>
          </div>
        )}

        {state === 'loading' && <p className="au-empty">불러오는 중…</p>}
        {state === 'error' && <p className="au-empty">목록을 불러오지 못했습니다.</p>}

        {state === 'ready' && (
          <>
            <section className="au-section">
              <h2>
                실제 계정 <span>{real.length}</span>
              </h2>
              {real.length === 0 ? (
                <p className="au-empty">잠긴 실제 계정이 없습니다.</p>
              ) : (
                <table className="au-table">
                  <thead>
                    <tr>
                      <th>아이디</th>
                      <th>이름</th>
                      <th>구분</th>
                      <th>실패</th>
                      <th>마지막 실패</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {real.map((r) => (
                      <tr key={r.identifier}>
                        <td className="au-id">{r.subject}</td>
                        <td>{r.account?.name || '—'}</td>
                        <td>
                          {r.account?.type === 'student' ? '학습자' : r.account?.role || '계정'}
                          {r.account && !r.account.can_email && (
                            <span className="au-tag" title="로그인 아이디가 이메일이 아니라 메일을 보낼 수 없습니다">
                              메일 불가
                            </span>
                          )}
                        </td>
                        <td>{r.fail_count}</td>
                        <td className="au-time">
                          {r.updated_at ? new Date(r.updated_at).toLocaleString() : '—'}
                        </td>
                        <td className="au-actions">
                          <button
                            className="op-btn--approve"
                            onClick={() => unlock(r)}
                            disabled={busy !== null}
                          >
                            {busy?.kind === 'unlock' && busy.key === r.identifier
                              ? '해제 중…'
                              : '잠금 해제'}
                          </button>
                          {r.account?.type === 'student' && (
                            <button
                              className="op-btn--soft"
                              onClick={() => resetPw(r)}
                              disabled={busy !== null}
                            >
                              {busy?.kind === 'reset' && busy.key === r.identifier
                                ? '발급 중…'
                                : '임시 비밀번호'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="au-section">
              <h2>
                가입되지 않은 아이디 <span>{orphan.length}</span>
              </h2>
              <p className="au-hint">
                오타·탐색 시도로 남은 기록입니다. 뒤에 계정이 없어 풀어줄 사람도 없습니다.
              </p>
              {orphan.length > 0 && (
                <ul className="au-orphans">
                  {orphan.map((r) => (
                    <li key={r.identifier}>
                      <code>{r.subject}</code>
                      <span>{r.fail_count}회</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
