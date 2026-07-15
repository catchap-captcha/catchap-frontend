import { useEffect, useRef, useState } from 'react';
import {
  errorDetail,
  lectureApi,
  type OpsLecture,
  type OpsLectureMaterial,
  type OpsLectureQuestion,
} from '../../api/lectures';
import OpsNav from '../../components/ops/OpsNav';
import './OpsApproval.css';
import './OpsLectures.css';

/** 강의 관리 — 영상 업로드(진행률)·메타 수정·소프트 삭제 + 확인 문항·자료실 CRUD.
 * 성공 표기는 서버 확정 후에만 한다(업로드는 완료 후 목록 재조회로 실재 확인 — 가짜 성공 금지). */

const SUBJECTS = ['국어', '영어', '수학', '과학', '사회', '생활'];

type Modal =
  | { mode: 'create' }
  | { mode: 'edit'; lec: OpsLecture }
  | { mode: 'questions'; lec: OpsLecture }
  | { mode: 'materials'; lec: OpsLecture }
  | null;

interface LectureForm {
  title: string;
  subject: string;
  duration_sec: string;
  description: string;
  check_min_sec: string;
  check_max_sec: string;
  order_no: string;
  status: string;
}

const EMPTY_FORM: LectureForm = {
  title: '',
  subject: '국어',
  duration_sec: '',
  description: '',
  check_min_sec: '60',
  check_max_sec: '180',
  order_no: '',
  status: 'active',
};

