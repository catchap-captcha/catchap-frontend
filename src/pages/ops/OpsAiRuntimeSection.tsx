import { useEffect, useState } from 'react';
import {
  opsAiRuntimeApi,
  type AiRuntime,
  type AiRuntimeModel,
  type AiRuntimeModelBody,
} from '../../api/ops';
import { errorDetail } from '../../api/lectures';
import { fmtKrw } from '../../utils/currency';

/** 운영자 AI 모델 선택(#26) — 실제 LLM 호출(문항 생성·자기검증)에 쓰는 모델을 고른다.
 *
 *  왜 여기(설정 페이지)인가: AI 키와 한 화면에서 "모델 먼저, 키는 맨 나중" 순서로 둔다.
 *  왜 표시용 카탈로그(AI 모델 메뉴)와 분리했나: 그 페이지는 기관 콘솔에 '보여주기'만
 *  하고 실제 호출과 무관하다 — 여기서 고른 모델이 진짜로 호출된다(/ops/ai-runtime).
 *
 *  2슬롯(생성/검증): 파이프라인의 두 LLM 용도에 각각 모델을 지정한다(예: 생성=강한 모델,
 *  검증=저렴한 모델). 자동 스왑: 슬롯 모델이 꺼졌거나 호출 실패면 다른 켜진 모델로 대체해
 *  파이프라인이 통째로 멈추지 않게 한다. 토큰/추정비용은 응답 usage를 모델별로 누적한다. */

const num = (n: number) => n.toLocaleString('ko-KR');
const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;

