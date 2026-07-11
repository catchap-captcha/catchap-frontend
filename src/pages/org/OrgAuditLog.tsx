import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { orgApi } from '../../api/org';
import OrgLayout from '../../layouts/OrgLayout';
import {
  AUDIT_ACTION_META as ACTION_META,
  AUDIT_TARGET_LABEL as TARGET_LABEL,
} from '../../constants/auditActions';
import './OrgAuditLog.css';

/** 기관 활동 기록 — 자기 기관 구성원(관리자·교사·학부모·학생)의 행동만.
 * 운영자 내부 행위는 서버에서 제외되고, 학생 실행자는 익명 코드로만 보인다. */

interface OrgAuditRow {
  id: string;
  action: string;
  actor_name: string | null;
  actor_email: string | null;
  target_type: string | null;
  target_id: string | null;
  created_at: string | null;
}

function fmt(ts: string | null): string {
  if (!ts) return '-';
  return ts.replace('T', ' ').slice(0, 16); // 서버가 KST 벽시계를 보낸다
}

const PAGE_SIZE = 50;

export default function OrgAuditLog() {
  const { me } = useAuth();
  const orgId = me?.organization_id ?? null;

  const [rows, setRows] = useState<OrgAuditRow[]>([]);
  // 감사 기록은 절대 가짜 행을 보여주지 않는다 — 실제 상태만 표시
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [actions, setActions] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [fAction, setFAction] = useState('');
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');

  const load = () => {
    if (!orgId) return;
    setState('loading');
    orgApi
      .auditLogs(orgId, {
        action: fAction || undefined,
        date_from: fFrom || undefined,
        date_to: fTo || undefined,
        page,
        page_size: PAGE_SIZE,
      })
      .then((d) => {
        setRows(d.items ?? []);
        setTotal(d.total ?? 0);
        setActions(d.actions ?? []);
        setState('ready');
      })
      .catch(() => setState('error'));
  };
  useEffect(load, [orgId, fAction, fFrom, fTo, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const setFilter = (fn: () => void) => {
    fn();
    setPage(1);
  };
  const resetFilters = () => {
    setFAction('');
    setFFrom('');
    setFTo('');
    setPage(1);
  };
  const hasFilter = !!(fAction || fFrom || fTo);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);

  return (
    <OrgLayout active="audit" widget="compliance">
      <div className="oa-head">
        <div>
          <h1 className="oa-title">활동 기록</h1>
          <p className="oa-sub">
            우리 기관에서 일어난 초대·배정·연결·설정 변경의 기록이에요. 학생은 개인정보 보호를
            위해 익명 코드로만 표시돼요.
          </p>
        </div>
        <button className="oa-refresh" onClick={load}>
          <i className="ph-bold ph-arrows-clockwise" />
          새로고침
        </button>
      </div>

      {/* 필터 — 행동·기간 */}
      <div className="oa-filters">
        <select
          className="oa-filsel"
          value={fAction}
          onChange={(e) => setFilter(() => setFAction(e.target.value))}
          title="행동"
        >
          <option value="">전체 행동</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {ACTION_META[a]?.label ?? a}
            </option>
          ))}
        </select>
        <input
          className="oa-fildate"
          type="date"
          value={fFrom}
          max={fTo || undefined}
          onChange={(e) => setFilter(() => setFFrom(e.target.value))}
          title="시작일"
        />
        <span className="oa-fildash">~</span>
        <input
          className="oa-fildate"
          type="date"
          value={fTo}
          min={fFrom || undefined}
          onChange={(e) => setFilter(() => setFTo(e.target.value))}
          title="종료일"
        />
        {hasFilter && (
          <button className="oa-filreset" onClick={resetFilters}>
            <i className="ph-bold ph-x" />
            필터 해제
          </button>
        )}
        <span className="oa-filcount">{total.toLocaleString()}건</span>
      </div>

      <div className="oa-card">
        <div className="oa-loghead">
          <span className="oa-col-act">행동</span>
          <span className="oa-col-who">실행자</span>
          <span className="oa-col-tgt">대상</span>
          <span className="oa-col-time">시각</span>
        </div>
        {state === 'loading' && <div className="oa-row">불러오는 중…</div>}
        {state === 'error' && <div className="oa-row">활동 기록을 불러오지 못했어요. 새로고침해 주세요.</div>}
        {state === 'ready' && rows.length === 0 && (
          <div className="oa-row">
            {hasFilter ? '조건에 맞는 기록이 없어요. 필터를 바꿔 보세요.' : '기록이 아직 없어요.'}
          </div>
        )}
        {state === 'ready' &&
          rows.map((r) => {
            const m = ACTION_META[r.action] ?? { label: r.action, icon: 'ph-dot', cls: 'neutral' };
            return (
              <div key={r.id} className="oa-row">
                <span className="oa-col-act">
                  <span className={`oa-ic oa-ic--${m.cls}`}>
                    <i className={`ph-fill ${m.icon}`} />
                  </span>
                  {m.label}
                </span>
                <span className="oa-col-who">
                  <b className="oa-actor">{r.actor_name ?? '알 수 없음'}</b>
                  {r.actor_email && <small className="oa-actor-sub">{r.actor_email}</small>}
                </span>
                <span className="oa-col-tgt">
                  {r.target_type ? TARGET_LABEL[r.target_type] ?? r.target_type : '-'}
                </span>
                <span className="oa-col-time">{fmt(r.created_at)}</span>
              </div>
            );
          })}
      </div>

      {state === 'ready' && total > 0 && (
        <div className="oa-page">
          <span className="oa-pageinfo">
            {from.toLocaleString()}–{to.toLocaleString()} / {total.toLocaleString()}건
          </span>
          <div className="oa-pagebtns">
            <button className="oa-pagebtn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <i className="ph-bold ph-caret-left" />
              이전
            </button>
            <span className="oa-pagenow">
              {page} / {totalPages}
            </span>
            <button
              className="oa-pagebtn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              다음
              <i className="ph-bold ph-caret-right" />
            </button>
          </div>
        </div>
      )}
    </OrgLayout>
  );
}
