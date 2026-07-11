import { useEffect, useMemo, useState } from 'react';
import { parseServerDate } from '../../utils/format';
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
  const [rotated, setRotated] = useState<{ site_key: string; secret_key: string } | null>(null);
  const [openSnippet, setOpenSnippet] = useState<string | null>(null);
  const [openGuide, setOpenGuide] = useState<string | null>(null); // 키별 '사용 방법' 패널
  const reveal = issued ?? rotated; // secret 1회 노출 모달 공용(발급·재발급)

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
  const subjectUsage = ent?.subject_usage ?? {};
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

  const onRotate = (k: OrgApiKey) => {
    if (!window.confirm(`'${k.label || k.site_key}'의 secret_key를 재발급할까요? 기존 secret은 즉시 무효가 돼요.`))
      return;
    orgApi
      .rotateSecret(orgId, k.id)
      .then((res) => {
        setRotated({ site_key: res.site_key, secret_key: res.secret_key });
        flash('secret_key를 재발급했어요. 지금만 볼 수 있어요.');
      })
      .catch((err) => flash(errMsg(err, '재발급에 실패했어요.')));
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

  // 고객 서버가 secret_key로 최종 통과 검증(브라우저가 넘긴 verdict_token이 진짜 통과인지). 1회용.
  const validateSnippet = (k: OrgApiKey) =>
    `curl -X POST ${API_BASE}/captcha/v1/validate \\\n  -H "X-Secret-Key: 발급받은_SECRET_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"verdict_token":"<위젯이 폼에 넣어준 값>"}'\n# 응답 {"ok": true} 면 통과, false 면 거부. site_key(${k.site_key})는 공개, secret_key는 서버에서만.`;

  // 위젯 없이 REST로 직접: 문제발급 → 채점(verdict) → 서버 최종검증
  const restSnippet = (k: OrgApiKey) => {
    const subjQ = k.product === 'edu' && k.subject ? `?subject=${encodeURIComponent(k.subject)}` : '';
    return (
      `# 1) 문제 발급 (브라우저/앱)\n` +
      `curl -X POST "${API_BASE}/captcha/v1/challenge${subjQ}" -H "X-Site-Key: ${k.site_key}"\n\n` +
      `# 2) 사용자의 답 채점 → verdict_token 수령\n` +
      `curl -X POST ${API_BASE}/captcha/v1/verify -H "X-Site-Key: ${k.site_key}" \\\n` +
      `  -H "Content-Type: application/json" \\\n  -d '{"challenge_token":"1단계 응답의 토큰","answer":"사용자 입력"}'\n\n` +
      `# 3) 고객 서버에서 최종 검증 (secret_key)\n` +
      `curl -X POST ${API_BASE}/captcha/v1/validate -H "X-Secret-Key: 발급받은_SECRET_KEY" \\\n` +
      `  -H "Content-Type: application/json" \\\n  -d '{"verdict_token":"2단계 응답의 토큰"}'`
    );
  };

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
            <span className="oa-sum-lb">구매 과목 · 이번 달 호출</span>
            <span className="oa-sum-v">
              {eduSubjects.length ? (
                eduSubjects.map((s) => (
                  <span key={s} className="oa-subchip">
                    {s}
                    {subjectUsage[s] ? <b className="oa-subchip-n">{subjectUsage[s].toLocaleString('ko-KR')}</b> : null}
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
                      발급 {k.created_at ? parseServerDate(k.created_at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-'}
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
                  <span>이번 달 호출: {k.usage_month.toLocaleString('ko-KR')}회</span>
                  <span>
                    마지막 사용:{' '}
                    {k.last_used_at ? parseServerDate(k.last_used_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '없음'}
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

                {openGuide === k.id && (
                  <div className="ak-guide">
                    <div className="ak-guide-intro">
                      <i className="ph-fill ph-book-open" />
                      {k.product === 'edu'
                        ? '교육형 API는 아이가 문제를 푸는 동안 행동데이터를 모으는 API예요. 가장 쉬운 방법은 아래 임베드 코드를 붙이는 거예요.'
                        : '가장 쉬운 방법은 아래 임베드 코드를 홈페이지에 붙이는 거예요. 위젯이 사람 확인을 처리하고, 통과 토큰을 폼에 넣어줘요.'}
                    </div>

                    <div className="ak-guide-step">
                      <span className="ak-guide-badge">1</span>
                      <span className="ak-guide-t">임베드 (HTML에 붙여넣기 — 가장 쉬움)</span>
                    </div>
                    <pre className="ak-snippet-pre">{snippetFor(k)}</pre>
                    <button className="ak-copy ak-copy--wide" onClick={() => copy(snippetFor(k), '임베드 코드를 복사했어요.')}>
                      <i className="ph-bold ph-copy" /> 임베드 코드 복사
                    </button>

                    <div className="ak-guide-step">
                      <span className="ak-guide-badge">2</span>
                      <span className="ak-guide-t">서버에서 최종 검증 (secret_key · 위조 방지)</span>
                    </div>
                    <pre className="ak-snippet-pre">{validateSnippet(k)}</pre>
                    <button className="ak-copy ak-copy--wide" onClick={() => copy(validateSnippet(k), '검증 예시를 복사했어요.')}>
                      <i className="ph-bold ph-copy" /> 검증 예시 복사
                    </button>

                    <div className="ak-guide-step">
                      <span className="ak-guide-badge">3</span>
                      <span className="ak-guide-t">위젯 없이 직접 호출 (REST · 앱/서버용)</span>
                    </div>
                    <pre className="ak-snippet-pre">{restSnippet(k)}</pre>
                    <button className="ak-copy ak-copy--wide" onClick={() => copy(restSnippet(k), 'REST 예시를 복사했어요.')}>
                      <i className="ph-bold ph-copy" /> REST 예시 복사
                    </button>

                    <div className="ak-guide-note">
                      <i className="ph-fill ph-info" />
                      <span>
                        <b>site_key</b>는 공개(브라우저·위젯)용, <b>secret_key</b>는 절대 노출 금지(서버에서만).
                        허용 도메인을 지정했다면 그 도메인에서만 동작해요.
                        {k.product === 'edu' && ' 이 키는 과목 ' + (k.subject || '') + ' 문제를 냅니다.'}
                      </span>
                    </div>
                  </div>
                )}

                <div className="op-card-actions">
                  <button
                    type="button"
                    className="op-btn op-btn--reject"
                    onClick={() => setOpenGuide(openGuide === k.id ? null : k.id)}
                  >
                    <i className="ph-bold ph-book-open" />
                    {openGuide === k.id ? '사용 방법 닫기' : '사용 방법'}
                  </button>
                  <button
                    type="button"
                    className="op-btn op-btn--reject"
                    onClick={() => setOpenSnippet(on ? null : k.id)}
                  >
                    <i className="ph-bold ph-code" />
                    {on ? '코드 닫기' : '임베드 코드'}
                  </button>
                  {k.status === 'active' && (
                    <button type="button" className="op-btn op-btn--reject" onClick={() => onRotate(k)}>
                      <i className="ph-bold ph-arrows-clockwise" />
                      secret 재발급
                    </button>
                  )}
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

      {/* secret 1회 노출 모달 (발급·재발급 공용) */}
      {reveal && (
        <div
          className="ak-modal-back"
          onClick={() => {
            setIssued(null);
            setRotated(null);
          }}
        >
          <div className="ak-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ak-modal-ic">
              <i className="ph-fill ph-check-circle" />
            </div>
            <h2 className="ak-modal-title">
              {issued ? 'API 키가 발급됐어요' : 'secret_key를 재발급했어요'}
            </h2>
            <p className="ak-modal-warn">
              <i className="ph-fill ph-warning" /> <strong>secret_key는 지금만 표시</strong>돼요. 창을
              닫으면 다시 볼 수 없으니 안전한 곳에 복사해 두세요.
            </p>

            <div className="ak-modal-field">
              <span className="ak-keyline-k">site_key (공개 · 위젯에 사용)</span>
              <div className="ak-modal-val">
                <code className="ak-mono">{reveal.site_key}</code>
                <button className="ak-copy" onClick={() => copy(reveal.site_key, 'site_key 복사됨')}>
                  <i className="ph-bold ph-copy" /> 복사
                </button>
              </div>
            </div>

            <div className="ak-modal-field">
              <span className="ak-keyline-k ak-keyline-k--secret">secret_key (비공개 · 서버 검증용)</span>
              <div className="ak-modal-val ak-modal-val--secret">
                <code className="ak-mono">{reveal.secret_key}</code>
                <button className="ak-copy" onClick={() => copy(reveal.secret_key, 'secret_key 복사됨')}>
                  <i className="ph-bold ph-copy" /> 복사
                </button>
              </div>
            </div>

            <button
              className="op-btn op-btn--approve ak-modal-done"
              onClick={() => {
                setIssued(null);
                setRotated(null);
              }}
            >
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