function fmtBytes(n: number): string {
  if (!n) return '-';
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}
function fmtDur(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}분 ${s ? `${s}초` : ''}`.trim() : `${s}초`;
}

export default function OpsLectures() {
  const [rows, setRows] = useState<OpsLecture[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState('');

  const say = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 2600);
  };

  const load = () => {
    setState('loading');
    lectureApi
      .opsList()
      .then((d) => {
        setRows(Array.isArray(d) ? d : []);
        setState('ready');
      })
      .catch(() => setState('error'));
  };
  useEffect(load, []);

  const remove = async (lec: OpsLecture) => {
    if (!window.confirm(`'${lec.title}' 강의를 삭제할까요? 학생 화면에서 즉시 사라져요(시청 이력은 보존).`))
      return;
    try {
      await lectureApi.opsDelete(lec.id);
      say('강의를 삭제했어요.');
      load();
    } catch (e) {
      say(errorDetail(e, '삭제에 실패했어요.'));
    }
  };

  return (
    <div className="op-root">
      <OpsNav />
      <main className="op-main">
        <div className="op-head">
          <div>
            <h1 className="op-title">강의 관리</h1>
            <p className="op-sub">
              시청 검증 강의의 <b>영상 업로드·확인 문항·자료실</b>을 관리해요. 확인 문항이 없는
              강의는 체크포인트에서 학생이 멈춰요 — 업로드 후 꼭 문항을 등록하세요.
            </p>
          </div>
          <button className="op-refresh" onClick={() => setModal({ mode: 'create' })}>
            <i className="ph-bold ph-upload-simple" />
            강의 업로드
          </button>
        </div>

        <div className="op-logcard">
          <div className="op-loghead op-lect-grid">
            <span>강의</span>
            <span>과목</span>
            <span>길이</span>
            <span>확인 간격</span>
            <span>문항</span>
            <span>상태</span>
            <span className="op-col-right">관리</span>
          </div>
          {state === 'loading' && <div className="op-logrow">불러오는 중…</div>}
          {state === 'error' && (
            <div className="op-logrow">
              강의 목록을 불러오지 못했어요.{' '}
              <button className="op-btn op-btn--reject" onClick={load}>
                다시 시도
              </button>
            </div>
          )}
          {state === 'ready' && rows.length === 0 && (
            <div className="op-logrow">등록된 강의가 없어요. 우측 상단에서 영상을 업로드해 보세요.</div>
          )}
          {state === 'ready' &&
            rows.map((lec) => (
              <div key={lec.id} className="op-logrow op-lect-grid">
                <span>
                  <b>{lec.title}</b>
                  <small className="op-aimodel-desc">
                    {lec.video_ext} · {fmtBytes(lec.video_bytes)}
                    {lec.description ? ` · ${lec.description}` : ''}
                  </small>
                </span>
                <span>{lec.subject}</span>
                <span>{fmtDur(lec.duration_sec)}</span>
                <span className="op-mono">
                  {lec.check_min_sec}~{lec.check_max_sec}초
                </span>
                <span>
                  <b>{lec.active_question_count}</b>
                  <small className="op-lect-dim">/{lec.question_count}</small>
                </span>
                <span>
                  <span
                    className={`op-sys-status op-sys-status--${lec.status === 'active' ? 'ok' : 'warn'}`}
                  >
                    {lec.status === 'active' ? '공개' : '숨김'}
                  </span>
                </span>
                <span className="op-col-right op-lect-actions">
                  <button
                    className="op-btn op-btn--approve"
                    onClick={() => setModal({ mode: 'questions', lec })}
                  >
                    <i className="ph-bold ph-seal-question" />
                    문항
                  </button>
                  <button
                    className="op-btn op-btn--reject"
                    onClick={() => setModal({ mode: 'materials', lec })}
                  >
                    <i className="ph-bold ph-folder-open" />
                    자료
                  </button>
                  <button className="op-btn op-btn--reject" onClick={() => setModal({ mode: 'edit', lec })}>
                    <i className="ph-bold ph-pencil-simple" />
                    수정
                  </button>
                  <button className="op-btn op-btn--reject op-lect-danger" onClick={() => remove(lec)}>
                    <i className="ph-bold ph-trash" />
                    삭제
                  </button>
                </span>
              </div>
            ))}
        </div>
      </main>

      {(modal?.mode === 'create' || modal?.mode === 'edit') && (
        <LectureFormModal
          modal={modal}
          onClose={() => setModal(null)}
          onSaved={(msg) => {
            setModal(null);
            say(msg);
            load();
          }}
        />
      )}
      {modal?.mode === 'questions' && (
        <QuestionsModal lec={modal.lec} onClose={() => setModal(null)} onChanged={load} />
      )}
      {modal?.mode === 'materials' && (
        <MaterialsModal lec={modal.lec} onClose={() => setModal(null)} />
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

/* ================= 강의 업로드/수정 모달 ================= */
function LectureFormModal({
  modal,
  onClose,
  onSaved,
}: {
  modal: { mode: 'create' } | { mode: 'edit'; lec: OpsLecture };
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const editing = modal.mode === 'edit' ? modal.lec : null;
  const [form, setForm] = useState<LectureForm>(
    editing
      ? {
          title: editing.title,
          subject: editing.subject,
          duration_sec: String(editing.duration_sec),
          description: editing.description ?? '',
          check_min_sec: String(editing.check_min_sec),
          check_max_sec: String(editing.check_max_sec),
          order_no: editing.order_no != null ? String(editing.order_no) : '',
          status: editing.status,
        }
      : EMPTY_FORM,
  );
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const set = (k: keyof LectureForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const duration = Number(form.duration_sec);
    const minSec = Number(form.check_min_sec);
    const maxSec = Number(form.check_max_sec);
    if (!form.title.trim()) return setErr('제목은 필수예요.');
    if (!Number.isInteger(duration) || duration <= 0) return setErr('영상 길이(초)는 1 이상의 정수예요.');
    if (!(minSec >= 1 && minSec <= maxSec)) return setErr('확인 간격은 1초 이상, 최소≤최대여야 해요.');
    if (!editing && !file) return setErr('업로드할 영상 파일(mp4/webm)을 선택하세요.');

    setSaving(true);
    setErr('');
    try {
      if (editing) {
        await lectureApi.opsUpdate(editing.id, {
          title: form.title.trim(),
          description: form.description,
          subject: form.subject,
          duration_sec: duration,
          check_min_sec: minSec,
          check_max_sec: maxSec,
          ...(form.order_no !== '' ? { order_no: Number(form.order_no) } : {}),
          status: form.status,
        });
        onSaved('강의 정보를 수정했어요.');
      } else {
        const fd = new FormData();
        fd.append('title', form.title.trim());
        fd.append('subject', form.subject);
        fd.append('duration_sec', String(duration));
        if (form.description) fd.append('description', form.description);
        fd.append('check_min_sec', String(minSec));
        fd.append('check_max_sec', String(maxSec));
        if (form.order_no !== '') fd.append('order_no', form.order_no);
        fd.append('file', file as File);
        setProgress(0);
        const created = await lectureApi.opsCreate(fd, (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        });
        // 성공 표기는 목록 재조회로 실재 확인 후에만 — 업로드 응답만 믿지 않는다.
        // 재조회 자체가 실패한 경우는 '업로드 실패'로 오표기하지 않는다(재업로드 유도 →
        // 중복 강의 생성 위험) — 완료됐을 수 있음을 정직하게 안내한다.
        let fresh;
        try {
          fresh = await lectureApi.opsList();
        } catch {
          throw new Error(
            '업로드는 완료됐을 수 있지만 목록 재조회에 실패했어요. 재업로드하지 말고 새로고침으로 확인하세요.',
          );
        }
        if (!fresh.some((r) => r.id === created.id)) {
          throw new Error('업로드 후 목록에서 강의를 확인하지 못했어요. 새로고침 후 다시 확인하세요.');
        }
        onSaved(`'${created.title}' 업로드 완료 — 목록에서 확인했어요. 이제 확인 문항을 등록하세요.`);
      }
    } catch (e) {
      setErr(e instanceof Error && !('response' in e) ? e.message : errorDetail(e, '저장에 실패했어요.'));
      setProgress(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="op-bh-overlay" onClick={() => !saving && onClose()}>
      <div className="op-formmodal" onClick={(e) => e.stopPropagation()}>
        <div className="op-bh-modal-h">
          <span>
            <i className="ph-fill ph-video-camera" /> {editing ? '강의 수정' : '강의 업로드'}
          </span>
          <button className="op-bh-modal-x" onClick={onClose} disabled={saving}>
            <i className="ph-bold ph-x" />
          </button>
        </div>
        <div className="op-form-grid">
          <label className="ox-field op-form-span2">
            제목
            <input value={form.title} onChange={(e) => set('title')(e.target.value)} placeholder="예: 깊이 있게 읽어요(1)" />
          </label>
          <label className="ox-field">
            과목
            <select value={form.subject} onChange={(e) => set('subject')(e.target.value)}>
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="ox-field">
            영상 길이(초)
            <input value={form.duration_sec} onChange={(e) => set('duration_sec')(e.target.value)} placeholder="예: 1740" />
          </label>
          <label className="ox-field">
            확인 간격 최소(초)
            <input value={form.check_min_sec} onChange={(e) => set('check_min_sec')(e.target.value)} />
          </label>
          <label className="ox-field">
            확인 간격 최대(초)
            <input value={form.check_max_sec} onChange={(e) => set('check_max_sec')(e.target.value)} />
          </label>
          <label className="ox-field">
            회차(order_no)
            <input value={form.order_no} onChange={(e) => set('order_no')(e.target.value)} placeholder="비우면 맨 뒤" />
          </label>
          {editing && (
            <label className="ox-field">
              상태
              <select value={form.status} onChange={(e) => set('status')(e.target.value)}>
                <option value="active">공개</option>
                <option value="hidden">숨김</option>
              </select>
            </label>
          )}
          <label className="ox-field op-form-span2">
            설명
            <input value={form.description} onChange={(e) => set('description')(e.target.value)} placeholder="학생 화면에 보이는 소개 문구" />
          </label>
          {!editing && (
            <label className="ox-field op-form-span2">
              영상 파일 (mp4/webm, 최대 500MB)
              <input
                type="file"
                accept="video/mp4,video/webm"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          )}
        </div>
        {progress != null && (
          <div className="op-lect-progress">
            <div className="op-lect-progress-track">
              <div className="op-lect-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span>
              {progress < 100 ? `업로드 중… ${progress}%` : '서버에서 저장 확인 중…'}
            </span>
          </div>
        )}
        {err && (
          <div className="op-form-err">
            <i className="ph-fill ph-warning-circle" /> {err}
          </div>
        )}
        <div className="op-form-actions">
          <button className="op-btn op-btn--reject" disabled={saving} onClick={onClose}>
            취소
          </button>
          <button className="op-btn op-btn--approve" disabled={saving} onClick={save}>
            <i className="ph-bold ph-check" />
            {saving ? '저장 중…' : editing ? '저장' : '업로드'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= 확인 문항 모달 ================= */
interface QForm {
  id: string | null; // null = 새 문항
  position_sec: string;
  prompt: string;
  optionsText: string; // 줄바꿈 구분
  answer_index: string;
  explain: string;
  status: string;
}
const EMPTY_Q: QForm = { id: null, position_sec: '0', prompt: '', optionsText: '', answer_index: '0', explain: '', status: 'active' };

function QuestionsModal({
  lec,
  onClose,
  onChanged,
}: {
  lec: OpsLecture;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [items, setItems] = useState<OpsLectureQuestion[] | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [form, setForm] = useState<QForm | null>(null); // null = 편집 폼 닫힘
  const [err, setErr] = useState('');
  const [banner, setBanner] = useState(''); // LLM 생성 등 서버 에러 배너(503 정직 표시)
  const [bannerOk, setBannerOk] = useState(false); // true = 성공 안내(에러 스타일과 구분)
  const [saving, setSaving] = useState(false);
  const [genN, setGenN] = useState('3');
  const [generating, setGenerating] = useState(false);
  const changedRef = useRef(false);

  const load = () => {
    setLoadErr('');
    lectureApi
      .opsQuestions(lec.id)
      .then(setItems)
      .catch((e) => {
        setItems([]);
        setLoadErr(errorDetail(e, '문항 목록을 불러오지 못했어요.'));
      });
  };
  useEffect(load, [lec.id]);

  const close = () => {
    if (saving || generating) return; // 저장/생성 in-flight 중 닫힘 방지 — 목록 카운트 유실 예방
    if (changedRef.current) onChanged(); // 문항 수 변경을 목록에 반영
    onClose();
  };

  const openEdit = (q: OpsLectureQuestion) =>
    setForm({
      id: q.id,
      position_sec: String(q.position_sec),
      prompt: q.prompt ?? '',
      optionsText: q.options.join('\n'),
      answer_index: String(q.answer_index),
      explain: q.explain ?? '',
      status: q.status,
    });

  const save = async () => {
    if (!form) return;
    const options = form.optionsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const pos = Number(form.position_sec);
    const ans = Number(form.answer_index);
    if (!form.prompt.trim()) return setErr('문제(프롬프트)는 필수예요.');
    if (options.length < 2 || options.length > 6) return setErr('보기는 2~6개(한 줄에 하나씩)여야 해요.');
    if (!Number.isInteger(ans) || ans < 0 || ans >= options.length)
      return setErr(`정답 번호는 0~${options.length - 1} 사이여야 해요.`);
    if (!Number.isInteger(pos) || pos < 0) return setErr('출제 시점(초)은 0 이상의 정수예요.');
    setSaving(true);
    setErr('');
    try {
      const body = {
        position_sec: pos,
        prompt: form.prompt.trim(),
        options,
        answer_index: ans,
        explain: form.explain,
        status: form.status,
      };
      if (form.id) await lectureApi.opsQuestionUpdate(lec.id, form.id, body);
      else await lectureApi.opsQuestionCreate(lec.id, body);
      changedRef.current = true;
      setForm(null);
      load();
    } catch (e) {
      setErr(errorDetail(e, '문항 저장에 실패했어요.'));
    } finally {
      setSaving(false);
    }
  };

  const approve = async (q: OpsLectureQuestion) => {
    try {
      await lectureApi.opsQuestionUpdate(lec.id, q.id, { status: 'active' });
      changedRef.current = true;
      load();
    } catch (e) {
      setBannerOk(false);
      setBanner(errorDetail(e, '승인에 실패했어요.'));
    }
  };

  const remove = async (q: OpsLectureQuestion) => {
    if (!window.confirm('이 문항을 삭제할까요?')) return;
    try {
      await lectureApi.opsQuestionDelete(lec.id, q.id);
      changedRef.current = true;
      load();
    } catch (e) {
      setBannerOk(false);
      setBanner(errorDetail(e, '삭제에 실패했어요.'));
    }
  };

  const generate = async () => {
    const n = Number(genN);
    if (!Number.isInteger(n) || n < 1 || n > 10) {
      setBannerOk(false);
      setBanner('생성 개수는 1~10 사이 정수예요.');
      return;
    }
    setGenerating(true);
    setBanner('');
    try {
      const res = await lectureApi.opsQuestionGenerate(lec.id, n);
      changedRef.current = true;
      setBannerOk(true);
      setBanner(`AI가 ${res.created}개 문항을 생성했어요(draft) — 검수 후 승인하세요.`);
      load();
    } catch (e) {
      // 503(키 미설정)·502(생성 실패)를 그대로 정직하게 노출 — stub 생성/성공 위장 없음
      setBannerOk(false);
      setBanner(errorDetail(e, 'AI 문항 생성에 실패했어요.'));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="op-bh-overlay" onClick={close}>
      <div className="op-formmodal op-lect-widemodal" onClick={(e) => e.stopPropagation()}>
        <div className="op-bh-modal-h">
          <span>
            <i className="ph-fill ph-seal-question" /> 확인 문항 — {lec.title}
          </span>
          <button className="op-bh-modal-x" onClick={close}>
            <i className="ph-bold ph-x" />
          </button>
        </div>

        <div className="op-lect-qtools">
          <button className="op-btn op-btn--approve" onClick={() => { setErr(''); setForm({ ...EMPTY_Q }); }}>
            <i className="ph-bold ph-plus" />
            문항 추가
          </button>
          <div className="op-lect-gen">
            <input value={genN} onChange={(e) => setGenN(e.target.value)} className="op-lect-gen-n" aria-label="생성 개수" />
            <button className="op-btn op-btn--reject" disabled={generating} onClick={generate}>
              <i className="ph-bold ph-sparkle" />
              {generating ? '생성 중…' : 'AI 문항 생성'}
            </button>
          </div>
        </div>
        {banner && (
          <div className={`op-lect-banner ${bannerOk ? 'op-lect-banner-ok' : 'op-form-err'}`}>
            <i className={bannerOk ? 'ph-fill ph-check-circle' : 'ph-fill ph-info'} /> {banner}
          </div>
        )}
        {loadErr && (
          <div className="op-form-err op-lect-banner">
            <i className="ph-fill ph-warning-circle" /> {loadErr}
          </div>
        )}

        {form && (
          <div className="op-lect-qform">
            <div className="op-form-grid">
              <label className="ox-field">
                출제 시점(초) — 이 시점까지 본 학생에게만 출제
                <input value={form.position_sec} onChange={(e) => setForm({ ...form, position_sec: e.target.value })} />
              </label>
              <label className="ox-field">
                상태
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="active">공개(active)</option>
                  <option value="draft">검수 대기(draft)</option>
                </select>
              </label>
              <label className="ox-field op-form-span2">
                문제
                <input value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} placeholder="예: 이 강의에서 배운 중심 문장은 무엇인가요?" />
              </label>
              <label className="ox-field op-form-span2">
                보기 (한 줄에 하나, 2~6개)
                <textarea
                  className="op-lect-textarea"
                  rows={4}
                  value={form.optionsText}
                  onChange={(e) => setForm({ ...form, optionsText: e.target.value })}
                />
              </label>
              <label className="ox-field">
                정답 번호 (0부터)
                <input value={form.answer_index} onChange={(e) => setForm({ ...form, answer_index: e.target.value })} />
              </label>
              <label className="ox-field">
                해설
                <input value={form.explain} onChange={(e) => setForm({ ...form, explain: e.target.value })} />
              </label>
            </div>
            {err && (
              <div className="op-form-err">
                <i className="ph-fill ph-warning-circle" /> {err}
              </div>
            )}
            <div className="op-form-actions">
              <button className="op-btn op-btn--reject" disabled={saving} onClick={() => setForm(null)}>
                취소
              </button>
              <button className="op-btn op-btn--approve" disabled={saving} onClick={save}>
                <i className="ph-bold ph-check" />
                {saving ? '저장 중…' : form.id ? '문항 저장' : '문항 추가'}
              </button>
            </div>
          </div>
        )}

        <div className="op-lect-qlist">
          {items === null && <div className="op-logrow">불러오는 중…</div>}
          {items !== null && items.length === 0 && !loadErr && (
            <div className="op-logrow">
              문항이 없어요 — 문항이 없으면 학생이 체크포인트에서 진행할 수 없어요.
            </div>
          )}
          {(items ?? []).map((q) => (
            <div key={q.id} className="op-lect-qrow">
              <div className="op-lect-qmeta">
                <span className="op-mono">{q.position_sec}초</span>
                <span className={`op-sys-status op-sys-status--${q.status === 'active' ? 'ok' : 'warn'}`}>
                  {q.status === 'active' ? '공개' : 'draft'}
                </span>
                <span className="op-sys-status op-sys-status--neutral">{q.source === 'llm' ? 'AI' : '수동'}</span>
              </div>
              <div className="op-lect-qbody">
                <b>{q.prompt}</b>
                <div className="op-lect-qopts">
                  {q.options.map((o, i) => (
                    <span key={i} className={`op-lect-qopt${i === q.answer_index ? ' op-lect-qopt-ans' : ''}`}>
                      {i}. {o}
                    </span>
                  ))}
                </div>
                {q.explain && <small className="op-aimodel-desc">해설: {q.explain}</small>}
              </div>
              <div className="op-lect-actions">
                {q.status === 'draft' && (
                  <button className="op-btn op-btn--approve" onClick={() => approve(q)}>
                    승인
                  </button>
                )}
                <button className="op-btn op-btn--reject" onClick={() => openEdit(q)}>
                  수정
                </button>
                <button className="op-btn op-btn--reject op-lect-danger" onClick={() => remove(q)}>
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================= 자료실 모달 ================= */
function MaterialsModal({ lec, onClose }: { lec: OpsLecture; onClose: () => void }) {
  const [items, setItems] = useState<OpsLectureMaterial[] | null>(null);
  const [banner, setBanner] = useState('');
  const [mode, setMode] = useState<'link' | 'file'>('link');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  const load = () => {
    lectureApi
      .opsMaterials(lec.id)
      .then(setItems)
      .catch((e) => {
        setItems([]);
        setBanner(errorDetail(e, '자료 목록을 불러오지 못했어요.'));
      });
  };
  useEffect(load, [lec.id]);

  const add = async () => {
    if (!title.trim()) return setBanner('자료 제목은 필수예요.');
    setSaving(true);
    setBanner('');
    try {
      if (mode === 'link') {
        if (!/^https?:\/\//.test(url.trim())) throw new Error('http(s)로 시작하는 URL을 입력하세요.');
        await lectureApi.opsMaterialCreateLink(lec.id, { title: title.trim(), url: url.trim() });
      } else {
        if (!file) throw new Error('업로드할 파일을 선택하세요.');
        const fd = new FormData();
        fd.append('title', title.trim());
        fd.append('file', file);
        setProgress(0);
        await lectureApi.opsMaterialCreateFile(lec.id, fd, (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        });
      }
      setTitle('');
      setUrl('');
      setFile(null);
      setProgress(null);
      load();
    } catch (e) {
      setProgress(null);
      setBanner(e instanceof Error && !('response' in e) ? e.message : errorDetail(e, '자료 등록에 실패했어요.'));
    } finally {
      setSaving(false);
    }
  };

  const rename = async (m: OpsLectureMaterial) => {
    const next = window.prompt('자료 제목 수정', m.title);
    if (next == null || !next.trim() || next.trim() === m.title) return;
    try {
      await lectureApi.opsMaterialUpdate(lec.id, m.id, { title: next.trim() });
      load();
    } catch (e) {
      setBanner(errorDetail(e, '수정에 실패했어요.'));
    }
  };

  const remove = async (m: OpsLectureMaterial) => {
    if (!window.confirm(`'${m.title}' 자료를 삭제할까요?`)) return;
    try {
      await lectureApi.opsMaterialDelete(lec.id, m.id);
      load();
    } catch (e) {
      setBanner(errorDetail(e, '삭제에 실패했어요.'));
    }
  };

  return (
    <div className="op-bh-overlay" onClick={onClose}>
      <div className="op-formmodal op-lect-widemodal" onClick={(e) => e.stopPropagation()}>
        <div className="op-bh-modal-h">
          <span>
            <i className="ph-fill ph-folder-open" /> 자료실 — {lec.title}
          </span>
          <button className="op-bh-modal-x" onClick={onClose}>
            <i className="ph-bold ph-x" />
          </button>
        </div>

        <div className="op-lect-matform">
          <div className="op-lect-matmode">
            <button className={`op-btn ${mode === 'link' ? 'op-btn--approve' : 'op-btn--reject'}`} onClick={() => setMode('link')}>
              <i className="ph-bold ph-link" /> 링크
            </button>
            <button className={`op-btn ${mode === 'file' ? 'op-btn--approve' : 'op-btn--reject'}`} onClick={() => setMode('file')}>
              <i className="ph-bold ph-file-arrow-up" /> 파일
            </button>
          </div>
          <div className="op-form-grid">
            <label className="ox-field op-form-span2">
              제목
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 1강 학습지" />
            </label>
            {mode === 'link' ? (
              <label className="ox-field op-form-span2">
                URL
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
              </label>
            ) : (
              <label className="ox-field op-form-span2">
                파일 (pdf/zip/이미지/문서, 최대 50MB)
                <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            )}
          </div>
          {progress != null && (
            <div className="op-lect-progress">
              <div className="op-lect-progress-track">
                <div className="op-lect-progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <span>{progress < 100 ? `업로드 중… ${progress}%` : '서버에서 저장 확인 중…'}</span>
            </div>
          )}
          <div className="op-form-actions">
            <button className="op-btn op-btn--approve" disabled={saving} onClick={add}>
              <i className="ph-bold ph-plus" />
              {saving ? '등록 중…' : '자료 등록'}
            </button>
          </div>
        </div>

        {banner && (
          <div className="op-form-err op-lect-banner">
            <i className="ph-fill ph-warning-circle" /> {banner}
          </div>
        )}

        <div className="op-lect-qlist">
          {items === null && <div className="op-logrow">불러오는 중…</div>}
          {items !== null && items.length === 0 && <div className="op-logrow">등록된 자료가 없어요.</div>}
          {(items ?? []).map((m) => (
            <div key={m.id} className="op-lect-qrow">
              <div className="op-lect-qmeta">
                <span className="op-sys-status op-sys-status--neutral">{m.kind === 'link' ? '링크' : '파일'}</span>
              </div>
              <div className="op-lect-qbody">
                <b>{m.title}</b>
                <small className="op-aimodel-desc">
                  {m.kind === 'link' ? m.url : `${m.file_ext ?? ''} · ${fmtBytes(m.file_bytes)}`}
                </small>
              </div>
              <div className="op-lect-actions">
                <button className="op-btn op-btn--reject" onClick={() => rename(m)}>
                  수정
                </button>
                <button className="op-btn op-btn--reject op-lect-danger" onClick={() => remove(m)}>
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
