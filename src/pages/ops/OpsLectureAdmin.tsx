import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  lectureApi,
  opsLectureAdminApi,
  type OpsLectureAdminResponse,
  type OpsLectureAdminRow,
} from '../../api/lectures';
import OpsNav from '../../components/ops/OpsNav';
import { PATHS } from '../../routes/paths';
import './OpsApproval.css';
import './OpsLectureAdmin.css';

/**
 * 강의 점검 — 운영자 화면.
 *
 * ★왜 따로 만드나 — 그전에는 강사용 화면(OpsLectures)을 그대로 쓰고 버튼만 숨겼다.
 *   그건 강사가 ★자기 강의를 만드는 화면이라 코스별 트리로 접혀 있다. 강의가 몇 개일 때는
 *   편하지만, 강사와 강의가 늘면 운영자가 "누가 올렸나 · 어디가 비었나" 를 찾을 수 없다.
 *
 * 운영자가 여기서 하는 일은 셋이다.
 *   ① 문제 있는 강의 찾기  ② 강사별로 보기  ③ 문제가 있으면 바로 비공개로 돌리기
 * 그래서 요약 → 필터 → 평평한 표 순으로 둔다(대규모 관리 콘솔의 기본 모양).
 */
const ISSUE_META: Record<string, { label: string; help: string; cls: string }> = {
  noquestion: {
    label: '확인 문항 없음',
    help: '공개된 확인 문항이 하나도 없어요 — 이 강의는 시청 검증이 꺼진 채로 나갑니다.',
    cls: 'bad',
  },
  hidden: { label: '비공개', help: '학생 화면에 안 보이는 상태예요.', cls: 'muted' },
};

// ⚠️'미공개 문항 남음' 은 뺐다 — 실측하니 강의 17개 중 16개가 그 상태였다.
//   강사가 문항을 많이 만들어 두고 몇 개만 공개하는 것이 정상 흐름이라,
//   경고로 두면 전부에 배지가 붙어 정작 볼 것을 가린다.
//   미공개 수는 표의 '확인 문항 (공개 / 전체)' 칸이 이미 보여 준다.
const ISSUE_KEYS = ['noquestion', 'hidden'] as const;

const fmtMin = (sec: number) => {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m}분 ${s}초` : `${s}초`;
};

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : `${d.getMonth() + 1}/${d.getDate()}`;
};

export default function OpsLectureAdmin() {
  const [data, setData] = useState<OpsLectureAdminResponse | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [q, setQ] = useState('');
  const [instructor, setInstructor] = useState('');
  const [course, setCourse] = useState('');
  const [issue, setIssue] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null); // 상태 바꾸는 중인 강의 id
  const [msg, setMsg] = useState('');

  const load = () => {
    setState('loading');
    opsLectureAdminApi
      .list({
        q: q || undefined,
        instructor: instructor || undefined,
        course: course || undefined,
        issue: issue || undefined,
        page,
      })
      .then((d) => {
        setData(d);
        setState('ready');
      })
      .catch(() => setState('error'));
  };

  /** 공개 ↔ 비공개. ★운영자가 할 수 있는 유일한 조치라 이 화면에서 바로 되어야 한다
   *  (그전에는 강사 화면으로 보냈는데, 문제를 찾은 자리에서 못 내리면 반쪽이다).
   *  저작(수정·삭제)은 여기서도 강사 전용 — 백엔드가 status 외 필드를 403 으로 막는다. */
  const toggleStatus = async (r: OpsLectureAdminRow) => {
    const next = r.status === 'active' ? 'hidden' : 'active';
    if (next === 'hidden' && !window.confirm(`「${r.title}」을 비공개로 돌릴까요?
