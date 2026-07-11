import { useEffect, useState } from 'react';
import { opsApi, type OpsAiModel, type OpsAiModelBody } from '../../api/ops';
import OpsNav from '../../components/ops/OpsNav';
import './OpsApproval.css';

/** 모델 레지스트리 관리 — 이 목록이 각 기관 콘솔 'AI 모델' 화면에 그대로 노출된다.
 * (콘텐츠 관리 도구 — 실제 판정 서빙 여부는 시스템 상태의 'AI 판정 서버'가 진실) */

const STATUS_OPTS = ['정상', '베타', '점검', '중단'] as const;
const STATUS_CLS: Record<string, string> = { 정상: 'ok', 베타: 'neutral', 점검: 'warn', 중단: 'no' };

const EMPTY: OpsAiModelBody = {
  category: '', name: '', provider: '', version: '', status: '베타', description: '',
};

export default function OpsAiModels() {
  const [rows, setRows] = useState<OpsAiModel[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; model: OpsAiModel } | null>(null);
  const [form, setForm] = useState<OpsAiModelBody>(EMPTY);
  const [formErr, setFormErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const say = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 2600);
  };

  const load = () => {
    setState('loading');
    opsApi
      .aiModels()
      .then((d) => {
        setRows(Array.isArray(d) ? d : []);
        setState('ready');
      })
      .catch(() => setState('error'));
  };
  useEffect(load, []);

  const openCreate = () => {
    setForm(EMPTY);
    setFormErr('');
    setModal({ mode: 'create' });
  };
  const openEdit = (m: OpsAiModel) => {
    setForm({
      category: m.category, name: m.name, provider: m.provider,
      version: m.version, status: m.status, description: m.description ?? '',
    });
    setFormErr('');
    setModal({ mode: 'edit', model: m });
  };

  const save = async () => {
    if (!form.category.trim() || !form.name.trim() || !form.provider.trim() || !form.version.trim()) {
      setFormErr('분류·이름·제공자·버전은 필수예요.');
      return;
    }
    setSaving(true);
    setFormErr('');
    try {
      if (modal?.mode === 'edit') {
        await opsApi.updateAiModel(modal.model.id, form);
        say('모델 정보를 수정했어요. 기관 콘솔에 바로 반영돼요.');
      } else {
        await opsApi.createAiModel(form);
        say('모델을 등록했어요. 기관 콘솔에 바로 반영돼요.');
      }
      setModal(null);
      load();
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } };
      setFormErr(err.response?.data?.detail ?? '저장에 실패했어요. 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="op-root">
      <OpsNav />
      <main className="op-main">
        <div className="op-head">
          <div>
            <h1 className="op-title">AI 모델</h1>
            <p className="op-sub">
              여기 등록된 모델 정보가 <b>모든 기관 콘솔의 'AI 모델' 화면에 그대로 노출</b>돼요.
              실제 판정 서버 가동 여부는 <b>시스템</b> 탭이 진실이에요.
            </p>
          </div>
          <button className="op-refresh" onClick={openCreate}>
            <i className="ph-bold ph-plus" />
            모델 등록
          </button>
        </div>

        <div className="op-logcard">
          <div className="op-loghead op-aimodel-grid">
            <span>분류</span><span>모델</span><span>제공자</span><span>버전</span>
            <span>상태</span><span>업데이트</span><span className="op-col-right">관리</span>
          </div>
          {state === 'loading' && <div className="op-logrow">불러오는 중…</div>}
          {state === 'error' && (
            <div className="op-logrow">모델 목록을 불러오지 못했어요. 새로고침해 주세요.</div>
          )}
          {state === 'ready' && rows.length === 0 && (
            <div className="op-logrow">등록된 모델이 없어요. 우측 상단에서 등록해 보세요.</div>
          )}
          {state === 'ready' &&
            rows.map((m) => (
              <div key={m.id} className="op-logrow op-aimodel-grid">
                <span className="op-aimodel-cat">{m.category}</span>
                <span>
                  <b>{m.name}</b>
                  {m.description && <small className="op-aimodel-desc">{m.description}</small>}
                </span>
                <span>{m.provider}</span>
                <span className="op-mono">{m.version}</span>
                <span>
                  <span className={`op-sys-status op-sys-status--${STATUS_CLS[m.status] ?? 'neutral'}`}>
                    {m.status}
                  </span>
                </span>
                <span className="op-logcol-time">{m.updated_on ?? '-'}</span>
                <span className="op-col-right">
                  <button className="op-btn op-btn--reject" onClick={() => openEdit(m)}>
                    <i className="ph-bold ph-pencil-simple" />
                    수정
                  </button>
                </span>
              </div>
            ))}
        </div>
      </main>

      {modal && (
        <div className="op-bh-overlay" onClick={() => !saving && setModal(null)}>
          <div className="op-formmodal" onClick={(e) => e.stopPropagation()}>
            <div className="op-bh-modal-h">
              <span>
                <i className="ph-fill ph-cpu" /> {modal.mode === 'edit' ? '모델 수정' : '모델 등록'}
              </span>
              <button className="op-bh-modal-x" onClick={() => setModal(null)}>
                <i className="ph-bold ph-x" />
              </button>
            </div>
            <div className="op-form-grid">
              <label className="ox-field">
                분류
                <input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="예: 행동 판정" />
              </label>
              <label className="ox-field">
                모델 이름
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="예: KidGuard" />
              </label>
              <label className="ox-field">
                제공자
                <input value={form.provider} onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))} placeholder="예: CatChap" />
              </label>
              <label className="ox-field">
                버전
                <input value={form.version} onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))} placeholder="예: v1.2" />
              </label>
              <label className="ox-field">
                상태
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                  {STATUS_OPTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="ox-field op-form-span2">
                설명 (기관 화면 '용도'로 표시)
                <input value={form.description ?? ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="예: 아동 보정 봇 판정" />
              </label>
            </div>
            {formErr && (
              <div className="op-form-err"><i className="ph-fill ph-warning-circle" /> {formErr}</div>
            )}
            <div className="op-form-actions">
              <button className="op-btn op-btn--reject" disabled={saving} onClick={() => setModal(null)}>취소</button>
              <button className="op-btn op-btn--approve" disabled={saving} onClick={save}>
                <i className="ph-bold ph-check" />
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="op-toast"><i className="ph-fill ph-check-circle" />{toast}</div>}
    </div>
  );
}
