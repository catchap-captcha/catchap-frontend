import { useEffect, useMemo, useState } from 'react';
import { parseServerDate } from '../../utils/format';
import {
  opsApi,
  type OpsApiKey,
  type OpsIssuedKey,
  type OpsOrg,
  type OpsPlansResponse,
} from '../../api/ops';
import OpsNav from '../../components/ops/OpsNav';
import './OpsApproval.css';
import './OpsApiKeys.css';

/** 위젯 임베드 스니펫이 가리킬 API 베이스 (client.ts와 동일 규칙) */
const API_BASE = `${
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000'
}/api/v1`;

const PRODUCT_META: Record<string, { icon: string; cls: string; blurb: string }> = {
  captcha: { icon: 'ph-shield-check', cls: 'captcha', blurb: '봇 차단 · 사람 확인 (통과/실패)' },
  edu: { icon: 'ph-brain', cls: 'edu', blurb: '학습하며 행동데이터 수집 (반응·조작·재시도)' },
};

function errMsg(e: unknown, fallback: string): string {
  const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return detail || fallback;
}

const PAGE_SIZE = 50;

export default function OpsApiKeys() {
  const [plans, setPlans] = useState<OpsPlansResponse | null>(null);
  const [orgs, setOrgs] = useState<OpsOrg[]>([]);
  const [keys, setKeys] = useState<OpsApiKey[]>([]);
  const [keyPage, setKeyPage] = useState(1);
  const [keyTotal, setKeyTotal] = useState(0);
  const [activeTotal, setActiveTotal] = useState(0); // 전체 활성 키 수(서버 집계 — 페이지 국소값 아님)
  const [filterOrg, setFilterOrg] = useState(''); // 목록 기관 필터
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [toast, setToast] = useState<string | null>(null);

  // 발급 폼
  const [orgId, setOrgId] = useState('');
  const [product, setProduct] = useState('captcha');
  const [subject, setSubject] = useState('');
  const [label, setLabel] = useState('');
  const [domain, setDomain] = useState('');
  const [firstParty, setFirstParty] = useState(false);
  const [issuing, setIssuing] = useState(false);

  // 기관 구매 과목(edu_subjects) 편집 — 판매 프로비저닝
  const [entSubs, setEntSubs] = useState<string[]>([]);
  const [savingEnt, setSavingEnt] = useState(false);

  // 발급 직후 secret 1회 노출 + 임베드 스니펫 펼침
  const [issued, setIssued] = useState<OpsIssuedKey | null>(null);
  const [rotated, setRotated] = useState<{ site_key: string; secret_key: string } | null>(null);
  const [openSnippet, setOpenSnippet] = useState<string | null>(null);
  const reveal = issued ?? rotated; // secret 1회 노출 모달 공용(발급·재발급)

  const load = () => {
    setState('loading');
    Promise.all([
      opsApi.plans(),
      opsApi.orgs(), // 발급 모달 드롭다운용 — 전체 기관 필요(무페이지)
      opsApi.apiKeysPage({ ...(filterOrg ? { organization_id: filterOrg } : {}), page: keyPage, page_size: PAGE_SIZE }),
    ])
      .then(([p, o, k]) => {
        setPlans(p);
        setOrgs(Array.isArray(o) ? o : []);
        setKeys(k.items ?? []);
        setKeyTotal(k.total ?? 0);
        setActiveTotal(k.active_total ?? 0);
        setState('ready');
      })
      .catch(() => setState('error'));
  };
  useEffect(load, [filterOrg, keyPage]); // eslint-disable-line react-hooks/exhaustive-deps

  const flash = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2600);
  };

  // 발급 대상이 될 수 있는 활성 기관
  const activeOrgs = useMemo(() => orgs.filter((o) => o.status === 'active'), [orgs]);
  const selectedOrg = useMemo(() => orgs.find((o) => o.id === orgId) ?? null, [orgs, orgId]);
  useEffect(() => {
    setEntSubs(selectedOrg?.edu_subjects ?? []);
  }, [selectedOrg]);

  const toggleEnt = (s: string) =>
    setEntSubs((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const saveEnt = () => {
    if (!orgId) return;
    setSavingEnt(true);
    opsApi
      .setEntitlements(orgId, entSubs)
      .then((r) => {
        flash('구매 과목을 저장했어요.');
        setOrgs((prev) =>
          prev.map((o) => (o.id === orgId ? { ...o, edu_subjects: r.edu_subjects } : o)),
        );
      })
      .catch((err) => flash(errMsg(err, '저장에 실패했어요.')))
      .finally(() => setSavingEnt(false));
  };

  // 선택 기관의 요금제 → 발급 가능 제품 (마지막 발급 키에서 유추 or plans 매핑은 불가하므로 목록 키로 추정)
  // 실제 게이팅은 백엔드가 402로 판정. 여기선 안내만.
  const orgPlanName = useMemo(() => {
    const k = keys.find((x) => x.organization_id === orgId);
    return k?.plan ?? null;
  }, [keys, orgId]);

  const eduSubjects = plans?.edu_subjects ?? [];

  const onIssue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return flash('발급할 기관을 선택해 주세요.');
    if (product === 'edu' && !subject) return flash('교육형 API는 과목을 선택해야 해요.');
    setIssuing(true);
    opsApi
      .issueApiKey({
        organization_id: orgId,
        product,
        subject: product === 'edu' ? subject : undefined,
        label: label.trim() || undefined,
        domain: domain.trim() || undefined,
        first_party: firstParty,
      })
      .then((res) => {
        setIssued(res);
        setLabel('');
        setDomain('');
        setFirstParty(false);
        flash('API 키를 발급했어요. secret_key는 지금만 볼 수 있어요.');
        // 목록 갱신
        opsApi
          .apiKeysPage({ ...(filterOrg ? { organization_id: filterOrg } : {}), page: keyPage, page_size: PAGE_SIZE })
          .then((k) => {
            setKeys(k.items ?? []);
            setKeyTotal(k.total ?? 0);
            setActiveTotal(k.active_total ?? 0);
          })
          .catch(() => flash('목록 새로고침에 실패했어요 — 발급은 완료됐어요. 새로고침해 주세요.'));
      })
      .catch((err) => flash(errMsg(err, '발급에 실패했어요.')))
      .finally(() => setIssuing(false));
  };

  const onRotate = (k: OpsApiKey) => {
    if (!window.confirm(`'${k.label || k.site_key}'의 secret_key를 재발급할까요? 기존 secret은 즉시 무효가 돼요.`))
      return;
    opsApi
      .rotateSecret(k.id)
      .then((res) => {
        setRotated({ site_key: res.site_key, secret_key: res.secret_key });
        flash('secret_key를 재발급했어요. 지금만 볼 수 있어요.');
      })
      .catch((err) => flash(errMsg(err, '재발급에 실패했어요.')));
  };

  const onRevoke = (k: OpsApiKey) => {
    if (!window.confirm(`'${k.label || k.site_key}' 키를 정말 취소할까요? 즉시 사용이 중단돼요.`)) return;
    opsApi
      .revokeApiKey(k.id)
      .then(() => {
        flash('키를 취소했어요.');
        setKeys((prev) => prev.map((x) => (x.id === k.id ? { ...x, status: 'disabled' } : x)));
      })
      .catch((err) => flash(errMsg(err, '취소에 실패했어요.')));
  };

  const copy = (text: string, msg: string) => {
    navigator.clipboard?.writeText(text).then(
      () => flash(msg),
      () => flash('복사에 실패했어요. 직접 선택해 복사해 주세요.'),
    );
  };

  const snippetFor = (k: OpsApiKey) =>
    `<div class="catchap"\n     data-site-key="${k.site_key}"\n     data-api="${API_BASE}"${
      k.product === 'edu' ? '\n     data-size="full"' : ''
    }></div>\n<script src="${API_BASE}/widget/catchap-widget.js" defer></script>`;

  
  return (
    <div className="op-root">
      <OpsNav />
      <main className="op-main">
        <div className="op-head">
          <div>
            <h1 className="op-title">API 발급 · 관리</h1>
            <p className="op-sub">
              메인 캡차 / 교육형 API 키를 요금제에 맞춰 발급하고, 외부 서비스에 붙일 수 있어요 · 활성 키{' '}
              {activeTotal}개
            </p>
          </div>
          <button className="op-refresh" onClick={load}>
            <i className="ph-bold ph-arrows-clockwise" />
            새로고침
          </button>
        </div>

        {/* 제품 안내 */}
        {plans && (
          <div className="ak-products">
            {Object.entries(plans.products).map(([key, name]) => {
              const m = PRODUCT_META[key] ?? { icon: 'ph-cube', cls: 'captcha', blurb: '' };
              return (
                <div key={key} className={`ak-prod ak-prod--${m.cls}`}>
                  <span className="ak-prod-ic">
                    <i className={`ph-fill ${m.icon}`} />
                  </span>
                  <div>
                    <div className="ak-prod-name">{name}</div>
                    <div className="ak-prod-blurb">{m.blurb}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 발급 폼 */}
        <form className="op-card ak-form" onSubmit={onIssue}>
          <div className="ak-form-title">
            <i className="ph-fill ph-key" /> 새 API 키 발급
          </div>

          <div className="ak-grid">
            <label className="ak-field">
              <span className="ak-label">기관</span>
              <select
                className="ak-select"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                required
              >
                <option value="">기관을 선택하세요</option>
                {activeOrgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.code})
                  </option>
                ))}
              </select>
              {orgPlanName && <span className="ak-hint">현재 요금제: {orgPlanName}</span>}
            </label>

            <label className="ak-field">
              <span className="ak-label">제품</span>
              <select
                className="ak-select"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
              >
                {plans &&
                  Object.entries(plans.products).map(([key, name]) => (
                    <option key={key} value={key}>
                      {name}
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
                placeholder="예: 회원가입 폼, 게임 상단 배너"
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
                placeholder="예: example.com"
              />
              <span className="ak-hint">
                지정하면 그 도메인·서브도메인에서만 동작해요. 비우면 모든 도메인 허용(테스트용)
              </span>
            </label>

            <label className="ak-field ak-field--check">
              <span className="ak-label">키 유형</span>
              <label className="ak-check">
                <input
                  type="checkbox"
                  checked={firstParty}
                  onChange={(e) => setFirstParty(e.target.checked)}
                />
                <span>1st-party (우리 앱 · 과목 전환 허용)</span>
              </label>
              <span className="ak-hint">
                체크하면 한 키로 여러 과목을 전환할 수 있어요(우리 인앱 전용). 외부 판매 키는 체크 해제
                — 발급 과목에 고정돼요.
              </span>
            </label>
          </div>

          {/* 판매 프로비저닝: 이 기관이 구매한 교육형 과목 설정 */}
          {selectedOrg && (
            <div className="ak-ent">
              <div className="ak-ent-head">
                <i className="ph-fill ph-shopping-bag-open" />
                <b>{selectedOrg.name}</b> 구매 교육형 과목
                <span className="ak-hint">기관 관리자는 이 과목만 셀프 발급할 수 있어요.</span>
              </div>
              <div className="ak-ent-chips">
                {eduSubjects.map((s) => {
                  const on = entSubs.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      className={on ? 'ak-entchip ak-entchip--on' : 'ak-entchip'}
                      onClick={() => toggleEnt(s)}
                    >
                      {on && <i className="ph-bold ph-check" />}
                      {s}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className="op-btn op-btn--approve ak-ent-save"
                  onClick={saveEnt}
                  disabled={savingEnt}
                >
                  <i className="ph-bold ph-floppy-disk" />
                  {savingEnt ? '저장 중…' : '구매 과목 저장'}
                </button>
              </div>
            </div>
          )}

          <div className="ak-form-actions">
            <button type="submit" className="op-btn op-btn--approve" disabled={issuing}>
              <i className="ph-bold ph-plus-circle" />
              {issuing ? '발급 중…' : 'API 키 발급'}
            </button>
          </div>
        </form>

        {/* 발급된 키 목록 */}
        <div className="ak-list-head">
          발급된 키
          <select
            className="op-bh-select ak-list-filter"
            value={filterOrg}
            onChange={(e) => {
              setFilterOrg(e.target.value);
              setKeyPage(1);
            }}
            title="기관 필터"
          >
            <option value="">전체 기관</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <span className="ak-list-total">{keyTotal.toLocaleString()}개</span>
        </div>

        {state === 'loading' && <div className="op-empty"><p>불러오는 중…</p></div>}
        {state === 'error' && (
          <div className="op-empty">
            <i className="ph-fill ph-warning-circle" />
            <p>목록을 불러오지 못했어요. 새로고침해 주세요.</p>
          </div>
        )}
        {state === 'ready' && keys.length === 0 && (
          <div className="op-empty">
            <i className="ph-fill ph-key" />
            <p>{filterOrg ? '이 기관에 발급된 키가 없어요.' : '아직 발급된 API 키가 없어요. 위에서 첫 키를 발급해 보세요.'}</p>
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
                        {k.first_party ? (
                          <span className="ak-fp ak-fp--in">1st-party</span>
                        ) : (
                          k.product === 'edu' && <span className="ak-fp ak-fp--ext">외부·과목고정</span>
                        )}
                      </div>
                      <div className="op-card-code">
                        {k.organization_name} · {k.plan}
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
                    <span>
                      발급:{' '}
                      {k.created_at ? parseServerDate(k.created_at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-'}
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
                      <button
                        type="button"
                        className="op-btn op-btn--reject"
                        onClick={() => onRotate(k)}
                      >
                        <i className="ph-bold ph-arrows-clockwise" />
                        secret 재발급
                      </button>
                    )}
                    {k.status === 'active' && (
                      <button
                        type="button"
                        className="op-btn op-btn--reject"
                        onClick={() => onRevoke(k)}
                      >
                        <i className="ph-bold ph-prohibit" />
                        발급 취소
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        {state === 'ready' && keyTotal > PAGE_SIZE && (
          <div className="op-logpage">
            <span className="op-pageinfo">
              {keyPage} / {Math.max(1, Math.ceil(keyTotal / PAGE_SIZE))} 페이지 · {keyTotal.toLocaleString()}개
            </span>
            <div className="op-pagebtns">
              <button className="op-pagebtn" disabled={keyPage <= 1} onClick={() => setKeyPage((v) => Math.max(1, v - 1))}>
                <i className="ph-bold ph-caret-left" />이전
              </button>
              <button
                className="op-pagebtn"
                disabled={keyPage >= Math.ceil(keyTotal / PAGE_SIZE)}
                onClick={() => setKeyPage((v) => v + 1)}
              >
                다음<i className="ph-bold ph-caret-right" />
              </button>
            </div>
          </div>
        )}
      </main>

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
              <i className="ph-fill ph-warning" /> <strong>secret_key는 지금만 표시</strong>돼요.
              창을 닫으면 다시 볼 수 없으니 안전한 곳에 복사해 두세요.
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
                <button
                  className="ak-copy"
                  onClick={() => copy(reveal.secret_key, 'secret_key 복사됨')}
                >
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
    </div>
  );
}
