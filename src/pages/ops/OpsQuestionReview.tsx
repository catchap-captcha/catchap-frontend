import { useEffect, useRef, useState } from 'react';
import { lectureApi, type OpsLecture, type ReviewQueueItem } from '../../api/lectures';
import OpsNav from '../../components/ops/OpsNav';
import { QuestionsModal } from './OpsLectures';
import './OpsApproval.css';
import './OpsRenewalShared.css';
import './OpsQuestionReview.css';

type Tab = 'pending' | 'review' | 'published';
const TAB_LABEL: Record<Tab, string> = { pending: '검수 대기', review: '검토 권장', published: '공개됨' };
const PAGE_SIZE = 10;

// AI 자기검증 적합도(suggested_placement) → 라벨·색 클래스·아이콘.
// captcha=강의 확인문항 적합 / bank=문제 은행 적합 / discard=불량 의심. null=미판정.
const FIT: Record<string, { label: string; cls: string; icon: string }> = {
  captcha: { label: '확인 문항 적합', cls: 'exam', icon: 'ph-seal-check' },
  bank: { label: '은행 적합', cls: 'bank', icon: 'ph-bank' },
  discard: { label: '불량 의심', cls: 'discard', icon: 'ph-warning-diamond' },
};

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * 문항 검수 — CatChap '문항 검수' 리뉴얼 화면 그대로. AI가 만든 초안과 등록된 확인 문항을
 * 검토해 공개한다. 승인/반려는 기존 문항 CRUD(PUT status=active / DELETE)를 그대로 쓴다.
 */
