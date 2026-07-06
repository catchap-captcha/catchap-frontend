import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { opsApi, type OrgRegRequest } from '../../api/ops';
import OpsNav from '../../components/ops/OpsNav';
import CountUp from '../../components/motion/CountUp';
import './OpsApproval.css';

type Tab = 'pending' | 'approved' | 'rejected';

const TAB_LABEL: Record<Tab, string> = {
  pending: '승인 대기',
  approved: '승인 완료',
  rejected: '거절',
};

export default function OpsApproval() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('pending');
  // 가짜(데모) 신청을 절대 보여주지 않는다 — 실제 데이터/상태만 표시
  const [rows, setRows] = useState<OrgRegRequest[]>([]);
  const [listErr, setListErr] = useState(false);
  const [kpi, setKpi] = useState({ organizations: 0, open_inquiries: 0, audit_logs: 0 });
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const load = () => {
    opsApi
      .registrationRequests()
      .then((d) => {
        setRows(Array.isArray(d) ? d : []);
        setListErr(false);
      })
      .catch(() => setListErr(true));
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
      .catch(() => {});
  };

  useEffect(load, []);

  const act = async (id: string, kind: 'approve' | 'reject') => {
    setBusy(id);
    try {
      if (kind === 'approve') await opsApi.approve(id);
      else await opsApi.reject(id);
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

  const counts = {
    pending: rows.filter((r) => r.status === 'pending').length,
    approved: rows.filter((r) => r.status === 'approved').length,
    rejected: rows.filter((r) => r.status === 'rejected').length,
  };
  const list = rows.filter((r) => r.status === tab);

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
          <button type="button" className="op-kpi op-kpi--link" onClick={() => setTab('pending')}>
            <span className="op-kpi-ic op-kpi-ic--pend"><i className="ph-fill ph-hourglass-medium" /></span>
            <div className="op-kpi-num"><CountUp value={counts.pending} /></div>
            <div className="op-kpi-lb">승인 대기 <i className="ph-bold ph-arrow-right op-kpi-go" /></div>
          </button>
          <button type="button" className="op-kpi op-kpi--link" onClick={() => navigate(PATHS.OPS_ORGS)}>
            <span className="op-kpi-ic op-kpi-ic--org"><i className="ph-fill ph-buildings" /></span>
            <div className="op-kpi-num"><CountUp value={kpi.organizations} /></div>
            <div className="op-kpi-lb">등록 기관 <i className="ph-bold ph-arrow-right op-kpi-go" /></div>
          </button>
          <button type="button" className="op-kpi op-kpi--link" onClick={() => navigate(PATHS.OPS_INQUIRIES)}>
            <span className="op-kpi-ic op-kpi-ic--inq"><i className="ph-fill ph-chat-circle-dots" /></span>
            <div className="op-kpi-num"><CountUp value={kpi.open_inquiries} /></div>
            <div className="op-kpi-lb">미처리 문의 <i className="ph-bold ph-arrow-right op-kpi-go" /></div>
          </button>
          <button type="button" className="op-kpi op-kpi--link" onClick={() => navigate(PATHS.OPS_LOGS)}>
            <span className="op-kpi-ic op-kpi-ic--log"><i className="ph-fill ph-scroll" /></span>
            <div className="op-kpi-num"><CountUp value={kpi.audit_logs} /></div>
            <div className="op-kpi-lb">감사 로그 <i className="ph-bold ph-arrow-right op-kpi-go" /></div>
          </button>
        </div>

        {/* TABS */}
        <div className="op-tabs">
          {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
            <button key={t} className={`op-tab${tab === t ? ' op-tab--on' : ''}`} onClick={() => setTab(t)}>
              {TAB_LABEL[t]}
              <span className="op-tab-count">{counts[t]}</span>
            </button>
          ))}
        </div>

        {/* LIST */}
        {listErr ? (
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
      </main>

      {toast && <div className="op-toast"><i className="ph-fill ph-check-circle" />{toast}</div>}
    </div>
  );
}