학생 화면에서 바로 내려가고, 강의가 지워지지는 않아요.`))
      return;
    setBusy(r.id);
    try {
      await lectureApi.opsUpdate(r.id, { status: next });
      setMsg(next === 'hidden' ? '비공개로 돌렸어요 — 학생 화면에서 내려갔어요.' : '다시 공개했어요.');
      load();
    } catch {
      setMsg('상태를 바꾸지 못했어요.');
    } finally {
      setBusy(null);
    }
  };

  // 필터가 바뀌면 1쪽부터 — 3쪽을 보다가 필터를 걸면 빈 화면이 나온다
  useEffect(() => setPage(1), [q, instructor, course, issue]);
  useEffect(load, [q, instructor, course, issue, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = data?.items ?? [];
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.page_size || 50)));
  const filtered = useMemo(
    () => Boolean(q || instructor || course || issue),
    [q, instructor, course, issue],
  );

  return (
    <div className="op-root">
      <OpsNav />
      <main className="op-main">
        <div className="op-head">
          <div>
            <h1 className="op-title">강의 점검</h1>
            <p className="op-sub">
              올라온 강의를 훑어보고, 문제가 있으면 바로 비공개로 돌립니다. 강의와 문항을
              만드는 건 강사가 하고, 운영자는 보기와 공개/비공개만 할 수 있어요.
            </p>
          </div>
          <button className="op-refresh" onClick={load} disabled={state === 'loading'}>
            새로고침
          </button>
        </div>

        {/* 요약 — "지금 무엇이 문제인가" 를 먼저. 누르면 그 문제만 걸러 본다. */}
        <div className="la-kpis">
          <button
            type="button"
            className={`la-kpi${issue === '' ? ' la-kpi--on' : ''}`}
            onClick={() => setIssue('')}
          >
            <b>{data?.summary.total ?? '—'}</b>
            <span>전체 강의</span>
          </button>
          {ISSUE_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              className={`la-kpi la-kpi--${ISSUE_META[k].cls}${issue === k ? ' la-kpi--on' : ''}`}
              onClick={() => setIssue(issue === k ? '' : k)}
              title={ISSUE_META[k].help}
            >
              <b>{data?.summary[k] ?? '—'}</b>
              <span>{ISSUE_META[k].label}</span>
            </button>
          ))}
          {/* 누르는 필터가 아니라 정보 — "그동안 뭐가 올라왔나" 가 훑을 때 첫 질문이다 */}
          <div className="la-kpi la-kpi--info">
            <b>{data?.summary.recent ?? '—'}</b>
            <span>최근 7일 새 강의</span>
          </div>
        </div>

        <div className="la-filters">
          <input
            className="la-search"
            placeholder="강의 제목으로 찾기"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select value={instructor} onChange={(e) => setInstructor(e.target.value)}>
            <option value="">올린 사람 전체</option>
            {(data?.instructors ?? []).map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
          <select value={course} onChange={(e) => setCourse(e.target.value)}>
            <option value="">전체 코스</option>
            <option value="none">미분류</option>
            {(data?.courses ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          {filtered && (
            <button
              className="op-btn op-btn--soft"
              onClick={() => {
                setQ('');
                setInstructor('');
                setCourse('');
                setIssue('');
              }}
            >
              필터 지우기
            </button>
          )}
        </div>

        {msg && <div className="la-msg">{msg}</div>}
        {state === 'error' && <div className="op-empty">목록을 불러오지 못했어요.</div>}
        {state === 'ready' && rows.length === 0 && (
          <div className="op-empty">
            {filtered ? '조건에 맞는 강의가 없어요.' : '아직 올라온 강의가 없어요.'}
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div className="la-table" role="table">
              <div className="la-tr la-tr--head" role="row">
                <span>강의</span>
                <span>올린 사람</span>
                <span>코스</span>
                <span className="la-num">확인 문항</span>
                <span>길이</span>
                <span>올린 날</span>
                <span>상태</span>
                <span>관리</span>
              </div>
              {rows.map((r: OpsLectureAdminRow) => (
                <div key={r.id} className="la-tr" role="row">
                  <span className="la-title">
                    {/* 손볼 것은 강의 화면에서 — 여기서는 찾아 주고 보내 준다 */}
                    <Link to={`${PATHS.OPS_LECTURES}?lecture=${r.id}`}>{r.title}</Link>
                    <span className="la-issues">
                      {r.issues.map((k) => (
                        <em
                          key={k}
                          className={`la-badge la-badge--${ISSUE_META[k]?.cls ?? 'muted'}`}
                          title={ISSUE_META[k]?.help}
                        >
                          {ISSUE_META[k]?.label ?? k}
                        </em>
                      ))}
                    </span>
                  </span>
                  <span>{r.instructor_name}</span>
                  <span className="la-course">{r.course_title ?? '미분류'}</span>
                  <span className="la-num">
                    <b className={r.question_active === 0 ? 'la-zero' : ''}>{r.question_active}</b>
                    <span className="la-of"> / {r.question_total}</span>
                  </span>
                  <span>{fmtMin(r.duration_sec)}</span>
                  <span>{fmtDate(r.created_at)}</span>
                  <span className={r.status === 'active' ? '' : 'la-hidden'}>
                    {r.status === 'active' ? '공개' : '비공개'}
                  </span>
                  <span>
                    <button
                      className="la-act"
                      disabled={busy === r.id}
                      onClick={() => toggleStatus(r)}
                      title={
                        r.status === 'active'
                          ? '비공개로 — 학생 화면에서 내려가고 강의는 남아요.'
                          : '공개로 — 다시 학생 화면에 보여요.'
                      }
                    >
                      {busy === r.id ? '…' : r.status === 'active' ? '비공개로' : '공개로'}
                    </button>
                  </span>
                </div>
              ))}
            </div>
            <p className="la-note">
              「확인 문항」은 <b>공개 / 전체</b>입니다. 공개가 0이면 그 강의는 시청 검증 없이
              나갑니다. 손보려면 강의 이름을 눌러 강의 화면으로 가세요.
            </p>
            {pages > 1 && (
              <div className="la-pager">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  이전
                </button>
                <span>
                  {page} / {pages}
                </span>
                <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                  다음
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
