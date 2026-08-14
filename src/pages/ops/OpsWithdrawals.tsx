import { useEffect, useState } from 'react';
import { opsApi, type OpsWithdrawal } from '../../api/ops';
import OpsNav from '../../components/ops/OpsNav';
import './OpsApproval.css'; // op-root/op-main 셸 — 다른 운영 페이지와 폭·애니메이션 공유
import './OpsAuditLog.css'; // 필터 바·카드·페이지네이션 공용 클래스 재사용(op-log*)
import './OpsWithdrawals.css';

function fmt(ts: string | null): string {
  if (!ts) return '-';
  return ts.replace('T', ' ').slice(0, 16);
}
const ROLE_LABEL: Record<string, string> = { student: '수강생', user: '사용자' };
const PAGE_SIZE = 50;

/**
 * 탈퇴 사유 관리 — 회원탈퇴(settings.account_delete) 감사로그를 탈퇴 리포트로 보여준다.
 * 탈퇴 계정은 개인정보가 파기(익명화)되므로 익명 코드·역할·사유·시각만 남는다.
 * 운영 콘솔 '운영' 드롭다운 항목. 폭·애니메이션은 다른 운영 페이지와 동일(op-root/op-main).
 */
export default function OpsWithdrawals() {
  const [rows, setRows] = useState<OpsWithdrawal[]>([]);
  const [summary, setSummary] = useState<{ reason: string; count: number }[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  // 필터 — 역할·기간. 바뀌면 첫 페이지로.
  const [fRole, setFRole] = useState('');
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');

  const load = () => {
    setState('loading');
    opsApi
      .withdrawals({
        role: fRole || undefined,
        date_from: fFrom || undefined,
        date_to: fTo || undefined,
        page,
        page_size: PAGE_SIZE,
      })
      .then((d) => {
        setRows(d.items ?? []);
        setTotal(d.total ?? 0);
        setSummary(d.reason_summary ?? []);
        setState('ready');
      })
      .catch(() => setState('error'));
  };
  useEffect(load, [fRole, fFrom, fTo, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const setFilter = (fn: () => void) => {
    fn();
    setPage(1);
  };
  const resetFilters = () => {
    setFRole('');
    setFFrom('');
    setFTo('');
    setPage(1);
  };
  const hasFilter = !!(fRole || fFrom || fTo);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);

  return (
    <div className="op-root ops-withdrawals">
      <OpsNav />

      <main className="op-main">
        <div className="op-head">
          <div>
            <h1 className="op-title">탈퇴 사유 관리</h1>
            <p className="op-sub">
              회원탈퇴한 계정의 사유·시각 기록이에요. 탈퇴 계정은 개인정보가 파기되어 익명 코드로만 표시됩니다.
            </p>
          </div>
          <button className="op-refresh" onClick={load}>
            <i className="ph-bold ph-arrows-clockwise" />
            새로고침
          </button>
        </div>

        {/* 사유별 집계 요약 — 어떤 사유가 많은지 한눈에 */}
        {state === 'ready' && summary.length > 0 && (
          <div className="wd-summary">
            {summary.map((s) => (
              <span key={s.reason} className="wd-chip">
                {s.reason} <b>{s.count.toLocaleString()}</b>
              </span>
            ))}
          </div>
        )}

        {/* 필터 — 역할·기간 (감사 로그와 동일한 컨트롤) */}
        <div className="op-logfilters">
          <select
            className="op-filsel"
            value={fRole}
            onChange={(e) => setFilter(() => setFRole(e.target.value))}
            title="역할"
          >
            <option value="">전체 역할</option>
            <option value="student">수강생</option>
            <option value="user">사용자</option>
          </select>
          <input
            className="op-fildate"
            type="date"
            value={fFrom}
            max={fTo || undefined}
            onChange={(e) => setFilter(() => setFFrom(e.target.value))}
            title="시작일"
          />
          <span className="op-fildash">~</span>
          <input
            className="op-fildate"
            type="date"
            value={fTo}
            min={fFrom || undefined}
            onChange={(e) => setFilter(() => setFTo(e.target.value))}
            title="종료일"
          />
          {hasFilter && (
            <button className="op-filreset" onClick={resetFilters}>
              <i className="ph-bold ph-x" />
              필터 해제
            </button>
          )}
          <span className="op-filcount">{total.toLocaleString()}건</span>
        </div>

        <div className="op-logcard">
          <div className="wd-head">
            <span>탈퇴 일시</span>
            <span>역할</span>
            <span>익명 코드</span>
            <span>사유</span>
          </div>
          {state === 'loading' && <div className="wd-empty">불러오는 중…</div>}
          {state === 'error' && (
            <div className="wd-empty">탈퇴 기록을 불러오지 못했어요. 새로고침해 주세요.</div>
          )}
          {state === 'ready' && rows.length === 0 && (
            <div className="wd-empty">
              {hasFilter ? '조건에 맞는 탈퇴 기록이 없어요. 필터를 바꿔 보세요.' : '아직 탈퇴한 계정이 없어요.'}
            </div>
          )}
          {state === 'ready' &&
            rows.map((r) => (
              <div key={r.id} className="wd-row">
                <span className="wd-time">{fmt(r.created_at)}</span>
                <span>
                  <span className="wd-role">{r.role ? (ROLE_LABEL[r.role] ?? r.role) : '-'}</span>
                </span>
                <span className="wd-code">{r.anon_code ?? '-'}</span>
                <span className={'wd-reason' + (r.reason ? '' : ' wd-reason--empty')}>
                  {r.reason || '사유 미입력'}
                </span>
              </div>
            ))}
        </div>

        {/* 페이지네이션 — 감사 로그와 동일 */}
        {state === 'ready' && total > 0 && (
          <div className="op-logpage">
            <span className="op-pageinfo">
              {from.toLocaleString()}–{to.toLocaleString()} / {total.toLocaleString()}건
            </span>
            <div className="op-pagebtns">
              <button
                className="op-pagebtn"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <i className="ph-bold ph-caret-left" />
                이전
              </button>
              <span className="op-pagenow">
                {page} / {totalPages}
              </span>
              <button
                className="op-pagebtn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                다음
                <i className="ph-bold ph-caret-right" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
