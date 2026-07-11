import { useEffect, useState } from 'react';
import {
  opsApi,
  type OpsOrg,
  type OpsOrgCreated,
  type OpsOrgCreateInput,
} from '../../api/ops';
import OpsNav from '../../components/ops/OpsNav';
import './OpsApproval.css';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  active: { label: '이용 중', cls: 'active' },
  pending: { label: '승인 대기', cls: 'pending' },
  disabled: { label: '중지', cls: 'disabled' },
};

const ORG_TYPES = ['초등학교', '유치원', '어린이집', '학원', '기타'];
const STATUS_OPTS = [
  { key: 'active', label: '이용 중' },
  { key: 'pending', label: '승인 대기' },
  { key: 'disabled', label: '중지' },
];

type FormState = {
  name: string;
  org_type: string;
  status: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  business_number: string;
  admin_name: string;
  admin_email: string;
};

const EMPTY_FORM: FormState = {
  name: '',
  org_type: '초등학교',
  status: 'active',
  contact_email: '',
  contact_phone: '',
  address: '',
  business_number: '',
  admin_name: '',
  admin_email: '',
};

type Modal = { mode: 'create' } | { mode: 'edit'; org: OpsOrg } | null;

const PAGE_SIZE = 50;

export default function OpsOrgs() {
  const [rows, setRows] = useState<OpsOrg[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState(''); // Enter로 확정된 서버 검색어
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState({ all: 0, students: 0 });
  const [modal, setModal] = useState<Modal>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<OpsOrg | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [created, setCreated] = useState<OpsOrgCreated | null>(null);
  const [toast, setToast] = useState('');

  const say = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 2600);
  };

  const load = () => {
    setState('loading');
    opsApi
      .orgsPage({ ...(search ? { search } : {}), page, page_size: PAGE_SIZE })
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
        setTotals({ all: d.total_all ?? 0, students: d.total_students ?? 0 });
        setState('ready');
      })
      .catch(() => setState('error'));
  };
  useEffect(load, [search, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = rows;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormErr('');
    setModal({ mode: 'create' });
  };

  const openEdit = (org: OpsOrg) => {
    setForm({
      name: org.name,
      org_type: org.org_type,
      status: org.status,
      contact_email: org.contact_email ?? '',
      contact_phone: org.contact_phone ?? '',
      address: org.address ?? '',
      business_number: org.business_number ?? '',
      admin_name: '',
      admin_email: '',
    });
    setFormErr('');
    setModal({ mode: 'edit', org });
  };

  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!modal) return;
    if (!form.name.trim()) {
      setFormErr('기관명을 입력해 주세요.');
      return;
    }
    if (modal.mode === 'create' && (!form.admin_name.trim() || !form.admin_email.trim())) {
      setFormErr('기관을 이용하려면 관리자 이름과 이메일이 필요해요.');
      return;
    }
    setSaving(true);
    setFormErr('');
    try {
      if (modal.mode === 'create') {
        const body: OpsOrgCreateInput = {
          name: form.name.trim(),
          org_type: form.org_type,
          status: form.status,
          contact_email: form.contact_email.trim() || null,
          contact_phone: form.contact_phone.trim() || null,
          address: form.address.trim() || null,
          business_number: form.business_number.trim() || null,
          admin_name: form.admin_name.trim(),
          admin_email: form.admin_email.trim(),
        };
        const res = await opsApi.createOrg(body);
        setModal(null);
        setCreated(res); // 임시 비밀번호 결과 모달
        load();
      } else {
        await opsApi.updateOrg(modal.org.id, {
          name: form.name.trim(),
          org_type: form.org_type,
          status: form.status,
          contact_email: form.contact_email.trim() || null,
          contact_phone: form.contact_phone.trim() || null,
          address: form.address.trim() || null,
          business_number: form.business_number.trim() || null,
        });
        setModal(null);
        say('기관 정보를 수정했어요.');
        load();
      }
    } catch (e) {
      // 서버가 실패를 반환하면 성공으로 위장하지 않는다 — 실제 사유를 노출
      const err = e as { response?: { data?: { detail?: string } } };
      setFormErr(err.response?.data?.detail ?? '저장에 실패했어요. 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await opsApi.deleteOrg(deleteTarget.id);
      setDeleteTarget(null);
      say('기관을 삭제했어요.');
      load();
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } };
      // 소속 학생/키가 있으면 서버가 409 + 사유를 준다 — 그대로 안내
      say(err.response?.data?.detail ?? '삭제에 실패했어요. 다시 시도해 주세요.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="op-root">
      <OpsNav />
      <main className="op-main">
        <div className="op-head">
          <div>
            <h1 className="op-title">기관 관리</h1>
            <p className="op-sub">
              등록된 전체 기관 {totals.all}곳 · 소속 학생 합계 {totals.students.toLocaleString()}명
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="op-addbtn" onClick={openCreate}>
              <i className="ph-bold ph-plus" />
              기관 추가
            </button>
            <button className="op-refresh" onClick={load}>
              <i className="ph-bold ph-arrows-clockwise" />
              새로고침
            </button>
          </div>
        </div>

        <div className="op-toolbar">
          <div className="op-search">
            <i className="ph-bold ph-magnifying-glass" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setSearch(q.trim());
                  setPage(1);
                }
              }}
              placeholder="기관명·코드·담당 이메일 검색 후 Enter"
            />
            {search && (
              <button
                className="op-inqsearch-x"
                onClick={() => {
                  setSearch('');
                  setQ('');
                  setPage(1);
                }}
              >
                <i className="ph-bold ph-x" /> 해제
              </button>
            )}
          </div>
        </div>

        <div className="op-logcard">
          <div className="op-loghead op-orghead op-orghead--manage">
            <span>기관명</span>
            <span>코드</span>
            <span>유형</span>
            <span>상태</span>
            <span className="op-col-right">학생 수</span>
            <span className="op-col-right">관리</span>
          </div>

          {state === 'loading' && <div className="op-logrow">불러오는 중…</div>}
          {state === 'error' && (
            <div className="op-logrow">기관 목록을 불러오지 못했어요. 새로고침해 주세요.</div>
          )}
          {state === 'ready' && filtered.length === 0 && (
            <div className="op-logrow">{search ? '검색 결과가 없어요.' : '등록된 기관이 아직 없어요.'}</div>
          )}
          {state === 'ready' &&
            filtered.map((o) => {
              const m = STATUS_META[o.status] ?? { label: o.status, cls: 'disabled' };
              return (
                <div key={o.id} className="op-logrow op-orgrow op-orgrow--manage">
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
                  <span className="op-col-right op-org-actions">
                    <button className="op-iconbtn" title="수정" onClick={() => openEdit(o)}>
                      <i className="ph-bold ph-pencil-simple" />
                    </button>
                    <button
                      className="op-iconbtn op-iconbtn--danger"
                      title="삭제"
                      onClick={() => setDeleteTarget(o)}
                    >
                      <i className="ph-bold ph-trash" />
                    </button>
                  </span>
                </div>
              );
            })}
        </div>

        {state === 'ready' && (total > PAGE_SIZE || page > 1) && (
          <div className="op-logpage">
            <span className="op-pageinfo">{page} / {totalPages} 페이지 · {total.toLocaleString()}곳</span>
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

      {/* 생성/수정 모달 */}
      {modal && (
        <div className="op-bh-overlay" onClick={() => !saving && setModal(null)}>
          <div className="op-formmodal" onClick={(e) => e.stopPropagation()}>
            <div className="op-bh-modal-h">
              <span>
                <i className={`ph-fill ${modal.mode === 'create' ? 'ph-plus-circle' : 'ph-pencil-simple'}`} />
                {modal.mode === 'create' ? '기관 추가' : '기관 수정'}
              </span>
              <button className="op-bh-modal-x" onClick={() => !saving && setModal(null)}>
                <i className="ph-bold ph-x" />
              </button>
            </div>

            <div className="op-form">
              <label className="op-form-row">
                <span className="op-form-lb">기관명 <b>*</b></span>
                <input className="op-form-in" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="예: 햇살초등학교" />
              </label>
              <div className="op-form-2col">
                <label className="op-form-row">
                  <span className="op-form-lb">유형</span>
                  <select className="op-form-in" value={form.org_type} onChange={(e) => set('org_type', e.target.value)}>
                    {ORG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label className="op-form-row">
                  <span className="op-form-lb">상태</span>
                  <select className="op-form-in" value={form.status} onChange={(e) => set('status', e.target.value)}>
                    {STATUS_OPTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </label>
              </div>
              <div className="op-form-2col">
                <label className="op-form-row">
                  <span className="op-form-lb">담당자 이메일</span>
                  <input className="op-form-in" value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} placeholder="contact@school.kr" />
                </label>
                <label className="op-form-row">
                  <span className="op-form-lb">연락처</span>
                  <input className="op-form-in" value={form.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} placeholder="02-000-0000" />
                </label>
              </div>
              <div className="op-form-2col">
                <label className="op-form-row">
                  <span className="op-form-lb">주소</span>
                  <input className="op-form-in" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="서울시 ..." />
                </label>
                <label className="op-form-row">
                  <span className="op-form-lb">사업자번호</span>
                  <input className="op-form-in" value={form.business_number} onChange={(e) => set('business_number', e.target.value)} placeholder="000-00-00000" />
                </label>
              </div>

              {modal.mode === 'create' && (
                <>
                  <div className="op-form-divider"><i className="ph-fill ph-user-gear" /> 기관 관리자(교장) 계정</div>
                  <p className="op-form-hint">
                    기관을 실제로 이용하려면 로그인할 관리자 계정이 필요해요. 임시 비밀번호가 생성되고, 저장 직후 한 번만 표시돼요.
                  </p>
                  <div className="op-form-2col">
                    <label className="op-form-row">
                      <span className="op-form-lb">관리자 이름 <b>*</b></span>
                      <input className="op-form-in" value={form.admin_name} onChange={(e) => set('admin_name', e.target.value)} placeholder="예: 김교장" />
                    </label>
                    <label className="op-form-row">
                      <span className="op-form-lb">관리자 이메일 <b>*</b></span>
                      <input className="op-form-in" value={form.admin_email} onChange={(e) => set('admin_email', e.target.value)} placeholder="principal@school.kr" />
                    </label>
                  </div>
                </>
              )}

              {formErr && <div className="op-form-err"><i className="ph-fill ph-warning-circle" />{formErr}</div>}

              <div className="op-form-actions">
                <button className="op-btn op-btn--reject" disabled={saving} onClick={() => setModal(null)}>취소</button>
                <button className="op-btn op-btn--approve" disabled={saving} onClick={submit}>
                  <i className="ph-bold ph-check" />
                  {saving ? '저장 중…' : modal.mode === 'create' ? '기관 추가' : '변경 저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 생성 결과 — 임시 비밀번호 1회 노출 */}
      {created && (
        <div className="op-bh-overlay" onClick={() => setCreated(null)}>
          <div className="op-formmodal" onClick={(e) => e.stopPropagation()}>
            <div className="op-bh-modal-h">
              <span><i className="ph-fill ph-check-circle" /> 기관을 추가했어요</span>
              <button className="op-bh-modal-x" onClick={() => setCreated(null)}><i className="ph-bold ph-x" /></button>
            </div>
            <div className="op-form">
              <p className="op-form-hint">
                <b>{created.name}</b> 기관과 관리자 계정을 만들었어요. 임시 비밀번호를 <b>{created.admin_email}</b>로
                자동 발송했고, 관리자는 <b>첫 로그인 시 새 비밀번호를 반드시 설정</b>해야 합니다.
              </p>
              {created.admin_email_status === 'sent' ? (
                <div className="op-mailstat op-mailstat--ok">
                  <i className="ph-fill ph-check-circle" /> 임시 비밀번호를 이메일로 보냈어요.
                </div>
              ) : created.admin_email_status === 'dry_run' ? (
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
                <div className="op-cred-row"><span>기관 코드</span><b className="op-mono">{created.code}</b></div>
                <div className="op-cred-row"><span>관리자 이메일</span><b>{created.admin_email}</b></div>
                <div className="op-cred-row op-cred-row--pw">
                  <span>임시 비밀번호</span>
                  <b className="op-mono">{created.admin_temp_password}</b>
                  <button
                    className="op-iconbtn"
                    title="복사"
                    onClick={() => {
                      navigator.clipboard?.writeText(created.admin_temp_password);
                      say('임시 비밀번호를 복사했어요.');
                    }}
                  >
                    <i className="ph-bold ph-copy" />
                  </button>
                </div>
              </div>
              <div className="op-form-actions">
                <button className="op-btn op-btn--approve" onClick={() => setCreated(null)}>확인</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 */}
      {deleteTarget && (
        <div className="op-bh-overlay" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="op-confirmmodal" onClick={(e) => e.stopPropagation()}>
            <div className="op-confirm-ic"><i className="ph-fill ph-warning" /></div>
            <div className="op-confirm-title">기관을 삭제할까요?</div>
            <p className="op-confirm-body">
              <b>{deleteTarget.name}</b>({deleteTarget.code})을(를) 삭제해요. 소속 학생이나 발급된 API 키가 있으면
              삭제되지 않고, 대신 이용을 막으려면 상태를 ‘중지’로 바꾸세요. 이 작업은 되돌릴 수 없어요.
            </p>
            <div className="op-form-actions">
              <button className="op-btn op-btn--reject" disabled={deleting} onClick={() => setDeleteTarget(null)}>취소</button>
              <button className="op-btn op-btn--danger" disabled={deleting} onClick={doDelete}>
                <i className="ph-bold ph-trash" />
                {deleting ? '삭제 중…' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="op-toast"><i className="ph-fill ph-check-circle" />{toast}</div>}
    </div>
  );
}
