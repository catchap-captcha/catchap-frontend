import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { opsApi, type OrgRegRequest, type OpsAdminCredential } from '../../api/ops';
import OpsNav from '../../components/ops/OpsNav';
import CountUp from '../../components/motion/CountUp';
import './OpsApproval.css';

type Tab = 'pending' | 'approved' | 'rejected';

const TAB_LABEL: Record<Tab, string> = {
  pending: '승인 대기',
  approved: '승인 완료',
  rejected: '거절',
};

const PAGE_SIZE = 50;

export default function OpsApproval() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('pending');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  // 가짜(데모) 신청을 절대 보여주지 않는다 — 실제 데이터/상태만 표시
  const [rows, setRows] = useState<OrgRegRequest[]>([]);
  const [listErr, setListErr] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  // null = 아직 못 불러옴(실패 포함) — 0으로 위장하지 않고 '—'로 표시
  const [kpi, setKpi] = useState<{ organizations: number; open_inquiries: number; audit_logs: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  // 승인 시 발급된 관리자 임시 비밀번호 — 담당자에게 전달용(응답에서만 1회 노출)
  const [creds, setCreds] = useState<OpsAdminCredential[] | null>(null);
  // 임시 비번 이메일 발송 상태(담당자별)
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [sendMsg, setSendMsg] = useState<Record<string, string>>({});

  const load = () => {
    setListLoading(true);
    opsApi
      .registrationRequestsPage({ status_filter: tab, page, page_size: PAGE_SIZE })
      .then((d) => {
        const items = d.items ?? [];
        const tot = d.total ?? 0;
        const maxPage = Math.max(1, Math.ceil(tot / PAGE_SIZE));
        // 마지막 페이지의 마지막 항목이 빠지면 빈 페이지에 갇힌다 — 유효 페이지로 보정(재조회 유발)
        if (items.length === 0 && page > maxPage) {
          setPage(maxPage);
          return;
        }
        setRows(items);
        setTotal(tot);
        setCounts(d.counts ?? { pending: 0, approved: 0, rejected: 0 });
        setListErr(false);
      })
      .catch(() => setListErr(true))
      .finally(() => setListLoading(false));
    opsApi
      .dashboard()
      .then(
        (d) =>
          d &&
          setKpi({
            organizations: d.organizations,
            open_inquiries: d.open_inquiries,
            audit_logs: d.audit_logs,
          }),
      )
      .catch(() => {
        setKpi(null); // 실패를 0으로 위장하지 않는다 — 렌더에서 '—' 표시
      });
  };

  useEffect(load, [tab, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (id: string, kind: 'approve' | 'reject') => {
    // 승인 = 실기관·관리자 계정 생성 + 임시비번 이메일 발송까지 비가역 실행 — 원클릭 방지
    const req = rows.find((r) => r.id === id);
    const who = req ? `'${req.org_name}'` : '이 신청';
    if (
      !window.confirm(
        kind === 'approve'
          ? `${who}을(를) 승인할까요? 기관·관리자 계정이 만들어지고 임시 비밀번호가 이메일로 발송돼요.`
          : `${who}을(를) 거절할까요?`,
      )
    )
      return;
    setBusy(id);
    try {
      if (kind === 'approve') {
        const res = await opsApi.approve(id);
        if (res?.admin_credentials?.length) setCreds(res.admin_credentials);
      } else await opsApi.reject(id);
      setToast(kind === 'approve' ? '기관을 승인했어요.' : '신청을 거절했어요.');
      load();
    } catch {
      // 승인/거절이 서버에 반영되지 않았으면 성공으로 위장하지 않는다 — 실제 오류를 노출
      setToast(
        kind === 'approve'
          ? '승인 처리에 실패했어요. 다시 시도해 주세요.'
          : '거절 처리에 실패했어요. 다시 시도해 주세요.',
      );
    } finally {
      setBusy(null);
      setTimeout(() => setToast(''), 2200);
    }
  };

  const list = rows; // 서버가 tab(status_filter)으로 걸러 내려준다
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="op-root">
      <OpsNav />

      <main className="op-main">
        <div className="op-head">
          <div>
            <h1 className="op-title">기관 가입 승인</h1>
            <p className="op-sub">기관이 가입을 신청하면 여기서 검토하고 승인해야 이용이 시작돼요.</p>
          </div>
          <button className="op-refresh" onClick={load}><i className="ph-bold ph-arrows-clockwise" />새로고침</button>
        </div>

        {/* KPI — 각 지표는 담당 섹션으로 바로 이동 (전체 학생 지표는 운영자 범위 밖이라 제거) */}
        <div className="op-kpis">
          <button type="button" className="op-kpi op-kpi--link" onClick={() => { setTab('pending'); setPage(1); }}>
            <span className="op-kpi-ic op-kpi-ic--pend"><i className="ph-fill ph-hourglass-medium" /></span>
            <div className="op-kpi-num"><CountUp value={counts.pending} /></div>
            <div className="op-kpi-lb">승인 대기 <i className="ph-bold ph-arrow-right op-kpi-go" /></div>
          </button>
          <button type="button" className="op-kpi op-kpi--link" onClick={() => navigate(PATHS.OPS_ORGS)}>
            <span className="op-kpi-ic op-kpi-ic--org"><i className="ph-fill ph-buildings" /></span>
            <div className="op-kpi-num">{kpi ? <CountUp value={kpi.organizations} /> : '—'}</div>
            <div className="op-kpi-lb">등록 기관 <i className="ph-bold ph-arrow-right op-kpi-go" /></div>
          </button>
          <button type="button" className="op-kpi op-kpi--link" onClick={() => navigate(PATHS.OPS_INQUIRIES)}>
            <span className="op-kpi-ic op-kpi-ic--inq"><i className="ph-fill ph-chat-circle-dots" /></span>
            <div className="op-kpi-num">{kpi ? <CountUp value={kpi.open_inquiries} /> : '—'}</div>
            <div className="op-kpi-lb">미처리 문의 <i className="ph-bold ph-arrow-right op-kpi-go" /></div>
          </button>
          <button type="button" className="op-kpi op-kpi--link" onClick={() => navigate(PATHS.OPS_LOGS)}>
            <span className="op-kpi-ic op-kpi-ic--log"><i className="ph-fill ph-scroll" /></span>
            <div className="op-kpi-num">{kpi ? <CountUp value={kpi.audit_logs} /> : '—'}</div>
            <div className="op-kpi-lb">감사 로그 <i className="ph-bold ph-arrow-right op-kpi-go" /></div>
          </button>
        </div>

        {/* TABS */}
        <div className="op-tabs">
          {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
            <button key={t} className={`op-tab${tab === t ? ' op-tab--on' : ''}`} onClick={() => { setTab(t); setPage(1); }}>
              {TAB_LABEL[t]}
              <span className="op-tab-count">{counts[t]}</span>
            </button>
          ))}
        </div>

        {/* LIST */}
        {listLoading ? (
          <div className="op-empty">
            <i className="ph-duotone ph-spinner-gap" />
            <p>신청 목록을 불러오는 중…</p>
          </div>
        ) : listErr ? (
          <div className="op-empty">
            <i className="ph-duotone ph-warning" />
            <p>신청 목록을 불러오지 못했어요. 새로고침해 주세요.</p>
          </div>
        ) : list.length === 0 ? (
          <div className="op-empty">
            <i className="ph-duotone ph-tray" />
            <p>{tab === 'pending' ? '대기 중인 신청이 없어요.' : `${TAB_LABEL[tab]} 항목이 없어요.`}</p>
          </div>
        ) : (
          <div className="op-list">
            {list.map((r) => (
              <div key={r.id} className="op-card">
                <div className="op-card-top">
                  <span className="op-card-ic"><i className="ph-fill ph-buildings" /></span>
                  <div className="op-card-main">
                    <div className="op-card-name">
                      {r.org_name}
                      <span className="op-card-type">{r.org_type}</span>
                    </div>
                    <div className="op-card-code">{r.org_code ?? '코드 발급 대기'}</div>
                  </div>
                  <span className={`op-status op-status--${r.status}`}>
                    {r.status === 'pending' ? '대기' : r.status === 'approved' ? '승인됨' : '거절됨'}
                  </span>
                </div>

                <div className="op-card-grid">
                  <div className="op-field"><span className="op-field-k">담당자</span><span className="op-field-v">{r.contact_name}</span></div>
                  <div className="op-field"><span className="op-field-k">이메일</span><span className="op-field-v">{r.contact_email}</span></div>
                  <div className="op-field"><span className="op-field-k">연락처</span><span className="op-field-v">{r.contact_phone ?? '-'}</span></div>
                  <div className="op-field"><span className="op-field-k">사업자번호</span><span className="op-field-v">{r.business_number ?? '-'}</span></div>
                  <div className="op-field"><span className="op-field-k">예상 학생수</span><span className="op-field-v">{r.expected_students ?? '-'}</span></div>
                  <div className="op-field"><span className="op-field-k">관심 요금제</span><span className="op-field-v">{(r.plan_interest ?? '-').toUpperCase()}</span></div>
                  <div className="op-field op-field--wide"><span className="op-field-k">주소</span><span className="op-field-v">{r.address ?? '-'}</span></div>
                </div>

                {r.status === 'pending' && (
                  <div className="op-card-actions">
                    <button className="op-btn op-btn--reject" disabled={busy === r.id} onClick={() => act(r.id, 'reject')}>
                      <i className="ph-bold ph-x" />거절
                    </button>
                    <button className="op-btn op-btn--approve" disabled={busy === r.id} onClick={() => act(r.id, 'approve')}>
                      <i className="ph-bold ph-check" />승인하기
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!listLoading && !listErr && (total > PAGE_SIZE || page > 1) && (
          <div className="op-logpage">
            <span className="op-pageinfo">{page} / {totalPages} 페이지 · {total.toLocaleString()}건</span>
            <div className="op-pagebtns">
              <button className="op-pagebtn" disabled={page <= 1} onClick={() => setPage((v) => Math.max(1, v - 1))}>
                <i className="ph-bold ph-caret-left" />이전
              </button>
              <button className="op-pagebtn" disabled={page >= totalPages} onClick={() => setPage((v) => Math.min(totalPages, v + 1))}>
                다음<i className="ph-bold ph-caret-right" />
              </button>
            </div>
          </div>
        )}
      </main>

      {toast && <div className="op-toast"><i className="ph-fill ph-check-circle" />{toast}</div>}

      {creds && (
        <div className="op-cred-backdrop" onClick={() => setCreds(null)}>
          <div className="op-cred-modal" onClick={(e) => e.stopPropagation()}>
            <div className="op-cred-head">
              <i className="ph-fill ph-key" />
              <h3>관리자 임시 비밀번호</h3>
            </div>
            <p className="op-cred-desc">
              아래 임시 비밀번호는 <b>지금만 확인</b>할 수 있어요. 담당자에게 전달해 주세요.
              관리자는 이 비밀번호로 로그인한 뒤 새 비밀번호로 변경하면 됩니다.
            </p>
            {creds.map((c) => (
              <div key={c.email} className="op-cred-row">
                <div className="op-cred-field">
                  <span className="op-cred-k">이메일</span>
                  <span className="op-cred-v">{c.email}</span>
                </div>
                <div className="op-cred-field">
                  <span className="op-cred-k">임시 비밀번호</span>
                  <code className="op-cred-pw">{c.temp_password}</code>
                  <button
                    className="op-cred-copy"
                    onClick={() => navigator.clipboard?.writeText(c.temp_password)}
                  >
                    <i className="ph-bold ph-copy" />복사
                  </button>
                  <button
                    className="op-cred-send"
                    disabled={sendingEmail === c.email}
                    onClick={async () => {
                      setSendingEmail(c.email);
                      try {
                        const r = await opsApi.sendAdminCredentials(
                          c.organization_id,
                          c.email,
                          c.temp_password,
                        );
                        const label =
                          r.email_status === 'sent'
                            ? '담당자 이메일로 발송했어요.'
                            : r.email_status === 'dry_run'
                              ? '개발 모드(dry-run) — 콘솔에 출력됨(실발송 아님).'
                              : '발송 실패 — SMTP 설정을 확인해 주세요.';
                        setSendMsg((m) => ({ ...m, [c.email]: label }));
                      } catch {
                        setSendMsg((m) => ({
                          ...m,
                          [c.email]: '발송 요청에 실패했어요. 다시 시도해 주세요.',
                        }));
                      } finally {
                        setSendingEmail(null);
                      }
                    }}
                  >
                    <i className="ph-bold ph-paper-plane-tilt" />
                    {sendingEmail === c.email ? '발송 중…' : '이메일로 발송'}
                  </button>
                </div>
                {sendMsg[c.email] && <div className="op-cred-sent">{sendMsg[c.email]}</div>}
              </div>
            ))}
            <button className="op-cred-done" onClick={() => setCreds(null)}>
              확인했어요
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