export default function OpsQuestionReview() {
  const [lectures, setLectures] = useState<OpsLecture[]>([]);
  const [lectureId, setLectureId] = useState('');
  const [tab, setTab] = useState<Tab>('pending');
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [counts, setCounts] = useState({ pending: 0, review: 0, published: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [generating, setGenerating] = useState(false);
  // 문항 편집 — '강의 관리'의 확인 문항 모달을 그대로 열어(딥링크), 이 문항의 편집 폼이
  // 자동으로 펼쳐지게 한다(QuestionsModal의 initialEditId).
  const [editTarget, setEditTarget] = useState<{ lec: OpsLecture; questionId: string } | null>(null);
  const genTimer = useRef<number | undefined>(undefined);
  const say = (m: string) => {
    setToast(m);
    window.clearTimeout(genTimer.current);
    genTimer.current = window.setTimeout(() => setToast(''), 2400);
  };

  useEffect(() => {
    lectureApi.opsList().then(setLectures).catch(() => setLectures([]));
  }, []);

  const load = () => {
    setState('loading');
    lectureApi
      .opsQuestionReviewQueue({ tab, page, page_size: PAGE_SIZE, lecture_id: lectureId || undefined })
      .then((d) => {
        setItems(d.items ?? []);
        setTotal(d.total ?? 0);
        setCounts(d.counts ?? { pending: 0, review: 0, published: 0 });
        setState('ready');
      })
      .catch(() => setState('error'));
  };
  useEffect(load, [tab, page, lectureId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectTab = (t: Tab) => {
    setTab(t);
    setPage(1);
  };

  const approve = async (q: ReviewQueueItem) => {
    setBusyId(q.id);
    try {
      await lectureApi.opsQuestionUpdate(q.lecture_id, q.id, { status: 'active' });
      say('문항을 공개했어요.');
      load();
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } };
      say(err.response?.data?.detail ?? '공개에 실패했어요.');
    } finally {
      setBusyId(null);
    }
  };

  // #2 문제 은행으로 — AI가 '은행 적합'으로 본 상식형 문항 등을 강의 확인문항 대신 전체학습
  // 문제 은행에 넣는다. 형식 변환은 서버 담당. 다답형·이미지는 400, 중복·미적재는 409.
  const toBank = async (q: ReviewQueueItem) => {
    setBusyId(q.id);
    try {
      const r = await lectureApi.opsQuestionToBank(q.lecture_id, q.id);
      say(r.runtime_visible ? '문제 은행에 넣었어요.' : '은행에 넣었지만 실시간 반영은 실패했어요.');
      load();
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } };
      say(err.response?.data?.detail ?? '문제 은행 배치에 실패했어요.');
    } finally {
      setBusyId(null);
    }
  };

  const unpublish = async (q: ReviewQueueItem) => {
    setBusyId(q.id);
    try {
      await lectureApi.opsQuestionUpdate(q.lecture_id, q.id, { status: 'draft' });
      say('문항을 비공개로 돌렸어요.');
      load();
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } };
      say(err.response?.data?.detail ?? '변경에 실패했어요.');
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (q: ReviewQueueItem) => {
    if (!window.confirm('이 문항을 삭제할까요? 되돌릴 수 없어요.')) return;
    setBusyId(q.id);
    try {
      await lectureApi.opsQuestionDelete(q.lecture_id, q.id);
      say('문항을 삭제했어요.');
      load();
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } };
      say(err.response?.data?.detail ?? '삭제에 실패했어요.');
    } finally {
      setBusyId(null);
    }
  };

  // AI 문항 생성 — 레퍼런스는 강의 구분 없는 버튼 하나지만, 실제 생성은 강의 단위 작업이라
  // 상단 강의 필터가 특정 강의로 좁혀져 있을 때만 그 강의를 대상으로 생성한다.
  const genAI = async () => {
    if (generating) return;
    if (!lectureId) {
      say('먼저 강의를 선택하면 그 강의의 확인문항을 생성해요.');
      return;
    }
    setGenerating(true);
    try {
      const { job_id } = await lectureApi.opsQuestionGenerate(lectureId, 3);
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const job = await lectureApi.opsQuestionGenJob(lectureId, job_id);
        if (job.status === 'done') {
          say(`AI가 확인 문항 초안 ${job.created ?? ''}개를 만들었어요. 검수 후 공개하세요.`);
          load();
          break;
        }
        if (job.status === 'error') {
          say(job.error ? `생성 실패: ${job.error}` : '생성에 실패했어요.');
          break;
        }
      }
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } };
      say(err.response?.data?.detail ?? '생성 요청에 실패했어요.');
    } finally {
      setGenerating(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    // 헤더 셸은 강사 홈·강의 관리와 같은 공통 규격(op-*) — 이 화면만 orn-* 셸이라 제목 크기
    // (32/700 vs 30/800)·본문 폭·여백이 형제 페이지들과 어긋났다.
    <div className="op-root">
      <OpsNav />
      <main className="op-main qr-page">
        <div className="op-head">
          <div>
            <h1 className="op-title">문항 검수</h1>
            <p className="op-sub" style={{ maxWidth: 640 }}>
              AI가 만든 초안과 등록된 확인 문항을 검토해 공개합니다. 공개해야 학생 화면의 시청 검증에 사용됩니다.
            </p>
          </div>
          <button className="op-btn op-btn--approve" disabled={generating} onClick={genAI}>
            <i className={generating ? 'ph ph-spinner-gap' : 'ph ph-sparkle'} />
            {generating ? '생성 중…' : 'AI 문항 생성'}
          </button>
        </div>

        {toast && <div className="orn-toast"><i className="ph ph-check-circle" />{toast}</div>}

        <div className="orn-kpigrid qr-kpigrid">
          <div className="orn-card orn-kpi">
            <span className="orn-kpi-num" style={{ color: 'var(--brand)' }}>{counts.pending}</span>
            <span className="orn-kpi-lb">검수 대기</span>
          </div>
          <div className="orn-card orn-kpi">
            <span className="orn-kpi-num">{counts.published}</span>
            <span className="orn-kpi-lb">공개 문항</span>
          </div>
          <div className="orn-card orn-kpi">
            <span className="orn-kpi-num">{counts.review}</span>
            <span className="orn-kpi-lb">검토 권장</span>
          </div>
        </div>

        <div className="qr-lecbar">
          <label className="qr-lecbar-label" htmlFor="qr-lecsel">
            <i className="ph ph-video-camera" />검수할 강의
          </label>
          <div className="qr-lecsel-wrap">
            <select
              id="qr-lecsel"
              className="qr-lecsel"
              value={lectureId}
              onChange={(e) => {
                setLectureId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">전체 강의 · 모든 문항</option>
              {lectures.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
            <i className="ph ph-caret-down qr-lecsel-caret" />
          </div>
          {lectureId && (
            <button
              className="qr-lecclear"
              onClick={() => {
                setLectureId('');
                setPage(1);
              }}
            >
              <i className="ph ph-x" />전체 보기
            </button>
          )}
        </div>

        <div className="qr-filters">
          {(['pending', 'review', 'published'] as Tab[]).map((t) => (
            <button
              key={t}
              className={'qr-tab' + (tab === t ? ' qr-tab--on' : '')}
              onClick={() => selectTab(t)}
            >
              {TAB_LABEL[t]}
              {t !== 'published' && <span className="qr-tab-badge">{counts[t]}</span>}
            </button>
          ))}
        </div>

        {state === 'loading' && <div className="orn-loading"><i className="ph-duotone ph-spinner-gap" />불러오는 중…</div>}
        {state === 'error' && (
          <div className="orn-card orn-empty"><i className="ph ph-warning-circle" /><p>검수 큐를 불러오지 못했어요.</p></div>
        )}
        {state === 'ready' && items.length === 0 && (
          <div className="orn-card orn-empty">
            <i className="ph ph-check-circle" />
            <p>
              {tab === 'pending' && '검수할 문항이 없어요. 모두 처리했어요.'}
              {tab === 'review' && '검토가 필요한 문항이 없어요.'}
              {tab === 'published' && '아직 공개한 문항이 없어요.'}
            </p>
          </div>
        )}

        {state === 'ready' && items.length > 0 && (
          <div className="qr-list">
            {items.map((q) => {
              const answers = q.answer_indexes ?? [q.answer_index];
              const fit = q.suggested_placement ? FIT[q.suggested_placement] : null;
              return (
                <div key={q.id} className={`orn-card qr-card${fit ? ` qr-card--fit-${fit.cls}` : ''}`}>
                  <div className="qr-card-top">
                    <span className={`qr-origin qr-origin--${q.source === 'llm' ? 'ai' : 'manual'}`}>
                      {q.source === 'llm' ? 'AI' : '자작'}
                    </span>
                    {fit ? (
                      <span className={`qr-fit qr-fit--${fit.cls}`}><i className={`ph ${fit.icon}`} /> {fit.label}</span>
                    ) : (
                      <span className="qr-fit qr-fit--none"><i className="ph ph-minus-circle" /> 미판정</span>
                    )}
                    {tab === 'published' && <span className="qr-pill qr-pill--published"><i className="ph ph-check-circle" /> 공개됨</span>}
                    <span className="qr-meta">
                      <i className="ph ph-video-camera" />{q.lecture_title} · {fmtTime(q.position_sec)}
                    </span>
                  </div>
                  <p className="qr-prompt">{q.prompt || '(문항 내용 없음)'}</p>
                  <div className="qr-options">
                    {q.options.map((opt, i) => {
                      const correct = answers.includes(i);
                      return (
                        <div key={i} className={'qr-opt' + (correct ? ' qr-opt--correct' : '')}>
                          <span className="qr-opt-mark"><i className={correct ? 'ph ph-check-circle' : 'ph ph-circle'} /></span>
                          <span className="qr-opt-text">{opt}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="qr-card-bottom">
                    <span className="qr-card-bottom-meta">
                      출제 시점 {fmtTime(q.position_sec)} · 정답 {answers.length}개
                    </span>
                    <button
                      className="orn-btn orn-btn--ghost"
                      onClick={() => {
                        const lec = lectures.find((l) => l.id === q.lecture_id);
                        if (lec) setEditTarget({ lec, questionId: q.id });
                        else say('강의 정보를 아직 못 불러왔어요. 잠시 후 다시 시도해 주세요.');
                      }}
                    >
                      <i className="ph ph-pencil-simple" />수정
                    </button>
                    {tab === 'published' ? (
                      <button className="orn-btn orn-btn--ghost" disabled={busyId === q.id} onClick={() => unpublish(q)}>
                        <i className="ph ph-eye-slash" />비공개로 전환
                      </button>
                    ) : (
                      <>
                        <button className="orn-btn orn-btn--ghost" disabled={busyId === q.id} onClick={() => reject(q)}>
                          <i className="ph ph-trash" />삭제
                        </button>
                        <button className="orn-btn orn-btn--bank" disabled={busyId === q.id} onClick={() => toBank(q)}>
                          <i className="ph ph-bank" />문제 은행으로
                        </button>
                        <button className="orn-btn orn-btn--ok" disabled={busyId === q.id} onClick={() => approve(q)}>
                          <i className="ph ph-check" />공개하기
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {state === 'ready' && total > PAGE_SIZE && (
          <div className="op-logpage">
            <span className="op-pageinfo">{page} / {totalPages}페이지 · {total.toLocaleString()}건</span>
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

      {editTarget && (
        <QuestionsModal
          lec={editTarget.lec}
          initialEditId={editTarget.questionId}
          onClose={() => setEditTarget(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
