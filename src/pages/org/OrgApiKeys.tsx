import { useEffect, useMemo, useState } from 'react';
import OrgLayout from '../../layouts/OrgLayout';
import { useAuth } from '../../hooks/useAuth';
import {
  orgApi,
  type OrgApiEntitlements,
  type OrgApiKey,
  type OrgIssuedKey,
} from '../../api/org';
import '../ops/OpsApproval.css'; // 공통 op- 시스템 (버튼·카드·토스트·상태칩)
import '../ops/OpsApiKeys.css'; // ak- (발급폼·키라인·secret 모달)
import './OrgApiKeys.css'; // oa- (기관 전용 소량)

/* eslint-disable @typescript-eslint/no-explicit-any */

const API_BASE = `${
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000'
}/api/v1`;

const PRODUCT_META: Record<string, { icon: string; cls: string; blurb: string }> = {
  captcha: { icon: 'ph-shield-check', cls: 'captcha', blurb: '봇 차단 · 사람 확인 (통과/실패)' },
  edu: { icon: 'ph-brain', cls: 'edu', blurb: '학습형 문제 캡차 (과목별 문제 출제)' },
};

function errMsg(e: unknown, fallback: string): string {
  const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return detail || fallback;
}

export default function OrgApiKeys() {
  const { me } = useAuth();
  const orgId = me?.organization_id ?? '';

  const [ent, setEnt] = useState<OrgApiEntitlements | null>(null);
  const [keys, setKeys] = useState<OrgApiKey[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [toast, setToast] = useState<string | null>(null);

  const [product, setProduct] = useState('captcha');
  const [subject, setSubject] = useState('');
  const [label, setLabel] = useState('');
  const [domain, setDomain] = useState('');
  const [issuing, setIssuing] = useState(false);

  const [issued, setIssued] = useState<OrgIssuedKey | null>(null);
  const [openSnippet, setOpenSnippet] = useState<string | null>(null);

  const load = () => {
    if (!orgId) return;
    setState('loading');
    Promise.all([orgApi.apiEntitlements(orgId), orgApi.apiKeys(orgId)])
      .then(([e, k]) => {
        setEnt(e);
        setKeys(Array.isArray(k) ? k : []);
        // 기본 제품을 발급 가능한 것으로
        setProduct((p) => (e.products.includes(p) ? p : e.products[0] ?? 'captcha'));
        setState('ready');
      })
      .catch(() => setState('error'));
  };
  useEffect(load, [orgId]);

  const flash = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2600);
  };

  const eduSubjects = ent?.edu_subjects ?? [];
  const canIssueEdu = (ent?.products ?? []).includes('edu');
  const usage = ent?.usage ?? { used: 0, quota: 0 };
  const usagePct = usage.quota ? Math.min(100, Math.round((usage.used / usage.quota) * 100)) : 0;

  const onIssue = (e: React.FormEvent) => {
    e.preventDefault();
    if (product === 'edu') {
      if (!canIssueEdu) return flash('교육형 API는 현재 요금제로 발급할 수 없어요.');
      if (!subject) return flash('교육형 API는 과목을 선택해야 해요.');
      if (!eduSubjects.includes(subject)) return flash(`'${subject}' 과목은 아직 구매하지 않았어요.`);
    }
    setIssuing(true);
    orgApi
      .issueApiKey(orgId, {
        product,
        subject: product === 'edu' ? subject : undefined,
        label: label.trim() || undefined,
        domain: domain.trim() || undefined,
      })
      .then((res) => {
        setIssued(res);
        setLabel('');
        setDomain('');
        flash('API 키를 발급했어요. secret_key는 지금만 볼 수 있어요.');
        orgApi.apiKeys(orgId).then((k) => setKeys(Array.isArray(k) ? k : []));
      })
      .catch((err) => flash(errMsg(err, '발급에 실패했어요.')))
      .finally(() => setIssuing(false));
  };

  const onRevoke = (k: OrgApiKey) => {
    if (!window.confirm(`'${k.label || k.site_key}' 키를 정말 중지할까요? 즉시 사용이 중단돼요.`)) return;
    orgApi
      .revokeApiKey(orgId, k.id)
      .then(() => {
        flash('키를 중지했어요.');
        setKeys((prev) => prev.map((x) => (x.id === k.id ? { ...x, status: 'disabled' } : x)));
      })
      .catch((err) => flash(errMsg(err, '중지에 실패했어요.')));
  };

  const copy = (text: string, msg: string) => {
    navigator.clipboard?.writeText(text).then(
      () => flash(msg),
      () => flash('복사에 실패했어요. 직접 선택해 복사해 주세요.'),
    );
  };

  const snippetFor = (k: OrgApiKey) =>
    `<div class="catchap"\n     data-site-key="${k.site_key}"\n     data-api="${API_BASE}"${
      k.product === 'edu' ? '\n     data-size="full"' : ''
    }></div>\n<script src="${API_BASE}/widget/catchap-widget.js" defer></script>`;

  const activeCount = keys.filter((k) => k.status === 'active').length;
  const productOptions = useMemo(() => ent?.products ?? ['captcha'], [ent]);

  return (
    <OrgLayout active="apikeys" widget="pro">
      <div className="op-head oa-head">
        <div>
          <h1 className="op-title">API 키 발급 · 관리</h1>
          <p className="op-sub">
            우리 기관이 구매한 캡차·교육형 API 키를 발급하고 홈페이지·앱에 붙일 수 있어요 · 사용 중{' '}
            {activeCount}개
          </p>
        </div>
        <button className="op-refresh" onClick={load}>
          <i className="ph-bold ph-arrows-clockwise" />
          새로고침
        </button>
      </div>

      {/* 구매 범위 + 사용량 */}
      {ent && (
        <div className="oa-summary">
          <div className="oa-sum-card">
            <span className="oa-sum-lb">요금제</span>
            <span className="oa-sum-v">{ent.plan}</span>
          </div>
          <div className="oa-sum-card">
            <span className="oa-sum-lb">사용 가능 제품</span>
            <span className="oa-sum-v">
              {ent.products.map((p) => ent.product_names?.[p] ?? p).join(' · ')}
            </span>
          </div>
          <div className="oa-sum-card">
            <span className="oa-sum-lb">구매한 교육형 과목</span>
            <span className="oa-sum-v">
              {eduSubjects.length ? (
                eduSubjects.map((s) => (
                  <span key={s} className="oa-subchip">
                    {s}
                  </span>
                ))
              ) : (
                <span className="oa-none">없음 (운영자에게 문의)</span>
              )}
            </span>
          </div>
          <div className="oa-sum-card oa-sum-card--usage">
            <span className="oa-sum-lb">이번 달 호출</span>
            <span className="oa-sum-v">
              {usage.used.toLocaleString('ko-KR')}
              {usage.quota ? ` / ${usage.quota.toLocaleString('ko-KR')}` : ''}
            </span>
            {usage.quota > 0 && (
              <span className="oa-usebar">
                <span className="oa-usebar-fill" style={{ width: `${usagePct}%` }} />
              </span>
            )}
          </div>
        </div>
      )}

      {/* 발급 폼 */}
      <form className="op-card ak-form" onSubmit={onIssue}>
        <div className="ak-form-title">
          <i className="ph-fill ph-key" /> 새 API 키 발급
        </div>

        <div className="ak-grid">
          <label className="ak-field">
            <span className="ak-label">제품</span>
            <select className="ak-select" value={product} onChange={(e) => setProduct(e.target.value)}>
              {productOptions.map((p) => (
                <option key={p} value={p}>
                  {ent?.product_names?.[p] ?? p}
                </option>
              ))}
            </select>
            <span className="ak-hint">{PRODUCT_META[product]?.blurb}</span>
          </label>

          {product === 'edu' && (
            <label className="ak-field">
              <span className="ak-label">과목</span>
              <select
                className="ak-select"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              >
                <option value="">과목을 선택하세요</option>
                {eduSubjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <span className="ak-hint">구매한 과목만 발급할 수 있어요.</span>
            </label>
          )}

          <label className="ak-field">
            <span className="ak-label">
              라벨 <span className="ak-opt">선택</span>
            </span>
            <input
              className="ak-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="예: 학교 홈페이지, 학습 게임 상단"
            />
          </label>

          <label className="ak-field">
            <span className="ak-label">
              허용 도메인 <span className="ak-opt">선택</span>
            </span>
            <input
              className="ak-input"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="예: our-school.kr"
            />
            <span className="ak-hint">지정하면 그 도메인에서만 동작해요. 비우면 모든 도메인 허용(테스트용)</span>
          </label>
        </div>

        <div className="ak-form-actions">
          <button
            type="submit"
            className="op-btn op-btn--approve"
            disabled={issuing || (product === 'edu' && !canIssueEdu)}
          >
            <i className="ph-bold ph-plus-circle" />
            {issuing ? '발급 중…' : 'API 키 발급'}
          </button>
        </div>
      </form>

      {/* 목록 */}
      <div className="ak-list-head">발급된 키</div>

      {state === 'loading' && (
        <div className="op-empty">
          <p>불러오는 중…</p>
        </div>
      )}
      {state === 'error' && (
        <div className="op-empty">
          <i className="ph-fill ph-warning-circle" />
          <p>목록을 불러오지 못했어요. 새로고침해 주세요.</p>
        </div>
      )}
      {state === 'ready' && keys.length === 0 && (
        <div className="op-empty">
          <i className="ph-fill ph-key" />
          <p>아직 발급한 API 키가 없어요. 위에서 첫 키를 발급해 보세요.</p>
        </div>
      )}

      <div className="op-list">
        {state === 'ready' &&
          keys.map((k) => {
            const m = PRODUCT_META[k.product] ?? { icon: 'ph-cube', cls: 'captcha', blurb: '' };
            const on = openSnippet === k.id;
            return (
              <div key={k.id} className="op-card ak-key">
                <div className="op-card-top">
                  <span className={`op-card-ic ak-key-ic--${m.cls}`}>
                    <i className={`ph-fill ${m.icon}`} />
                  </span>
                  <div className="op-card-main">
                    <div className="op-card-name">
                      {k.label || k.product_name}
                      <span className="op-card-type">{k.product_name}</span>
                      {k.subject && <span className="ak-subject">{k.subject}</span>}
                    </div>
                    <div className="op-card-code">
                      발급 {k.created_at ? new Date(k.created_at).toLocaleDateString('ko-KR') : '-'}
                    </div>
                  </div>
                  <span
                    className={`op-status op-status--${k.status === 'active' ? 'approved' : 'rejected'}`}
                  >
                    {k.status === 'active' ? '사용 중' : '중지됨'}
                  </span>
                </div>

                <div className="ak-keyline">
                  <span className="ak-keyline-k">site_key</span>
                  <code className="ak-mono">{k.site_key}</code>
                  <button
                    type="button"
                    className="ak-copy"
                    onClick={() => copy(k.site_key, 'site_key를 복사했어요.')}
                  >
                    <i className="ph-bold ph-copy" /> 복사
                  </button>
                </div>

                <div className="ak-key-meta">
                  <span>
                    마지막 사용:{' '}
                    {k.last_used_at ? new Date(k.last_used_at).toLocaleString('ko-KR') : '없음'}
                  </span>
                </div>

                {on && (
                  <div className="ak-snippet">
                    <div className="ak-snippet-h">
                      <i className="ph-bold ph-code" /> 임베드 코드 (HTML에 붙여넣기)
                    </div>
                    <pre className="ak-snippet-pre">{snippetFor(k)}</pre>
                    <button
                      type="button"
                      className="ak-copy ak-copy--wide"
                      onClick={() => copy(snippetFor(k), '임베드 코드를 복사했어요.')}
                    >
                      <i className="ph-bold ph-copy" /> 코드 복사
                    </button>
                  </div>
                )}

                <div className="op-card-actions">
                  <button
                    type="button"
                    className="op-btn op-btn--reject"
                    onClick={() => setOpenSnippet(on ? null : k.id)}
                  >
                    <i className="ph-bold ph-code" />
                    {on ? '코드 닫기' : '임베드 코드'}
                  </button>
                  {k.status === 'active' && (
                    <button type="button" className="op-btn op-btn--reject" onClick={() => onRevoke(k)}>
                      <i className="ph-bold ph-prohibit" />
                      사용 중지
                    </button>
                  )}
                </div>
              </div>
            );
          })}
      </div>

      {/* secret 1회 노출 모달 */}
      {issued && (
        <div className="ak-modal-back" onClick={() => setIssued(null)}>
          <div className="ak-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ak-modal-ic">
              <i className="ph-fill ph-check-circle" />
            </div>
            <h2 className="ak-modal-title">API 키가 발급됐어요</h2>
            <p className="ak-modal-warn">
              <i className="ph-fill ph-warning" /> <strong>secret_key는 지금만 표시</strong>돼요. 창을
              닫으면 다시 볼 수 없으니 안전한 곳에 복사해 두세요.
            </p>

            <div className="ak-modal-field">
              <span className="ak-keyline-k">site_key (공개 · 위젯에 사용)</span>
              <div className="ak-modal-val">
                <code className="ak-mono">{issued.site_key}</code>
                <button className="ak-copy" onClick={() => copy(issued.site_key, 'site_key 복사됨')}>
                  <i className="ph-bold ph-copy" /> 복사
                </button>
              </div>
            </div>

            <div className="ak-modal-field">
              <span className="ak-keyline-k ak-keyline-k--secret">secret_key (비공개 · 서버 검증용)</span>
              <div className="ak-modal-val ak-modal-val--secret">
                <code className="ak-mono">{issued.secret_key}</code>
                <button className="ak-copy" onClick={() => copy(issued.secret_key, 'secret_key 복사됨')}>
                  <i className="ph-bold ph-copy" /> 복사
                </button>
              </div>
            </div>

            <button className="op-btn op-btn--approve ak-modal-done" onClick={() => setIssued(null)}>
              복사했어요, 닫기
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="op-toast">
          <i className="ph-fill ph-check-circle" />
          {toast}
        </div>
      )}
    </OrgLayout>
  );
}
