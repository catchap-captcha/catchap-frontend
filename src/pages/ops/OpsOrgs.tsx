import { useEffect, useMemo, useState } from 'react';
import { opsApi, type OpsOrg } from '../../api/ops';
import OpsNav from '../../components/ops/OpsNav';
import './OpsApproval.css';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  active: { label: '이용 중', cls: 'active' },
  pending: { label: '승인 대기', cls: 'pending' },
  disabled: { label: '중지', cls: 'disabled' },
};

export default function OpsOrgs() {
  const [rows, setRows] = useState<OpsOrg[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [q, setQ] = useState('');

  const load = () => {
    setState('loading');
    opsApi
      .orgs()
      .then((d) => {
        setRows(Array.isArray(d) ? d : []);
        setState('ready');
      })
      .catch(() => setState('error'));
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter(
      (o) => o.name.toLowerCase().includes(kw) || o.code.toLowerCase().includes(kw),
    );
  }, [rows, q]);

  const totalStudents = useMemo(() => rows.reduce((s, o) => s + (o.students || 0), 0), [rows]);

  return (
    <div className="op-root">
      <OpsNav />
      <main className="op-main">
        <div className="op-head">
          <div>
            <h1 className="op-title">기관 목록</h1>
            <p className="op-sub">
              등록된 전체 기관 {rows.length}곳 · 소속 학생 합계 {totalStudents.toLocaleString()}명
            </p>
          </div>
          <button className="op-refresh" onClick={load}>
            <i className="ph-bold ph-arrows-clockwise" />
            새로고침
          </button>
        </div>

        <div className="op-toolbar">
          <div className="op-search">
            <i className="ph-bold ph-magnifying-glass" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="기관명 또는 코드로 검색"
            />
          </div>
        </div>

        <div className="op-logcard">
          <div className="op-loghead op-orghead">
            <span>기관명</span>
            <span>코드</span>
            <span>유형</span>
            <span>상태</span>
            <span className="op-col-right">학생 수</span>
          </div>

          {state === 'loading' && <div className="op-logrow">불러오는 중…</div>}
          {state === 'error' && (
            <div className="op-logrow">기관 목록을 불러오지 못했어요. 새로고침해 주세요.</div>
          )}
          {state === 'ready' && filtered.length === 0 && (
            <div className="op-logrow">{q ? '검색 결과가 없어요.' : '등록된 기관이 아직 없어요.'}</div>
          )}
          {state === 'ready' &&
            filtered.map((o) => {
              const m = STATUS_META[o.status] ?? { label: o.status, cls: 'disabled' };
              return (
                <div key={o.id} className="op-logrow op-orgrow">
                  <span className="op-org-name">
                    <span className="op-org-ic"><i className="ph-fill ph-buildings" /></span>
                    {o.name}
                  </span>
                  <span className="op-mono">{o.code}</span>
                  <span>{o.org_type}</span>
                  <span>
                    <span className={`op-orgstatus op-orgstatus--${m.cls}`}>{m.label}</span>
                  </span>
                  <span className="op-col-right op-org-students">{(o.students || 0).toLocaleString()}명</span>
                </div>
              );
            })}
        </div>
      </main>
    </div>
  );
}
