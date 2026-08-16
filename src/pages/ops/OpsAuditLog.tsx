import { useEffect, useState } from 'react';
import { opsApi, type OpsAuditLog as Row } from '../../api/ops';
import OpsNav from '../../components/ops/OpsNav';
import {
  AUDIT_ACTION_META as ACTION_META,
  auditField,
  AUDIT_TARGET_LABEL as TARGET_LABEL,
  auditValue,
} from '../../constants/auditActions';
import './OpsApproval.css';
import './OpsAuditLog.css';

function fmt(ts: string | null): string {
  if (!ts) return '-';
  return ts.replace('T', ' ').slice(0, 16);
}

const PAGE_SIZE = 50;

export default function OpsAuditLog() {
  const [rows, setRows] = useState<Row[]>([]);
  // 감사 로그는 절대 조작된(가짜) 행을 보여주지 않는다 — 실제 상태만 표시
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  // 문의 답변 미리보기 모달 — '어떤 답변을 보냈는지' 확인
  const [preview, setPreview] = useState<Row | null>(null);
  // 필터 선택지(서버가 감사로그 전체에서 뽑아 준다) + 총 건수
  const [actions, setActions] = useState<string[]>([]);
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  // 필터 상태 — 기관/행동/기간. 필터가 바뀌면 첫 페이지로 되돌린다.
  const [fAction, setFAction] = useState('');
  const [fOrg, setFOrg] = useState('');
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');

  const load = () => {
    setState('loading');
    opsApi
      .logs({
        action: fAction || undefined,
        organization_id: fOrg || undefined,
        date_from: fFrom || undefined,
        date_to: fTo || undefined,
        page,
        page_size: PAGE_SIZE,
      })
      .then((d) => {
        setRows(d.items ?? []);
        setTotal(d.total ?? 0);
        setActions(d.actions ?? []);
        setOrgs(d.orgs ?? []);
        setState('ready');
      })
      .catch(() => setState('error'));
  };
  // 필터/페이지가 바뀔 때마다 다시 조회
  useEffect(load, [fAction, fOrg, fFrom, fTo, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const setFilter = (fn: () => void) => {
    fn();
    setPage(1); // 필터 변경 시 항상 1페이지부터
  };
  const resetFilters = () => {
    setFAction('');
    setFOrg('');
    setFFrom('');
    setFTo('');
    setPage(1);
  };
  const hasFilter = !!(fAction || fOrg || fFrom || fTo);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);

  return (
    <div className="op-root ops-auditlog">
      <OpsNav />

      <main className="op-main">
        <div className="op-head">
          <div>
            <h1 className="op-title">감사 로그</h1>
            <p className="op-sub">승인·비밀번호 초기화·연결 해제 등 민감한 행동의 기록이에요. (누가·언제·무엇을)</p>
          </div>
          <button className="op-refresh" onClick={load}><i className="ph-bold ph-arrows-clockwise" />새로고침</button>
        </div>

        {/* 필터 바 — 기관·행동·기간으로 좁혀 본다 (실무 수준) */}
        <div className="op-logfilters">
          <select className="op-filsel" value={fOrg} onChange={(e) => setFilter(() => setFOrg(e.target.value))} title="기관">
            <option value="">전체 기관</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <select className="op-filsel" value={fAction} onChange={(e) => setFilter(() => setFAction(e.target.value))} title="행동">
            <option value="">전체 행동</option>
            {actions.map((a) => <option key={a} value={a}>{ACTION_META[a]?.label ?? a}</option>)}
          </select>
          <input className="op-fildate" type="date" value={fFrom} max={fTo || undefined} onChange={(e) => setFilter(() => setFFrom(e.target.value))} title="시작일" />
          <span className="op-fildash">~</span>
          <input className="op-fildate" type="date" value={fTo} min={fFrom || undefined} onChange={(e) => setFilter(() => setFTo(e.target.value))} title="종료일" />
          {hasFilter && (
            <button className="op-filreset" onClick={resetFilters}><i className="ph-bold ph-x" />필터 해제</button>
          )}
          <span className="op-filcount">{total.toLocaleString()}건</span>
        </div>

        <div className="op-logcard">
          <div className="op-loghead">
            <span className="op-logcol-act">행동</span>
            <span className="op-logcol-who">실행자</span>
            <span className="op-logcol-tgt">대상</span>
            <span className="op-logcol-time">시각</span>
          </div>
          {state === 'loading' && <div className="op-logrow">불러오는 중…</div>}
          {state === 'error' && (
            <div className="op-logrow">감사 로그를 불러오지 못했어요. 새로고침해 주세요.</div>
          )}
          {state === 'ready' && rows.length === 0 && (
            <div className="op-logrow">{hasFilter ? '조건에 맞는 기록이 없어요. 필터를 바꿔 보세요.' : '기록이 아직 없어요.'}</div>
          )}
          {state === 'ready' && rows.map((r) => {
            // ★매핑이 없으면 ★눈에 띄게 한다. r.action 을 그대로 쓰면
            //   "ops.operator_delete" 같은 ★개발자 코드가 운영자 화면에 조용히 섞여 들어간다.
            //   0815 에 실제로 5종이 그렇게 새 나가고 있었다(기능을 추가하며 이름만 안 붙였다).
            //   '미등록'이라고 밝히면 운영자가 보고 알려 주고, 우리는 고칠 수 있다.
            const m = ACTION_META[r.action] ?? {
              label: `기록 종류 미등록 (${r.action})`,
              icon: 'ph-question',
              cls: 'warn',
            };
            return (
              <div key={r.id} className="op-logrow">
                <span className="op-logcol-act">
                  <span className={`op-logic op-logic--${m.cls}`}><i className={`ph-fill ${m.icon}`} /></span>
                  {m.label}
                </span>
                <span className="op-logcol-who">
                  <b className="op-actor-name">{r.actor_name ?? '알 수 없음'}</b>
                  {/* 계정 구분: 이메일(동명 운영자/기관 관리자 구분). 삭제된 계정은 잔여 id */}
                  {r.actor_email ? (
                    <small className="op-actor-sub">{r.actor_email}</small>
                  ) : !r.actor_name && r.actor_user_id ? (
                    <small className="op-actor-sub">삭제된 계정 {r.actor_user_id.slice(0, 8)}</small>
                  ) : null}
                </span>
                <span className="op-logcol-tgt">
                  <span className="op-tgt-type">
                    {r.target_type
                      ? TARGET_LABEL[r.target_type] ?? `미등록 (${r.target_type})`
                      : '-'}
                  </span>
                  {/* ★0816 지적 — "말 그대로 로그인데". 그전엔 종류까지만 보여 줘서
                      「코스 수정 · 코스」로 끝났다. ★어느 코스인지가 없었다.
                      DB 에는 target_id 가 있었고 이름을 찾을 수 있었다(backend#80). */}
                  {r.target_name && <b className="op-tgt-name">{r.target_name}</b>}
                  {/* 어느 기관에서 일어난 행동인지 — 기관이 많아져도 맥락이 남는다 */}
                  {r.org_name && <small className="op-tgt-org">{r.org_name}</small>}
                  {/* ★무엇을 어떻게 바꿨나 — before/after 를 비교해 ★바뀐 칸만.
                      DB 에는 있었는데 응답에 안 실려 있었다. 두 줄까지만 펼쳐 두고
                      더 있으면 개수로 알린다(줄 높이가 들쭉날쭉해지지 않게). */}
                  {r.changes?.length > 0 && (
                    <span className="op-tgt-changes">
                      {r.changes.slice(0, 2).map((c) => (
                        <span key={c.field} className="op-chg">
                          <em>{auditField(c.field)}</em>
                          {/* ★한쪽만 있으면 「추가/삭제」라고 단정하지 않는다 —
                              audit() 을 부르는 곳마다 결과를 before 에 넣기도 after 에
                              넣기도 해서, 그것으로 뜻을 추론하면 틀린다.
                              무엇을 한 것인지는 ★행동 이름이 이미 말한다. */}
                          {c.before !== null && c.before !== undefined &&
                          c.after !== null && c.after !== undefined ? (
                            <>
                              {auditValue(c.before)} <i>→</i> {auditValue(c.after)}
                            </>
                          ) : (
                            auditValue(c.before ?? c.after)
                          )}
                        </span>
                      ))}
                      {r.changes.length > 2 && (
                        <span className="op-chg op-chg--more">외 {r.changes.length - 2}가지</span>
                      )}
                    </span>
                  )}
                  {/* 문의 답변은 어떤 내용을 보냈는지 미리보기로 확인 */}
                  {r.detail && (
                    <button className="op-previewbtn" onClick={() => setPreview(r)}>
                      <i className="ph-bold ph-eye" /> 답변 미리보기
                    </button>
                  )}
                </span>
                <span className="op-logcol-time">{fmt(r.created_at)}</span>
              </div>
            );
          })}
        </div>

        {/* 페이지네이션 — 필터 결과 안에서 이동 */}
        {state === 'ready' && total > 0 && (
          <div className="op-logpage">
            <span className="op-pageinfo">{from.toLocaleString()}–{to.toLocaleString()} / {total.toLocaleString()}건</span>
            <div className="op-pagebtns">
              <button className="op-pagebtn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <i className="ph-bold ph-caret-left" />이전
              </button>
              <span className="op-pagenow">{page} / {totalPages}</span>
              <button className="op-pagebtn" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                다음<i className="ph-bold ph-caret-right" />
              </button>
            </div>
          </div>
        )}
      </main>

      {preview && preview.detail && (
        <div className="op-bh-overlay" onClick={() => setPreview(null)}>
          <div className="op-formmodal" onClick={(e) => e.stopPropagation()}>
            <div className="op-bh-modal-h">
              <span><i className="ph-fill ph-chat-circle-text" /> 문의 &amp; 답변</span>
              <button className="op-bh-modal-x" onClick={() => setPreview(null)}>
                <i className="ph-bold ph-x" />
              </button>
            </div>

            {/* 원래 문의(질문) */}
            {preview.detail.question && (
              <div className="op-qa-question">
                <div className="op-qa-label">
                  <i className="ph-fill ph-question" /> 문의
                  {preview.detail.question_by && <span className="op-qa-by">· {preview.detail.question_by}</span>}
                  {preview.detail.question_email && (
                    <a className="op-qa-mail" href={`mailto:${preview.detail.question_email}`}>
                      <i className="ph-bold ph-envelope-simple" />{preview.detail.question_email}
                    </a>
                  )}
                  {preview.detail.question_at && <span className="op-qa-at">{fmt(preview.detail.question_at)}</span>}
                </div>
                <div className="op-qa-body">{preview.detail.question}</div>
              </div>
            )}

            {/* 이 문의에 달린 모든 답변 (시간순) */}
            <div className="op-qa-label op-qa-label--ans">
              <i className="ph-fill ph-chats-circle" /> 답변 {preview.detail.answers.length}개
            </div>
            {preview.detail.answers.length === 0 ? (
              <div className="op-answer-body">저장된 답변 내용이 없어요.</div>
            ) : (
              preview.detail.answers.map((a, i) => (
                <div key={i} className="op-qa-answer">
                  {a.at && <div className="op-qa-at op-qa-at--ans">{fmt(a.at)}</div>}
                  <div className="op-answer-body">{a.body}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