function ModelModal({
  initial,
  saving,
  onClose,
  onSave,
}: {
  initial: AiRuntimeModel | null;
  saving: boolean;
  onClose: () => void;
  onSave: (body: AiRuntimeModelBody) => void;
}) {
  const [provider, setProvider] = useState(initial?.provider ?? 'Anthropic');
  const [name, setName] = useState(initial?.name ?? '');
  const [modelId, setModelId] = useState(initial?.model_id ?? '');
  const [costIn, setCostIn] = useState(String(initial?.cost_in_usd ?? ''));
  const [costOut, setCostOut] = useState(String(initial?.cost_out_usd ?? ''));
  const [err, setErr] = useState('');

  const submit = () => {
    if (!name.trim()) return setErr('표시 이름을 입력해 주세요.');
    if (!modelId.trim()) return setErr('모델 ID(API 문자열)를 입력해 주세요.');
    setErr('');
    onSave({
      provider: provider.trim() || 'Anthropic',
      name: name.trim(),
      model_id: modelId.trim(),
      cost_in_usd: Number(costIn) || 0,
      cost_out_usd: Number(costOut) || 0,
    });
  };

  return (
    <div className="op-bh-overlay" onClick={() => !saving && onClose()}>
      <div className="op-formmodal" onClick={(e) => e.stopPropagation()}>
        <div className="op-bh-modal-h">
          <span>
            <i className="ph-fill ph-cpu" /> {initial ? '모델 수정' : '모델 추가'}
          </span>
          <button className="op-bh-modal-x" onClick={() => !saving && onClose()}>
            <i className="ph-bold ph-x" />
          </button>
        </div>
        <div className="op-form">
          <p className="op-form-hint">
            <b>회사</b>가 실제 호출 API를 정해요 — Anthropic(Messages) 또는 OpenAI(Chat
            Completions). <b>모델 ID</b>에는 그 회사의 API 모델 문자열을 넣어 주세요(예:{' '}
            <code>claude-opus-4-8</code>, <code>gpt-5</code>). OpenAI 모델은 아래 <b>STT 키
            (OpenAI)</b>를 함께 써요. 단가는 공시가($/100만 토큰)를 넣으면 추정 비용(환율 1,380원 기준
            원화)에 쓰여요(선택).
          </p>
          <label className="op-form-row">
            <span className="op-form-lb">회사 <b>*</b></span>
            <select className="op-form-in" value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="Anthropic">Anthropic (Claude)</option>
              <option value="OpenAI">OpenAI (GPT)</option>
            </select>
          </label>
          <label className="op-form-row">
            <span className="op-form-lb">표시 이름 <b>*</b></span>
            <input className="op-form-in" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 오퍼스(생성용)" />
          </label>
          <label className="op-form-row">
            <span className="op-form-lb">모델 ID <b>*</b></span>
            <input
              className="op-form-in"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              placeholder={provider === 'OpenAI' ? 'gpt-5' : 'claude-opus-4-8'}
              spellCheck={false}
            />
          </label>
          <div className="op-form-row op-form-row--split">
            <label className="op-form-half">
              <span className="op-form-lb">입력 단가 ($/1M)</span>
              <input className="op-form-in" type="number" min={0} step="0.01" value={costIn} onChange={(e) => setCostIn(e.target.value)} placeholder="5" />
            </label>
            <label className="op-form-half">
              <span className="op-form-lb">출력 단가 ($/1M)</span>
              <input className="op-form-in" type="number" min={0} step="0.01" value={costOut} onChange={(e) => setCostOut(e.target.value)} placeholder="25" />
            </label>
          </div>
          {err && (
            <div className="op-form-err">
              <i className="ph-fill ph-warning-circle" /> {err}
            </div>
          )}
          <div className="op-form-actions">
            <button className="op-btn op-btn--reject" disabled={saving} onClick={onClose}>
              취소
            </button>
            <button className="op-btn op-btn--approve" disabled={saving} onClick={submit}>
              <i className="ph-bold ph-check" />
              {saving ? '저장 중…' : initial ? '수정' : '추가'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OpsAiRuntimeSection() {
  const [rt, setRt] = useState<AiRuntime | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<{ mode: 'add' } | { mode: 'edit'; m: AiRuntimeModel } | null>(null);

  const reload = () => {
    setLoadErr('');
    opsAiRuntimeApi
      .get()
      .then(setRt)
      .catch((e) => setLoadErr(errorDetail(e, 'AI 모델 설정을 불러오지 못했어요.')));
  };
  useEffect(reload, []);

  const say = (ok: boolean, text: string) => setBanner({ ok, text });

  const setSlot = async (slot: 'generate' | 'verify', modelId: string) => {
    setBusy(true);
    setBanner(null);
    try {
      const res = await opsAiRuntimeApi.putConfig(
        slot === 'generate' ? { generate_model_id: modelId || null } : { verify_model_id: modelId || null },
      );
      setRt(res); // 서버가 돌려준 상태로만 반영(가짜 성공 금지)
      say(true, `${slot === 'generate' ? '생성' : '검증'} 슬롯을 ${modelId ? '지정' : '미설정'}했어요.`);
    } catch (e) {
      say(false, errorDetail(e, '슬롯 배정에 실패했어요.'));
    } finally {
      setBusy(false);
    }
  };

  const toggleSwap = async () => {
    if (!rt) return;
    setBusy(true);
    setBanner(null);
    try {
      const res = await opsAiRuntimeApi.putConfig({ auto_swap: !rt.auto_swap });
      setRt(res);
      say(true, `자동 스왑을 ${res.auto_swap ? '켰어요' : '껐어요'}.`);
    } catch (e) {
      say(false, errorDetail(e, '자동 스왑 변경에 실패했어요.'));
    } finally {
      setBusy(false);
    }
  };

  const toggleEnabled = async (m: AiRuntimeModel) => {
    setBusy(true);
    setBanner(null);
    try {
      await opsAiRuntimeApi.updateModel(m.id, { enabled: !m.enabled });
      reload();
      say(true, `'${m.name}'을(를) ${m.enabled ? '껐어요' : '켰어요'}.`);
    } catch (e) {
      say(false, errorDetail(e, '변경에 실패했어요.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (m: AiRuntimeModel) => {
    if (!window.confirm(`'${m.name}' 모델을 삭제할까요? 슬롯에 배정돼 있었다면 함께 해제돼요.`)) return;
    setBusy(true);
    setBanner(null);
    try {
      await opsAiRuntimeApi.deleteModel(m.id);
      reload();
      say(true, `'${m.name}'을(를) 삭제했어요.`);
    } catch (e) {
      say(false, errorDetail(e, '삭제에 실패했어요.'));
    } finally {
      setBusy(false);
    }
  };

  const saveModel = async (body: AiRuntimeModelBody) => {
    setBusy(true);
    setBanner(null);
    try {
      if (modal?.mode === 'edit') await opsAiRuntimeApi.updateModel(modal.m.id, body);
      else await opsAiRuntimeApi.createModel(body);
      setModal(null);
      reload();
      say(true, modal?.mode === 'edit' ? '모델을 수정했어요.' : '모델을 추가했어요.');
    } catch (e) {
      say(false, errorDetail(e, '저장에 실패했어요.'));
    } finally {
      setBusy(false);
    }
  };

  if (loadErr) {
    return (
      <div className="op-form-err ops-set-banner">
        <i className="ph-fill ph-warning-circle" /> {loadErr}
        <button className="op-btn op-btn--reject" onClick={reload}>
          다시 시도
        </button>
      </div>
    );
  }
  if (!rt) return <div className="ops-set-desc">불러오는 중…</div>;

  const models = rt.models;
  const enabledCount = models.filter((m) => m.enabled).length;

  // 슬롯 셀렉트 옵션 — 켜진 모델만 후보. 현재 배정이 꺼진 모델이면 그 값도 유지해 보여준다.
  const slotOptions = (current: string | null) => {
    const opts = models.filter((m) => m.enabled);
    if (current && !opts.some((m) => m.id === current)) {
      const cur = models.find((m) => m.id === current);
      if (cur) opts.unshift(cur);
    }
    return opts;
  };

  return (
    <section className="ops-air">
      <div className="ops-set-head">
        <h2>
          <i className="ph-fill ph-cpu" /> AI 모델 선택
        </h2>
        <button className="op-btn op-btn--approve" onClick={() => setModal({ mode: 'add' })} disabled={busy}>
          <i className="ph-bold ph-plus" /> 모델 추가
        </button>
      </div>
      <p className="ops-set-desc">
        <b>① 아래에서 쓸 모델을 추가</b>하고 <b>② 생성·검증 역할에 배정</b>하면 돼요. 아직 아무것도
        안 골랐으면 기본 모델(<code>{rt.fallback_model}</code>)로 자동 동작해요.
      </p>
      <details className="ops-air-help">
        <summary>
          <i className="ph-bold ph-info" /> 더 알아보기 — 두 역할·회사·교차 검증
        </summary>
        <ul>
          <li>
            <b>생성</b>은 문항을 만드는 AI, <b>검증</b>은 그 문항을 봇처럼 풀어보는 AI예요. 생성은
            Claude, 검증은 GPT처럼 <b>다른 회사</b>를 쓰면 교차로 검증돼 더 독립적이에요.
          </li>
          <li>
            <b>Anthropic(Claude)</b>은 Anthropic 키로, <b>OpenAI(GPT)</b>는 OpenAI 키로 실제
            호출돼요 — 회사에 따라 API가 갈려요(GPT를 쓰려면 OpenAI 키가 필요해요).
          </li>
          <li>
            역할을 <b>비워 두면</b> 기본 모델(<code>{rt.fallback_model}</code>)이 자동으로 쓰여요.
          </li>
        </ul>
      </details>

      {banner && (
        <div className={`ops-set-banner ${banner.ok ? 'ops-set-banner--ok' : 'op-form-err'}`}>
          <i className={`ph-fill ${banner.ok ? 'ph-check-circle' : 'ph-warning-circle'}`} /> {banner.text}
        </div>
      )}

      {/* 2슬롯 배정 */}
      <div className="ops-air-steplabel">
        <span className="ops-air-stepno">②</span> 각 역할에 모델 배정
        <span className="ops-air-stephint">— 아래 ①에서 등록한 모델을 고르세요</span>
      </div>
      <div className="ops-air-slots">
        {(['generate', 'verify'] as const).map((slot) => (
          <div key={slot} className="ops-air-slot">
            <div className="ops-air-slot-h">
              <i className={`ph-fill ${slot === 'generate' ? 'ph-magic-wand' : 'ph-shield-check'}`} />
              <b>{slot === 'generate' ? '생성 모델' : '검증 모델'}</b>
            </div>
            <p className="ops-air-slot-desc">
              {slot === 'generate'
                ? '강의 자막에서 확인 문항을 만드는 모델'
                : '만든 문항을 봇으로 풀어 봇저항을 판정하는 모델'}
            </p>
            <select
              className="ops-air-select"
              value={rt.slots[slot] ?? ''}
              onChange={(e) => setSlot(slot, e.target.value)}
              disabled={busy}
            >
              <option value="">기본 모델 사용 ({rt.fallback_model})</option>
              {slotOptions(rt.slots[slot]).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.model_id}
                  {m.enabled ? '' : ' (꺼짐)'}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* 자동 스왑 */}
      <label className={`ops-air-swap${busy ? ' ops-air-swap--busy' : ''}`}>
        <input type="checkbox" checked={rt.auto_swap} onChange={toggleSwap} disabled={busy} />
        <span>
          <b>자동 스왑</b> <span className="ops-air-reco">권장</span> — 지정한 모델이 꺼지거나
          실패하면 다른 켜진 모델로 자동 대체해 문항 생성이 멈추지 않아요. 끄면 지정한 모델만 써요.
        </span>
      </label>

      {/* 등록 모델 표 */}
      <div className="ops-air-steplabel">
        <span className="ops-air-stepno">①</span> 사용할 모델 등록
        <span className="ops-air-stephint">— 위 ‘모델 추가’ 버튼으로 추가하세요</span>
      </div>
      <div className="ops-air-tablewrap">
        {models.length === 0 ? (
          <p className="ops-air-empty">
            <i className="ph-bold ph-arrow-up" /> 아직 등록된 모델이 없어요. 위 <b>모델 추가</b>{' '}
            버튼으로 쓸 모델을 먼저 등록하세요. 등록 전에는 기본 모델(
            <code>{rt.fallback_model}</code>)이 자동으로 쓰여요.
          </p>
        ) : (
          <table className="ops-air-table">
            <thead>
              <tr>
                <th>모델</th>
                <th>사용</th>
                <th>단가 (in/out, $/1M)</th>
                <th>누적 토큰 (in/out)</th>
                <th>추정 비용 (₩)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => {
                const asGen = rt.slots.generate === m.id;
                const asVer = rt.slots.verify === m.id;
                return (
                  <tr key={m.id}>
                    <td>
                      <div className="ops-air-mname">
                        {m.name}
                        {asGen && <span className="ops-air-badge ops-air-badge--gen">생성</span>}
                        {asVer && <span className="ops-air-badge ops-air-badge--ver">검증</span>}
                      </div>
                      <div className="ops-air-mid">
                        {m.provider} · {m.model_id}
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`ops-air-toggle${m.enabled ? ' ops-air-toggle--on' : ''}`}
                        onClick={() => toggleEnabled(m)}
                        disabled={busy}
                        title={m.enabled ? '켜짐 — 눌러서 끄기' : '꺼짐 — 눌러서 켜기'}
                      >
                        <span className="ops-air-toggle-dot" />
                        {m.enabled ? 'On' : 'Off'}
                      </button>
                    </td>
                    <td className="ops-air-num">
                      {usd(m.cost_in_usd)} / {usd(m.cost_out_usd)}
                    </td>
                    <td className="ops-air-num">
                      {num(m.tokens_in)} / {num(m.tokens_out)}
                    </td>
                    <td className="ops-air-num">{fmtKrw(m.est_cost_usd)}</td>
                    <td className="ops-air-actions">
                      <button className="op-iconbtn" title="수정" onClick={() => setModal({ mode: 'edit', m })} disabled={busy}>
                        <i className="ph-bold ph-pencil-simple" />
                      </button>
                      <button className="op-iconbtn op-iconbtn--danger" title="삭제" onClick={() => remove(m)} disabled={busy}>
                        <i className="ph-bold ph-trash" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {models.length > 0 && enabledCount === 0 && (
          <p className="ops-air-warn">
            <i className="ph-fill ph-warning" /> 켜진 모델이 하나도 없어요 — 슬롯 배정과 관계없이
            안전망 모델이 쓰여요.
          </p>
        )}
      </div>

      {modal && (
        <ModelModal
          initial={modal.mode === 'edit' ? modal.m : null}
          saving={busy}
          onClose={() => setModal(null)}
          onSave={saveModel}
        />
      )}
    </section>
  );
}
