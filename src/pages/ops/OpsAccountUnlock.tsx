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

/**
 * '가입되지 않은 아이디' 중 자동화·인프라·탐색 흔적 — 뒤에 사람이 없을 뿐 아니라 운영자가
 * 볼 이유도 없는 기록이다. 실측상 이런 것이 목록의 대부분(186건 중 대다수)이라, 섞여 있으면
 * 정작 봐야 할 '사람이 오타 낸 아이디'가 묻힌다.
 * ★지우지는 않는다 — 숨긴 개수를 알려 주고 '전체 보기'로 되돌릴 수 있게 둔다(조용한 은폐 금지).
 */
const NOISE_PATTERNS: RegExp[] = [
  /^\d{1,3}(\.\d{1,3}){3}$/, // IP 그대로 남은 기록
  /^[a-z]+:\d{1,3}(\.\d{1,3}){3}$/i, // portone:52.78.5.241 같은 인프라 키
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, // UUID(세션·디바이스 키)
  /(^|[-_.])bot([-_.]|\d|$)/i, // demo-bot, repro_bot_check
  /^__.+__/, // __probe__@example.com
  /probe|cutover|recheck|deploy-test|smoke|e2e/i, // 배포·회귀 점검 흔적
  // ★.example 은 RFC 2606 이 시험·문서용으로 예약한 최상위 도메인이라 ★절대 실주소가 아니다.
  //   그전엔 @example.com 만 잡아서 ux-ai-review-…@invalid.example 이 '오타'로 남았다(0816 실측).
  /\.example$/i,
  /@(cat\.dev|catchap\.dev|catchap5\.test)$/i, // 개발·테스트 도메인
  /:signup$/i, // 가입 흐름 내부 키
];

/** 사람이 입력한 로그인 아이디로 보기 어려운 것(한 글자·자모만 등) */
function isTooShort(s: string): boolean {
  const t = s.trim();
  return t.length <= 2 || /^[ㄱ-ㅎㅏ-ㅣ\s]+$/.test(t);
}

function isNoiseIdentifier(s: string): boolean {
  return NOISE_PATTERNS.some((re) => re.test(s)) || isTooShort(s);
}

