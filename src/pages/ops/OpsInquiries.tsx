import { useEffect, useState } from 'react';
import { opsApi, type OpsInquiry } from '../../api/ops';
import OpsNav from '../../components/ops/OpsNav';
import './OpsApproval.css';

type Tab = 'received' | 'resolved' | 'all';
const TAB_LABEL: Record<Tab, string> = {
  received: '미처리',
  resolved: '처리 완료',
  all: '전체',
};

function fmt(ts: string | null): string {
  if (!ts) return '-';
  return ts.replace('T', ' ').slice(0, 16);
}

const PAGE_SIZE = 50;

export default function OpsInquiries() {
  const [rows, setRows] = useState<OpsInquiry[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [tab, setTab] = useState<Tab>('received');
  const [busy, setBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [toast, setToast] = useState('');
  // 서버 페이지네이션·검색 — 문의는 단조 증가 테이블이라 전량 로드하지 않는다
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ received: 0, resolved: 0, all: 0 });

  const load = () => {
    setState('loading');
    opsApi
      .inquiries({
        ...(tab !== 'all' ? { status_filter: tab } : {}),
        ...(search ? { search } : {}),
        page,
        page_size: PAGE_SIZE,
      })
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
        setCounts(d.counts ?? { received: 0, resolved: 0, all: 0 });
        setState('ready');
      })
      .catch(() => setState('error'));
  };
  // 탭/검색/페이지가 바뀌면 재조회
  useEffect(load, [tab, search, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = rows;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const resolve = async (id: string) => {
    if (!window.confirm('답변을 보내지 않고 처리 완료로 표시할까요? 문의자에게는 아무 회신도 가지 않아요.')) return;
    setBusy(id);
    try {
      await opsApi.resolveInquiry(id);
      setToast('답변 없이 처리 완료로 표시했어요.');
      load();
    } catch {
      setToast('처리에 실패했어요. 다시 시도해 주세요.');
    } finally {
      setBusy(null);
      setTimeout(() => setToast(''), 2200);
    }
  };

  const sendAnswer = async (id: string) => {
    const answer = (drafts[id] ?? '').trim();
    if (!answer) {
      setToast('답변 내용을 입력해 주세요.');
      setTimeout(() => setToast(''), 2200);
      return;
    }
    setBusy(id);
    try {
      const r = await opsApi.answerInquiry(id, answer);
      setDrafts((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
      // email_status로 실제 발송/미발송(dry-run)/실패를 구분해 안내
      setToast(
        r.email_status === 'sent'
          ? '답변을 이메일로 보냈어요.'
          : r.email_status === 'dry_run'
            ? '답변을 저장했어요. (SMTP 미설정 — 메일은 발송되지 않음)'
            : '답변을 저장했어요. (메일 발송 실패)',
      );
      load();
    } catch {
      setToast('답변 전송에 실패했어요. 다시 시도해 주세요.');
    } finally {
      setBusy(null);
      setTimeout(() => setToast(''), 2600);
    }
  };

  return (
    <div className="op-root">
      <OpsNav />
      <main className="op-main">
        <div className="op-head">
          <div>
            <h1 className="op-title">문의 관리</h1>
            <p className="op-sub">
              문의하기로 접수된 요청이에요. 미처리 <b>{counts.received}</b>건.
            </p>
          </div>
          <button className="op-refresh" onClick={load}>
            <i className="ph-bold ph-arrows-clockwise" />
            새로고침
          </button>
        </div>

        <div className="op-tabs">
          {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
            <button
              key={t}
              className={`op-tab${tab === t ? ' op-tab--on' : ''}`}
              onClick={() => {
                setTab(t);
                setPage(1);
              }}
            >
              {TAB_LABEL[t]}
              <span className="op-tab-count">{counts[t]}</span>
            </button>
          ))}
        </div>

        <div className="op-inqsearch">
          <i className="ph-bold ph-magnifying-glass" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setSearch(searchInput.trim());
                setPage(1);
              }
            }}
            placeholder="이름·이메일·소속·내용 검색 후 Enter"
          />
          {search && (
            <button
              className="op-inqsearch-x"
              onClick={() => {
                setSearch('');
                setSearchInput('');
                setPage(1);
              }}
            >
              <i className="ph-bold ph-x" /> 해제
            </button>
          )}
          <span className="op-inqsearch-total">{total.toLocaleString()}건</span>
        </div>

        {state === 'loading' && <div className="op-empty"><i className="ph-duotone ph-spinner" /><p>불러오는 중…</p></div>}
        {state === 'error' && (
          <div className="op-empty"><i className="ph-duotone ph-warning" /><p>문의를 불러오지 못했어요.</p></div>
        )}
        {state === 'ready' && list.length === 0 && (
          <div className="op-empty">
            <i className="ph-duotone ph-tray" />
            <p>{tab === 'received' ? '미처리 문의가 없어요.' : `${TAB_LABEL[tab]} 문의가 없어요.`}</p>
          </div>
        )}

        {state === 'ready' && list.length > 0 && (
          <div className="op-list">
            {list.map((q) => (
              <div key={q.id} className="op-card">
                <div className="op-card-top">
                  <span className="op-card-ic op-card-ic--inq"><i className="ph-fill ph-chat-circle-dots" /></span>
                  <div className="op-card-main">
                    <div className="op-card-name">
                      {q.name}
                      <span className="op-card-type">{q.inquiry_type}</span>
                    </div>
                    <div className="op-card-code">{q.affiliation || '소속 미기재'} · {fmt(q.created_at)}</div>
                  </div>
                  <span className={`op-status op-status--${q.status === 'resolved' ? 'approved' : 'pending'}`}>
                    {q.status === 'resolved' ? '처리됨' : '미처리'}
                  </span>
                </div>

                <div className="op-inq-body">{q.content}</div>

                {/* 보낸 답변 스레드 — 확인 후 여러 번 답변한 이력을 시간순으로 표시 */}
                {q.replies.length > 0 && (
                  <div className="op-inq-thread">
                    {q.replies.map((rep, idx) => (
                      <div key={rep.id} className="op-inq-answer">
                        <div className="op-inq-answer-h">
                          <i className="ph-fill ph-paper-plane-tilt" />
                          {q.replies.length > 1 ? `답변 #${idx + 1}` : '보낸 답변'} · {fmt(rep.created_at)}
                          {rep.email_status === 'dry_run' && (
                            <span className="op-inq-tag">메일 미발송(SMTP 미설정)</span>
                          )}
                          {rep.email_status === 'failed' && (
                            <span className="op-inq-tag op-inq-tag--fail">메일 발송 실패</span>
                          )}
                        </div>
                        <div className="op-inq-answer-b">{rep.body}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 확인 후 추가 답변 가능 — 입력창은 항상 열려 있음 */}
                <div className="op-inq-reply">
                  <textarea
                    className="op-inq-textarea"
                    rows={3}
                    value={drafts[q.id] ?? ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                    placeholder={
                      q.replies.length > 0
                        ? `${q.email} 주소로 추가 답변을 보낼 수 있어요`
                        : `${q.email} 주소로 보낼 답변을 작성해 주세요`
                    }
                  />
                  <div className="op-inq-reply-actions">
                    {q.status === 'received' && q.replies.length === 0 && (
                      <button
                        className="op-btn op-btn--reject"
                        disabled={busy === q.id}
                        onClick={() => resolve(q.id)}
                      >
                        답변 없이 완료
                      </button>
                    )}
                    <button
                      className="op-btn op-btn--approve"
                      disabled={busy === q.id}
                      onClick={() => sendAnswer(q.id)}
                    >
                      <i className="ph-fill ph-paper-plane-tilt" />
                      {q.replies.length > 0 ? '추가 답변 보내기' : '답변 보내기'}
                    </button>
                  </div>
                </div>

                <div className="op-inq-foot">
                  <a href={`mailto:${q.email}`} className="op-inq-email">
                    <i className="ph-fill ph-envelope-simple" />
                    {q.email}
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {state === 'ready' && (total > PAGE_SIZE || page > 1) && (
          <div className="op-logpage">
            <span className="op-pageinfo">{page} / {totalPages} 페이지 · {total.toLocaleString()}건</span>
            <div className="op-pagebtns">
              <button className="op-pagebtn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <i className="ph-bold ph-caret-left" />이전
              </button>
              <button className="op-pagebtn" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                다음<i className="ph-bold ph-caret-right" />
              </button>
            </div>
          </div>
        )}
      </main>

      {toast && <div className="op-toast"><i className="ph-fill ph-check-circle" />{toast}</div>}
    </div>
  );
}