export default function OpsAccountUnlock() {
  const [rows, setRows] = useState<OpsThrottleRow[]>([]);
  const [threshold, setThreshold] = useState(0);
  const [onlyBlocked, setOnlyBlocked] = useState(true);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState<Busy>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** 메일을 보낼 수 없는 학생의 임시 비밀번호 — 화면에 1회만 보여준다(서버에 평문 저장 없음) */
  const [tempPw, setTempPw] = useState<{ loginId: string; password: string } | null>(null);
  /** 숨긴 자동화·탐색 기록까지 전부 볼지 — 기본은 '관리가 필요한 것만' */
  const [showAllOrphans, setShowAllOrphans] = useState(false);
  const [purging, setPurging] = useState(false);

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

  /**
   * 기록 자체를 지운다 — 위의 필터가 '화면에서 감추는 것'이라면 이쪽은 삭제다.
   * 무엇을 남길지는 서버가 판정한다(계정 있는 식별자 · 최근 24시간 기록). 되돌릴 수
   * 없으므로 한 번 물어본다.
   */
  const purgeOrphans = async () => {
    const ok = window.confirm(
      '가입되지 않은 아이디의 실패 기록을 삭제합니다.\n\n' +
        '계정이 있는 아이디와, 최근 24시간 안에 시도가 있었던 기록은 남습니다.\n' +
        '삭제한 기록은 되돌릴 수 없습니다. 계속할까요?',
    );
    if (!ok) return;
    setPurging(true);
    setNotice(null);
    try {
      const r = await opsAccountApi.purgeOrphanThrottles();
      const kept =
        r.kept_recent > 0
          ? ` 최근 ${r.min_age_hours}시간 안에 시도가 있었던 ${r.kept_recent}건은 남겼습니다.`
          : '';
      setNotice(r.deleted === 0 ? '지울 기록이 없습니다.' : `기록 ${r.deleted}건을 삭제했습니다.${kept}`);
      load();
    } catch {
      setNotice('기록 삭제에 실패했습니다.');
    } finally {
      setPurging(false);
    }
  };

  const real = rows.filter((r) => r.account);

  // 가입되지 않은 아이디 — ① 같은 아이디가 여러 번 남았으면 한 줄로 합치고(실패 횟수 합산)
  // ② 자동화·인프라 흔적은 기본으로 숨긴다. 남는 건 '사람이 오타 낸 것'뿐이라 관리 대상이 또렷해진다.
  const orphanRaw = rows.filter((r) => !r.account);
  const mergedMap = new Map<string, { subject: string; fail: number }>();
  for (const r of orphanRaw) {
    const cur = mergedMap.get(r.subject);
    if (cur) cur.fail += r.fail_count;
    else mergedMap.set(r.subject, { subject: r.subject, fail: r.fail_count });
  }
  const orphanMerged = [...mergedMap.values()];
  // ★같은 초에 여러 건이 몰렸으면 사람이 아니라 스크립트다 — 이 모양을 화면이 안 보여 줘서
  //   운영자가 "오타가 스물몇 개 났네" 로 읽게 된다(0816 실측: 같은 초에 4건씩 6번,
  //   harvest-w1p0…w15p3. 주차를 1→15 로 올려 가며 4명씩 만들려던 흔적이었다).
  const burstAt = new Map<string, number>();
  for (const r of orphanRaw) {
    if (!r.updated_at) continue; // 시각이 없으면 묶지 않는다(없는 신호를 만들지 않게)
    burstAt.set(r.updated_at, (burstAt.get(r.updated_at) ?? 0) + 1);
  }
  const burstGroups = [...burstAt.values()].filter((n) => n >= 3);
  const burstCount = burstGroups.reduce((a, b) => a + b, 0);
  const orphanKeep = orphanMerged.filter((o) => !isNoiseIdentifier(o.subject));
  const orphanShown = (showAllOrphans ? orphanMerged : orphanKeep).sort((a, b) => b.fail - a.fail);
  const hiddenCount = orphanMerged.length - orphanKeep.length;
  const dupCollapsed = orphanRaw.length - orphanMerged.length;

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
                      <th className="au-actions-h" />
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
                가입되지 않은 아이디 <span>{orphanShown.length}</span>
                {orphanMerged.length > 0 && (
                  <button
                    type="button"
                    className="au-purge"
                    onClick={purgeOrphans}
                    disabled={purging || busy !== null}
                  >
                    <i className="ph-bold ph-trash" /> {purging ? '삭제 중…' : '기록 삭제'}
                  </button>
                )}
              </h2>
              <p className="au-hint">
                {/* ★"오타로 남은 기록입니다" 라고 단정하고 있었다. 0816 에 실제로 세어 보니
                    26건 중 25건이 스크립트 흔적이었다 — 단정이 틀렸고, 운영자를 엉뚱한
                    판단으로 보낸다("오타가 스물몇 개 났구나"). 아는 것만 말한다. */}
                뒤에 계정이 없는 아이디예요 — 풀어 줄 사람이 없습니다. 사람이 오타 낸 것일 수도,
                자동화·시험 흔적일 수도 있어요. 실제 아이디와 비슷하면 가입 안내가 필요할 수 있습니다.
                {(hiddenCount > 0 || dupCollapsed > 0) && (
                  <>
                    {' '}
                    {hiddenCount > 0 && `자동화·인프라 흔적 ${hiddenCount}건은 숨겼고, `}
                    {burstGroups.length > 0 &&
                      `${burstCount}건은 같은 초에 ${burstGroups.length}묶음으로 몰려 들어왔습니다(사람이 아니라 스크립트). `}
                    {dupCollapsed > 0 && `같은 아이디 ${dupCollapsed}건은 합쳤습니다. `}
                    <button
                      type="button"
                      className="au-linkbtn"
                      onClick={() => setShowAllOrphans((v) => !v)}
                    >
                      {showAllOrphans ? '숨긴 기록 접기' : '전체 보기'}
                    </button>
                  </>
                )}
              </p>
              {orphanShown.length > 0 ? (
                <ul className="au-orphans">
                  {orphanShown.map((o) => (
                    <li key={o.subject}>
                      <code>{o.subject}</code>
                      <span>{o.fail}회</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="au-empty">관리가 필요한 기록이 없습니다.</p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
