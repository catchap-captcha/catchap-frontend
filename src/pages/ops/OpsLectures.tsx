import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  API_ORIGIN,
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

/* (제거됨 0717) 시청 확인 간격 프리셋 — 출제 시점이 전부 핀(문항의 고정/구간)이 되면서
   무작위 간격 설정 자체가 사라졌다. 확인이 뜨는 시점은 문항 등록에서 지정한다. */

/** 초 → "29분 12초" 사람이 읽는 형태 (강사용 표시) */
function humanDur(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h ? `${h}시간` : '', m ? `${m}분` : '', s ? `${s}초` : ''].filter(Boolean).join(' ');
}

/** 바이트 → "247.3MB" */
function humanSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.round(bytes / 1024)}KB`;
}

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
  order_no: string;
  status: string;
}

const EMPTY_FORM: LectureForm = {
  title: '',
  subject: '국어',
  duration_sec: '',
  description: '',
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

/** 초 → "3:20" / "1:02:05" — 문항 출제 시점 표시용(강사는 플레이어 타임코드로 생각한다) */
function fmtMMSS(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** 출제 시점 입력 파서 — "200"(초)도, "3:20"·"1:02:05"(분:초)도 받는다. 실패 시 null.
 *  기존 초 단위 입력과의 하위호환을 위해 순수 숫자를 그대로 초로 해석한다. */
function parseSecInput(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  const m = /^(?:(\d+):)?(\d{1,2}):([0-5]?\d)$/.exec(s);
  if (!m) return null;
  const hh = m[1] ? Number(m[1]) : 0;
  const mm = Number(m[2]);
  if (m[1] && mm > 59) return null; // h:mm:ss일 때 분은 0~59
  return hh * 3600 + mm * 60 + Number(m[3]);
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
              강의는 <b>시청 검증이 동작하지 않아요</b>(확인 없이 끝까지 재생) — 업로드 후 꼭
              문항을 등록하세요.
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
                <span>
                  <b>{lec.active_question_count}</b>
                  <small className="op-lect-dim">/{lec.question_count}</small>
                  {/* 문항 0개면 체크포인트에서 낼 문제가 없어 시청 검증이 통째로 없는
                      강의가 된다(챌린지 4xx → 게이트가 뜨지 않음). 숫자만 보고 넘기기
                      쉬우니 눈에 띄게 경고한다. */}
                  {lec.active_question_count === 0 && (
                    <span className="lu-nowarn" title="확인 문항이 없어 시청 검증이 동작하지 않아요">
                      <i className="ph-fill ph-warning" /> 검증 없음
                    </span>
                  )}
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
          order_no: editing.order_no != null ? String(editing.order_no) : '',
          status: editing.status,
        }
      : EMPTY_FORM,
  );
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [autoDur, setAutoDur] = useState<'idle' | 'reading' | 'ok' | 'fail'>('idle');
  const [dragOver, setDragOver] = useState(false);
  const set = (k: keyof LectureForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  /* 파일 선택 시 브라우저가 영상 메타데이터에서 길이를 읽어 자동 기입한다.
     운영자가 초를 손으로 계산하면 틀리기 쉽고, 틀리면 시청 검증이 깨진다
     (짧게 넣으면 안 봤는데 완주 처리, 길게 넣으면 끝까지 봐도 완주 불가).
     판독 실패 시 입력란은 그대로 열어둬 수동 입력으로 진행할 수 있게 한다
     (ffprobe 등 서버 의존성 없이 처리 — 서버는 양수 검증만). */
  const pickFile = (f: File | null) => {
    setFile(f);
    if (!f) return setAutoDur('idle');
    setAutoDur('reading');
    const url = URL.createObjectURL(f);
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => {
      const d = Math.round(probe.duration);
      URL.revokeObjectURL(url);
      if (Number.isFinite(d) && d > 0) {
        setForm((prev) => ({ ...prev, duration_sec: String(d) }));
        setAutoDur('ok');
      } else {
        setAutoDur('fail');
      }
    };
    probe.onerror = () => {
      URL.revokeObjectURL(url);
      setAutoDur('fail');
    };
    probe.src = url;
  };

  const save = async () => {
    const duration = Number(form.duration_sec);
    if (!form.title.trim()) return setErr('제목은 필수예요.');
    if (!Number.isInteger(duration) || duration <= 0) return setErr('영상 길이(초)는 1 이상의 정수예요.');
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
          {/* ① 영상 — 먼저 올려야 길이가 자동으로 잡힌다 */}
          {!editing && (
            <div className="ox-field op-form-span2">
              강의 영상
              <div
                className={`lu-drop${dragOver ? ' lu-drop--over' : ''}${file ? ' lu-drop--has' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  pickFile(e.dataTransfer.files?.[0] ?? null);
                }}
                onClick={() => document.getElementById('lu-file')?.click()}
              >
                <input
                  id="lu-file"
                  type="file"
                  accept="video/mp4,video/webm"
                  hidden
                  onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                />
                {!file ? (
                  <>
                    <i className="ph-fill ph-upload-simple lu-drop-ico" />
                    <b>영상을 여기로 끌어다 놓거나 클릭해서 선택하세요</b>
                    <span className="lu-drop-sub">MP4 · WebM · 최대 500MB</span>
                  </>
                ) : (
                  <>
                    <i className="ph-fill ph-file-video lu-drop-ico lu-drop-ico--ok" />
                    <b>{file.name}</b>
                    <span className="lu-drop-sub">
                      {humanSize(file.size)}
                      {autoDur === 'reading' && ' · 길이 확인 중…'}
                      {autoDur === 'ok' && ` · ${humanDur(Number(form.duration_sec))} (자동 인식)`}
                      {autoDur === 'fail' && ' · 길이를 못 읽었어요 — 아래에 직접 입력'}
                    </span>
                    <span className="lu-drop-sub">다른 영상을 고르려면 클릭하세요</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 자동 인식 실패 또는 수정 모드일 때만 길이를 직접 다룬다 */}
          {(editing || autoDur === 'fail') && (
            <label className="ox-field">
              영상 길이(초)
              {editing && <span className="lu-help">{humanDur(Number(form.duration_sec))}</span>}
              <input
                value={form.duration_sec}
                onChange={(e) => set('duration_sec')(e.target.value)}
                placeholder="예: 1740 (29분)"
              />
            </label>
          )}

          {/* ② 기본 정보 */}
          <label className="ox-field op-form-span2">
            강의 제목
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
            강의 순서
            <span className="lu-help">비워두면 맨 뒤에 추가돼요</span>
            <input value={form.order_no} onChange={(e) => set('order_no')(e.target.value)} placeholder="예: 1" />
          </label>
          <label className="ox-field op-form-span2">
            강의 소개
            <span className="lu-help">학생 화면에 보이는 한 줄 소개예요</span>
            <input value={form.description} onChange={(e) => set('description')(e.target.value)} placeholder="예: 글의 짜임과 중심 문장을 배워요" />
          </label>

          {/* ③ 시청 확인 안내 — 확인이 뜨는 시점은 간격 설정이 아니라 문항 등록에서 지정한다 */}
          <div className="ox-field op-form-span2">
            시청 확인 문제
            <span className="lu-help">
              확인 문제가 뜨는 시점은 <b>문항 등록</b>에서 지정해요(정확한 시점 또는 구간).
              업로드 후 목록의 &lsquo;문항&rsquo;에서 등록하세요 — 문항이 없으면 시청 검증이
              동작하지 않아요.
            </span>
          </div>

          {editing && (
            <label className="ox-field">
              공개 상태
              <select value={form.status} onChange={(e) => set('status')(e.target.value)}>
                <option value="active">공개</option>
                <option value="hidden">숨김</option>
              </select>
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
  id: string | null; // null = 새 문항(저장하면 이미지 첨부가 열린다)
  position_sec: string;
  /** true = 구간 모드 — [시작, 끝] 안의 무작위 초에 출제. 전송 시 window_sec = 끝-시작.
   *  false = 고정(position_sec 정각에 반드시 출제). 모든 문항이 핀 — 풀(무작위) 모드는 없다. */
  windowed: boolean;
  /** 구간 끝 입력(초 또는 분:초) — windowed일 때만 사용 */
  window_end: string;
  prompt: string;
  /* 보기를 줄바꿈 textarea가 아니라 행 배열로 다룬다 — 이미지가 붙은 보기는 텍스트를
     비울 수 있는데(그림 전용 보기), textarea는 빈 줄을 표현·보존할 수 없고 빈 줄을
     걸러내면 보기 인덱스가 밀려 서버의 이미지(인덱스 키)와 어긋난다. */
  options: string[];
  /** 정답 보기 인덱스 목록(다중 선택 가능, 최소 1개) — 학생은 전부 담아야 정답(부분 정답 없음) */
  answer_indexes: number[];
  explain: string;
  status: string;
  /** 서버 재조회로 확인된 이미지 URL만 담는다(옵티미스틱 반영 금지 — 가짜 성공 방지) */
  promptImageUrl: string | null;
  optionImageUrls: (string | null)[];
  /** 서버와 인덱스가 일치하는 선두 보기 수 — 이 미만의 행만 이미지 첨부/표시가 안전하다.
      서버는 이미지를 '몇 번째 보기'로 기억한다: 행 추가(끝에 붙음)는 기존 행을 밀지 않지만,
      행 삭제는 그 뒤 행을 한 칸씩 당겨 저장 전 첨부가 엉뚱한 보기에 붙는다. 시작값은
      저장된 보기 수(그 밖은 서버에 없어 첨부 시 400), 삭제 시 삭제 지점까지 줄인다. */
  alignedUpTo: number;
}
const emptyQ = (): QForm => ({
  id: null,
  position_sec: '',
  windowed: false,
  window_end: '',
  prompt: '',
  options: ['', ''],
  answer_indexes: [0],
  explain: '',
  status: 'active',
  promptImageUrl: null,
  optionImageUrls: [null, null],
  alignedUpTo: 0,
});

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
  /* 이미지 업로드/삭제 in-flight 슬롯('prompt' | 'opt-{i}') — 동시에 하나만 */
  const [imgBusy, setImgBusy] = useState<string | null>(null);
  const [imgProgress, setImgProgress] = useState<number | null>(null);
  const [imgDragOver, setImgDragOver] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const imgTargetRef = useRef<{ slot: 'prompt' | 'option'; optionIndex?: number; key: string } | null>(null);
  /* 강의 화면 따오기 모달 — slot=position이면 시점 선택 전용(문항 저장 전에도 열 수 있다).
     prompt/option 첨부는 문항 id가 필요해 저장된 문항에서만 연다. */
  const [capture, setCapture] = useState<{
    slot: 'prompt' | 'option' | 'position';
    optionIndex?: number;
  } | null>(null);

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
    if (saving || generating || imgBusy != null) return; // in-flight 중 닫힘 방지 — 목록 카운트 유실 예방
    if (changedRef.current) onChanged(); // 문항 수 변경을 목록에 반영
    onClose();
  };

  const openEdit = (q: OpsLectureQuestion) => {
    setErr('');
    setForm({
      id: q.id,
      position_sec: String(q.position_sec),
      windowed: (q.window_sec ?? 0) > 0,
      // 구간 끝은 시작+길이로 환산해 보여준다 — 강사는 타임코드 두 개로 생각한다
      window_end: (q.window_sec ?? 0) > 0 ? fmtMMSS(q.position_sec + q.window_sec) : '',
      prompt: q.prompt ?? '',
      options: [...q.options],
      // 구버전 서버는 answer_indexes를 안 준다 — [answer_index]로 본다(하위호환)
      answer_indexes: q.answer_indexes ?? [q.answer_index],
      explain: q.explain ?? '',
      status: q.status,
      promptImageUrl: q.prompt_image_url ?? null,
      optionImageUrls: q.options.map((_, i) => q.option_image_urls?.[i] ?? null),
      alignedUpTo: q.options.length,
    });
  };

  const save = async () => {
    if (!form) return;
    const options = form.options.map((s) => s.trim());
    const pos = parseSecInput(form.position_sec);
    const ans = [...form.answer_indexes].sort((a, b) => a - b);
    if (!form.prompt.trim()) return setErr('문제는 꼭 적어야 해요.');
    if (options.length < 2 || options.length > 6) return setErr('보기는 2~6개여야 해요.');
    // 이미지가 붙은 보기만 텍스트 생략 허용(그림 전용 보기) — 서버 규칙과 동일
    const missing = options.findIndex((o, i) => !o && !form.optionImageUrls[i]);
    if (missing >= 0)
      return setErr(`${missing + 1}번 보기가 비어 있어요 — 텍스트를 쓰거나 이미지를 붙인 뒤 비우세요.`);
    if (ans.length === 0) return setErr('정답 보기를 최소 1개 지정하세요.');
    if (ans.some((a) => !(a >= 0 && a < options.length)))
      return setErr('정답으로 지정된 보기가 없어요.');
    if (pos == null || pos < 0)
      return setErr('출제 시점은 초(예: 200) 또는 분:초(예: 3:20) 형태로 입력하세요.');
    /* 시점·구간 범위는 서버(400)와 같은 규칙으로 제출 전에 막는다 — 문구도 서버와 동일하게.
       영상 밖 시점이 유일 문항이면 체크포인트가 안 잡혀 시청 검증이 통째로 조용히 꺼진다. */
    if (pos >= lec.duration_sec)
      return setErr(
        `출제 시점이 영상 길이를 벗어났습니다. 영상 안의 시점을 지정해 주세요. (영상 길이 ${fmtMMSS(lec.duration_sec)})`,
      );
    // 서버와 동일 규칙: 공개(active)만 1초 이상 강제 — draft는 '시점 미배치'(0)로 저장 가능
    if (form.status === 'active' && pos < 1)
      return setErr(
        '공개 문항은 출제 시점이 1초 이상이어야 합니다(0초는 아직 아무것도 보지 않은 지점이라 뜰 수 없어요).',
      );
    let windowSec = 0;
    if (form.windowed) {
      const end = parseSecInput(form.window_end);
      if (end == null)
        return setErr('구간 끝을 초(예: 340) 또는 분:초(예: 5:40) 형태로 입력하세요.');
      if (end < pos)
        return setErr('구간 끝이 구간 시작보다 앞이에요 — 시작 이후 시점으로 지정하세요.');
      // 구간 끝이 영상을 넘는 건 막지 않는다 — "여기부터 끝까지"는 정상 의도(서버가 잘라 씀)
      windowSec = end - pos;
    }
    setSaving(true);
    setErr('');
    try {
      const body = {
        position_sec: pos,
        // 구간→고정 전환 시 0을 명시로 보내 서버 값이 지워지게 한다(미전송 = 변경 없음)
        window_sec: windowSec,
        prompt: form.prompt.trim(),
        options,
        // 목록이 정본 — answer_index는 첫 값으로 함께 보내 구버전 서버에서도 깨지지 않는다
        answer_indexes: ans,
        answer_index: ans[0],
        explain: form.explain,
        status: form.status,
      };
      if (form.id) {
        await lectureApi.opsQuestionUpdate(lec.id, form.id, body);
        changedRef.current = true;
        setForm(null);
        load();
      } else {
        /* 신규 문항: 이미지 첨부에는 문항 id가 필요하다 — 저장 후 폼을 닫는 대신,
           재조회로 실재를 확인한 그 문항의 편집 폼으로 바로 전환해 이미지 첨부 단계를 잇는다
           (강사가 "저장→목록에서 다시 수정 클릭"을 안 해도 되게). */
        const created = await lectureApi.opsQuestionCreate(lec.id, body);
        changedRef.current = true;
        let fresh: OpsLectureQuestion[];
        try {
          fresh = await lectureApi.opsQuestions(lec.id);
        } catch {
          throw new Error(
            '저장은 됐을 수 있지만 목록 확인에 실패했어요 — 다시 저장하지 말고 모달을 닫았다 열어 확인하세요.',
          );
        }
        setItems(fresh);
        // 재조회가 성공했으니 이전 로드 실패 배너는 스테일 — 지워야 활성 0개 경고도 정확히 뜬다
        setLoadErr('');
        const mine = fresh.find((x) => x.id === created.id);
        if (!mine) throw new Error('저장 후 목록에서 문항을 확인하지 못했어요 — 새로고침 후 확인하세요.');
        openEdit(mine);
        setBannerOk(true);
        setBanner('문항을 저장했어요 — 이제 문제·보기에 이미지를 붙일 수 있어요.');
      }
    } catch (e) {
      setErr(e instanceof Error && !('response' in e) ? e.message : errorDetail(e, '문항 저장에 실패했어요.'));
    } finally {
      setSaving(false);
    }
  };

  /* ---- 이미지 첨부/삭제 — 저장된 문항에서만, 성공 표기는 재조회 확인 후에만 ---- */
  const pickImage = (slot: 'prompt' | 'option', optionIndex?: number) => {
    imgTargetRef.current = {
      slot,
      optionIndex,
      key: slot === 'prompt' ? 'prompt' : `opt-${optionIndex}`,
    };
    imgInputRef.current?.click();
  };

  /** 첨부 + 재조회 확인. 반환: null = 검증된 성공, string = 사용자에게 보여준 실패 사유
   *  (캡처 모달이 결과를 보고 닫을지/에러를 띄울지 정한다 — 성공 위장 금지) */
  const attachImage = async (
    slot: 'prompt' | 'option',
    optionIndex: number | undefined,
    file: File,
    key: string,
  ): Promise<string | null> => {
    if (!form?.id) return '문항을 먼저 저장해야 이미지를 붙일 수 있어요.';
    if (imgBusy != null) return '다른 이미지를 올리는 중이에요 — 끝난 뒤 다시 시도하세요.';
    const qid = form.id;
    setErr('');
    setImgBusy(key);
    setImgProgress(0);
    try {
      await lectureApi.attachQuestionImage(lec.id, qid, { slot, optionIndex, file }, (e) => {
        if (e.total) setImgProgress(Math.round((e.loaded / e.total) * 100));
      });
      // 성공 표기는 서버 재조회로 이미지가 실재함을 확인한 뒤에만 — 응답만 믿지 않는다.
      let fresh: OpsLectureQuestion[];
      try {
        fresh = await lectureApi.opsQuestions(lec.id);
      } catch {
        throw new Error(
          '업로드는 됐을 수 있지만 확인 재조회에 실패했어요 — 다시 올리지 말고 모달을 닫았다 열어 확인하세요.',
        );
      }
      setItems(fresh);
      const mine = fresh.find((x) => x.id === qid);
      const freshUrl =
        slot === 'prompt' ? mine?.prompt_image_url : mine?.option_image_urls?.[optionIndex ?? -1];
      if (!mine || !freshUrl)
        throw new Error('업로드 후 서버에서 이미지를 확인하지 못했어요 — 다시 시도하세요.');
      setForm((f) =>
        f && f.id === qid
          ? {
              ...f,
              promptImageUrl: slot === 'prompt' ? freshUrl : f.promptImageUrl,
              optionImageUrls:
                slot === 'option'
                  ? f.optionImageUrls.map((u, i) => (i === optionIndex ? freshUrl : u))
                  : f.optionImageUrls,
            }
          : f,
      );
      return null;
    } catch (e) {
      const msg =
        e instanceof Error && !('response' in e) ? e.message : errorDetail(e, '이미지 업로드에 실패했어요.');
      setErr(msg);
      return msg;
    } finally {
      setImgBusy(null);
      setImgProgress(null);
    }
  };

  const removeImage = async (slot: 'prompt' | 'option', optionIndex: number | undefined, key: string) => {
    if (!form?.id || imgBusy != null) return;
    /* 텍스트가 빈 보기의 이미지 삭제는 서버가 400으로 거부한다(보기가 통째로 빈다).
       서버에 보내기 전에 같은 규칙으로 막고 탈출 순서까지 안내한다 — 서버 문구만 보여주면
       "텍스트를 채워 주세요 → (폼에 입력) → 또 400" 순환에 빠진다(폼 입력은 저장 전이라 서버가 모른다). */
    if (slot === 'option' && optionIndex != null && !form.options[optionIndex]?.trim()) {
      setErr(
        '텍스트가 없는 보기의 이미지는 지울 수 없어요(보기가 통째로 비어요). 먼저 텍스트를 입력하고 "문항 저장"을 누른 뒤 삭제하세요.',
      );
      return;
    }
    if (!window.confirm(slot === 'prompt' ? '문제 이미지를 삭제할까요?' : '이 보기의 이미지를 삭제할까요?'))
      return;
    const qid = form.id;
    setErr('');
    setImgBusy(key);
    try {
      await lectureApi.deleteQuestionImage(lec.id, qid, { slot, optionIndex });
      // 삭제도 재조회로 확인 — 서버에 남아 있으면 사라졌다고 표시하지 않는다.
      let fresh: OpsLectureQuestion[];
      try {
        fresh = await lectureApi.opsQuestions(lec.id);
      } catch {
        throw new Error('삭제 확인 재조회에 실패했어요 — 모달을 닫았다 열어 확인하세요.');
      }
      setItems(fresh);
      const mine = fresh.find((x) => x.id === qid);
      const freshUrl =
        slot === 'prompt' ? mine?.prompt_image_url : mine?.option_image_urls?.[optionIndex ?? -1];
      if (!mine || freshUrl) throw new Error('삭제 후에도 서버에 이미지가 남아 있어요 — 다시 시도하세요.');
      setForm((f) =>
        f && f.id === qid
          ? {
              ...f,
              promptImageUrl: slot === 'prompt' ? null : f.promptImageUrl,
              optionImageUrls:
                slot === 'option'
                  ? f.optionImageUrls.map((u, i) => (i === optionIndex ? null : u))
                  : f.optionImageUrls,
            }
          : f,
      );
    } catch (e) {
      // 서버 거부 문구 그대로 노출. 단 '빈 텍스트 보기' 400인데 폼에는 텍스트가 있다면,
      // 그 텍스트가 아직 저장 전이라는 뜻 — 서버 문구만으로는 순환에 빠지므로 탈출 경로를 덧붙인다.
      let msg =
        e instanceof Error && !('response' in e) ? e.message : errorDetail(e, '이미지 삭제에 실패했어요.');
      if (slot === 'option' && msg.includes('텍스트가 빈 보기'))
        msg += ' 입력한 텍스트는 아직 저장 전이에요 — 먼저 "문항 저장"을 누른 뒤 다시 삭제하세요.';
      setErr(msg);
    } finally {
      setImgBusy(null);
    }
  };

  /* ---- 보기 행 추가/삭제 ---- */
  const addOption = () => {
    if (!form || form.options.length >= 6) return;
    // 끝에 붙이는 추가는 기존 행을 밀지 않는다 — alignedUpTo 유지(기존 행 첨부 계속 가능)
    setForm({
      ...form,
      options: [...form.options, ''],
      optionImageUrls: [...form.optionImageUrls, null],
    });
  };

  const removeOption = (i: number) => {
    if (!form) return;
    setErr('');
    if (form.options.length <= 2) return setErr('보기는 최소 2개예요.');
    /* 서버는 보기 이미지를 '몇 번째 보기'로 기억한다. 이 행을 지우면 뒤 보기들이 한 칸씩
       당겨져 이미지가 다른 보기에 붙거나 저장 시 삭제된다 — 어긋난 상태를 만들지 않게
       이 행(및 뒤 행)에 이미지가 있으면 먼저 이미지를 지우게 안내한다. */
    if (form.optionImageUrls.some((u, j) => u != null && j >= i))
      return setErr(
        `${i + 1}번 보기를 지우려면 그 보기부터 뒤쪽 보기의 이미지를 먼저 삭제하세요 — 보기가 당겨지면 이미지가 다른 보기에 붙어버려요.`,
      );
    // 지운 행은 정답 목록에서 빼고 뒤 행은 한 칸씩 당긴다 — 다 빠지면 1번 보기로 폴백(최소 1개 유지)
    const shifted = form.answer_indexes.filter((a) => a !== i).map((a) => (a > i ? a - 1 : a));
    setForm({
      ...form,
      options: form.options.filter((_, j) => j !== i),
      optionImageUrls: form.optionImageUrls.filter((_, j) => j !== i),
      answer_indexes: shifted.length > 0 ? shifted : [0],
      alignedUpTo: Math.min(form.alignedUpTo, i), // 삭제 지점 뒤 행은 당겨져 서버 인덱스와 어긋난다
    });
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

  /* 입력 중 실시간 환산·범위 안내용 — 저장 검증(save)과 같은 파서를 쓴다 */
  const posPreview = form ? parseSecInput(form.position_sec) : null;
  const endPreview = form && form.windowed ? parseSecInput(form.window_end) : null;
  /* 공개(active) 문항 수 — 0이면 이 강의는 확인이 아예 안 떠서 시청 검증이 조용히 꺼진다 */
  const activeCount = (items ?? []).filter((q) => q.status === 'active').length;
  /* 캡처 모달의 첨부 대상 — 시점 선택 전용(position)이면 null(선택·첨부 UI 숨김) */
  const capTarget =
    capture && capture.slot !== 'position'
      ? { slot: capture.slot, optionIndex: capture.optionIndex }
      : null;

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
          <button className="op-btn op-btn--approve" onClick={() => { setErr(''); setForm(emptyQ()); }}>
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
        {/* 활성 문항 0개 = 확인(캡차)이 아예 안 떠서 시청 검증이 조용히 꺼진다 — 모달 안에서도 경고 */}
        {items !== null && !loadErr && activeCount === 0 && (
          <div className="op-form-err op-lect-banner">
            <i className="ph-fill ph-warning" /> 공개(active) 문항이 없어 이 강의는 시청 검증이
            동작하지 않아요 — 학생이 확인 없이 끝까지 볼 수 있어요. 문항을 추가하거나 draft 문항을
            승인하세요.
          </div>
        )}
        {form && (
          <div className="op-lect-qform">
            <div className="op-form-grid">
              {/* 출제 방식 — 고정 시점·구간(모든 문항이 핀).
                  구간은 정확한 초를 강사가 재지 않아도 되고, 매번 같은 초에 뜨지 않아
                  학생이 "몇 분 몇 초에 문제가 뜬다"를 외우지 못한다. */}
              <div className="ox-field op-form-span2">
                출제 방식
                <div className="lu-presets">
                  <button
                    type="button"
                    className={`lu-preset${!form.windowed ? ' lu-preset--on' : ''}`}
                    onClick={() => setForm({ ...form, windowed: false })}
                  >
                    <b>
                      <i className="ph-fill ph-push-pin" /> 정확히 이 시점에
                    </b>
                    <span>학생이 이 시점에 닿는 순간 반드시 이 문항이 떠요</span>
                    <em>&ldquo;방금 본 내용&rdquo;을 그 대목 직후에 물을 때</em>
                  </button>
                  <button
                    type="button"
                    className={`lu-preset${form.windowed ? ' lu-preset--on' : ''}`}
                    onClick={() => setForm({ ...form, windowed: true })}
                  >
                    <b>
                      <i className="ph-fill ph-arrows-left-right" /> 이 구간 안에서
                    </b>
                    <span>구간 안의 무작위 초에 반드시 이 문항이 떠요</span>
                    <em>정확한 초를 안 재도 되고, 매번 달라 학생이 지점을 못 외워요</em>
                  </button>
                </div>
              </div>
              <label className="ox-field">
                {form.windowed ? '구간 시작' : '출제 시점'}
                <span
                  className={`lu-help${
                    posPreview != null &&
                    (posPreview >= lec.duration_sec ||
                      (form.status === 'active' && posPreview < 1))
                      ? ' lu-help--bad'
                      : ''
                  }`}
                >
                  {posPreview == null
                    ? '초(예: 200) 또는 분:초(예: 3:20)로 입력하세요'
                    : posPreview >= lec.duration_sec
                      ? `영상 길이(${fmtMMSS(lec.duration_sec)})를 벗어났어요 — 영상 안의 시점으로 지정하세요`
                      : form.status === 'active' && posPreview < 1
                        ? '공개 문항은 1초 이상이어야 해요 — 0초는 아직 아무것도 보지 않은 지점이에요'
                        : form.windowed
                          ? `${fmtMMSS(posPreview)}부터 구간 시작 · 영상 길이 ${fmtMMSS(lec.duration_sec)}`
                          : `${fmtMMSS(posPreview)}에 반드시 출제 · 영상 길이 ${fmtMMSS(lec.duration_sec)}`}
                </span>
                <input
                  value={form.position_sec}
                  onChange={(e) => setForm({ ...form, position_sec: e.target.value })}
                  placeholder="예: 3:20 또는 200"
                />
                <button
                  type="button"
                  className="lu-capbtn"
                  onClick={() => setCapture({ slot: 'position' })}
                >
                  <i className="ph-bold ph-monitor-play" /> 영상 보면서 시점 고르기
                </button>
              </label>
              {form.windowed && (
                <label className="ox-field">
                  구간 끝
                  <span
                    className={`lu-help${
                      endPreview != null && posPreview != null && endPreview < posPreview
                        ? ' lu-help--bad'
                        : ''
                    }`}
                  >
                    {endPreview == null
                      ? '초(예: 340) 또는 분:초(예: 5:40)로 입력하세요'
                      : posPreview != null && endPreview < posPreview
                        ? '구간 끝이 시작보다 앞이에요 — 시작 이후 시점으로 지정하세요'
                        : posPreview != null
                          ? `${fmtMMSS(posPreview)}~${fmtMMSS(endPreview)} 사이 무작위 초에 출제${
                              endPreview >= lec.duration_sec ? ' · 영상 끝까지로 잘라 써요' : ''
                            }`
                          : `${fmtMMSS(endPreview)}까지`}
                  </span>
                  <input
                    value={form.window_end}
                    onChange={(e) => setForm({ ...form, window_end: e.target.value })}
                    placeholder="예: 5:40 또는 340"
                  />
                </label>
              )}
              <label className="ox-field">
                상태
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="active">공개(active)</option>
                  <option value="draft">검수 대기(draft)</option>
                </select>
              </label>
              <label className="ox-field op-form-span2">
                문제
                <input value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} placeholder="예: 방금 화면에 나온 도형은 무엇이었나요?" />
              </label>

              {/* 문제 이미지 — 강의 화면 캡처를 붙이면 '실제로 본 사람만' 맞힐 수 있는 문제가 된다 */}
              <div className="ox-field op-form-span2">
                문제 이미지 (선택)
                <span className="lu-help">
                  강의 화면을 캡처해 붙이면 &ldquo;방금 화면에 나온 것&rdquo;을 물을 수 있어요 — 강의를 본
                  학생만 맞힐 수 있어요.
                </span>
                {!form.id ? (
                  <div className="lu-imgdrop lu-imgdrop--off">
                    <i className="ph-fill ph-image" />
                    <span>문항을 먼저 저장하면 이미지를 붙일 수 있어요</span>
                  </div>
                ) : form.promptImageUrl ? (
                  <div className="lu-imgthumb">
                    <img src={API_ORIGIN + form.promptImageUrl} alt="문제 이미지" />
                    <div className="lu-imgthumb-actions">
                      <button
                        type="button"
                        className="op-btn op-btn--reject"
                        disabled={imgBusy != null}
                        onClick={() => pickImage('prompt')}
                      >
                        <i className="ph-bold ph-arrows-clockwise" />
                        {imgBusy === 'prompt' ? `올리는 중… ${imgProgress ?? 0}%` : '교체'}
                      </button>
                      <button
                        type="button"
                        className="op-btn op-btn--reject op-lect-danger"
                        disabled={imgBusy != null}
                        onClick={() => removeImage('prompt', undefined, 'prompt')}
                      >
                        <i className="ph-bold ph-trash" />
                        삭제
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`lu-imgdrop${imgDragOver ? ' lu-imgdrop--over' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setImgDragOver(true); }}
                    onDragLeave={() => setImgDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setImgDragOver(false);
                      const f = e.dataTransfer.files?.[0];
                      if (f) attachImage('prompt', undefined, f, 'prompt');
                    }}
                    onClick={() => imgBusy == null && pickImage('prompt')}
                  >
                    <i className="ph-fill ph-image" />
                    <span>
                      {imgBusy === 'prompt'
                        ? `올리는 중… ${imgProgress ?? 0}%`
                        : '이미지를 끌어다 놓거나 클릭해서 첨부 — PNG·JPG·GIF·WebP, 최대 5MB'}
                    </span>
                  </div>
                )}
                {/* 파일 대신 강의 영상에서 직접 따오기 — 실제 화면 조각은 그 강의를 본
                    사람만 고를 수 있다(텍스트 보기는 상식으로 찍힌다). 이미 이미지가 있으면 교체. */}
                {form.id && (
                  <button
                    type="button"
                    className="lu-capbtn"
                    disabled={imgBusy != null}
                    onClick={() => setCapture({ slot: 'prompt' })}
                  >
                    <i className="ph-bold ph-crop" /> 강의 화면에서 따오기
                  </button>
                )}
              </div>

              {/* 보기 — 행마다 정답 라디오·텍스트·이미지 버튼. 이미지가 있으면 텍스트를 비워도
                  된다(그림 전용 보기 — 텍스트 라벨이 정답을 알려주는 걸 막는다). */}
              <div className="ox-field op-form-span2">
                보기 (2~6개)
                <span className="lu-help">
                  {form.id
                    ? '보기마다 이미지를 붙일 수 있어요. 이미지가 있는 보기는 텍스트를 지워도 돼요 — 그림만으로 낼 수 있어요.'
                    : '보기 이미지는 문항을 먼저 저장한 뒤 붙일 수 있어요.'}
                </span>
                <span className="lu-help">
                  정답을 여러 개 고를 수 있어요 — 학생은 고른 보기를 전부 담아야 정답이에요(부분 정답 없음).
                </span>
                <div className="lu-optlist">
                  {form.options.map((opt, i) => (
                    <div key={i} className={`lu-optrow${form.answer_indexes.includes(i) ? ' lu-optrow--ans' : ''}`}>
                      <label className="lu-optans" title="이 보기를 정답으로 지정 — 여러 개 지정 가능">
                        <input
                          type="checkbox"
                          checked={form.answer_indexes.includes(i)}
                          onChange={() =>
                            setForm({
                              ...form,
                              answer_indexes: form.answer_indexes.includes(i)
                                ? form.answer_indexes.filter((a) => a !== i)
                                : [...form.answer_indexes, i],
                            })
                          }
                        />
                        정답
                      </label>
                      <input
                        className="lu-optinput"
                        value={opt}
                        onChange={(e) =>
                          setForm({ ...form, options: form.options.map((o, j) => (j === i ? e.target.value : o)) })
                        }
                        placeholder={form.optionImageUrls[i] ? '(그림 보기 — 텍스트 없이 낼 수 있어요)' : `${i + 1}번 보기`}
                      />
                      {form.id && i < form.alignedUpTo ? (
                        form.optionImageUrls[i] ? (
                          <span className="lu-optimg">
                            <img src={API_ORIGIN + form.optionImageUrls[i]} alt={`${i + 1}번 보기 이미지`} />
                            <button
                              type="button"
                              className="lu-imgbtn"
                              title="이미지 교체"
                              disabled={imgBusy != null}
                              onClick={() => pickImage('option', i)}
                            >
                              <i className="ph-bold ph-arrows-clockwise" />
                            </button>
                            <button
                              type="button"
                              className="lu-imgbtn"
                              title="강의 화면에서 따와 교체"
                              disabled={imgBusy != null}
                              onClick={() => setCapture({ slot: 'option', optionIndex: i })}
                            >
                              <i className="ph-bold ph-crop" />
                            </button>
                            <button
                              type="button"
                              className="lu-imgbtn lu-imgbtn--danger"
                              title="이미지 삭제"
                              disabled={imgBusy != null}
                              onClick={() => removeImage('option', i, `opt-${i}`)}
                            >
                              <i className="ph-bold ph-trash" />
                            </button>
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="lu-imgbtn"
                              title="이 보기에 이미지 첨부"
                              disabled={imgBusy != null}
                              onClick={() => pickImage('option', i)}
                            >
                              {imgBusy === `opt-${i}` ? (
                                <span className="lu-imgbtn-busy">{imgProgress ?? 0}%</span>
                              ) : (
                                <i className="ph-bold ph-image" />
                              )}
                            </button>
                            <button
                              type="button"
                              className="lu-imgbtn"
                              title="강의 화면에서 따오기"
                              disabled={imgBusy != null}
                              onClick={() => setCapture({ slot: 'option', optionIndex: i })}
                            >
                              <i className="ph-bold ph-crop" />
                            </button>
                          </>
                        )
                      ) : form.id ? (
                        <span className="lu-optimg-note">저장 후 이미지 첨부</span>
                      ) : null}
                      <button
                        type="button"
                        className="lu-imgbtn lu-imgbtn--danger"
                        title="이 보기 삭제"
                        /* 업로드 in-flight 중 행 삭제 금지 — 삭제로 행이 당겨진 뒤 업로드가
                           완료되면 이미지가 엉뚱한 보기에 붙는다(alignedUpTo 가드를 우회하는 레이스) */
                        disabled={imgBusy != null}
                        onClick={() => removeOption(i)}
                      >
                        <i className="ph-bold ph-x" />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="lu-optadd" onClick={addOption} disabled={form.options.length >= 6}>
                  <i className="ph-bold ph-plus" /> 보기 추가
                </button>
              </div>

              <label className="ox-field op-form-span2">
                해설
                <span className="lu-help">
                  해설은 학생에게 표시되지 않아요(운영자 기록용) — 학생 게이트는 검증이라 정답·해설을 내려보내지 않아요.
                </span>
                <input value={form.explain} onChange={(e) => setForm({ ...form, explain: e.target.value })} />
              </label>
            </div>
            {/* 이미지 파일 선택 — 문제/보기 공용(imgTargetRef가 붙을 자리를 기억) */}
            <input
              ref={imgInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              hidden
              onChange={(e) => {
                const t = imgTargetRef.current;
                const f = e.target.files?.[0];
                e.target.value = ''; // 같은 파일 재선택도 change가 뜨게 초기화
                if (t && f) attachImage(t.slot, t.optionIndex, f, t.key);
              }}
            />
            {err && (
              <div className="op-form-err">
                <i className="ph-fill ph-warning-circle" /> {err}
              </div>
            )}
            <div className="op-form-actions">
              <button
                className="op-btn op-btn--reject"
                disabled={saving || imgBusy != null}
                onClick={() => setForm(null)}
              >
                {form.id ? '닫기' : '취소'}
              </button>
              <button className="op-btn op-btn--approve" disabled={saving || imgBusy != null} onClick={save}>
                <i className="ph-bold ph-check" />
                {saving ? '저장 중…' : form.id ? '문항 저장' : '문항 저장 후 이미지 첨부'}
              </button>
            </div>
          </div>
        )}

        <div className="op-lect-qlist">
          {items === null && <div className="op-logrow">불러오는 중…</div>}
          {items !== null && items.length === 0 && !loadErr && (
            <div className="op-logrow">등록된 문항이 없어요.</div>
          )}
          {(items ?? []).map((q) => (
            <div key={q.id} className="op-lect-qrow">
              <div className="op-lect-qmeta">
                {/* 고정=그 시점 정각, 구간=그 사이 무작위 초. draft 0초 = 시점 미배치 */}
                {(q.window_sec ?? 0) > 0 ? (
                  <span
                    className="op-mono lu-pinbadge"
                    title="이 구간 안의 무작위 초에 반드시 출제돼요 — 매번 달라 학생이 지점을 못 외워요"
                  >
                    <i className="ph-fill ph-arrows-left-right" /> {fmtMMSS(q.position_sec)}~
                    {fmtMMSS(q.position_sec + q.window_sec)} 구간
                  </span>
                ) : q.status === 'draft' && q.position_sec < 1 ? (
                  <span className="op-mono" title="아직 출제 시점이 없어요 — 수정에서 시점을 지정한 뒤 승인하세요">
                    시점 미배치
                  </span>
                ) : (
                  <span className="op-mono lu-pinbadge" title="이 시점에 닿는 순간 반드시 출제돼요">
                    <i className="ph-fill ph-push-pin" /> {fmtMMSS(q.position_sec)} 고정
                  </span>
                )}
                <span className={`op-sys-status op-sys-status--${q.status === 'active' ? 'ok' : 'warn'}`}>
                  {q.status === 'active' ? '공개' : 'draft'}
                </span>
                <span className="op-sys-status op-sys-status--neutral">{q.source === 'llm' ? 'AI' : '수동'}</span>
              </div>
              <div className="op-lect-qbody">
                <b>{q.prompt}</b>
                {q.prompt_image_url && (
                  <img className="lu-qthumb" src={API_ORIGIN + q.prompt_image_url} alt="문제 이미지" />
                )}
                <div className="op-lect-qopts">
                  {q.options.map((o, i) => (
                    <span
                      key={i}
                      className={`op-lect-qopt${(q.answer_indexes ?? [q.answer_index]).includes(i) ? ' op-lect-qopt-ans' : ''}`}
                    >
                      {i}.{' '}
                      {q.option_image_urls?.[i] && (
                        <img
                          className="lu-optchip-img"
                          src={API_ORIGIN + q.option_image_urls[i]!}
                          alt={`${i + 1}번 보기 이미지`}
                        />
                      )}
                      {o || (q.option_image_urls?.[i] ? '(그림 보기)' : '')}
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

        {capture && (
          <FrameCaptureModal
            lec={lec}
            attachTarget={capTarget}
            onAttach={
              capTarget
                ? (file: File) =>
                    attachImage(
                      capTarget.slot,
                      capTarget.optionIndex,
                      file,
                      capTarget.slot === 'prompt' ? 'prompt' : `opt-${capTarget.optionIndex}`,
                    )
                : null
            }
            onAttached={() => {
              setCapture(null);
              setBannerOk(true);
              setBanner('강의 화면에서 따온 이미지를 첨부했어요 — 서버 저장까지 확인됐어요.');
            }}
            onUsePosition={(sec) => setForm((f) => (f ? { ...f, position_sec: fmtMMSS(sec) } : f))}
            onClose={() => setCapture(null)}
          />
        )}
      </div>
    </div>
  );
}

/* ================= 강의 화면 따오기 모달 ================= */
/** 운영자 미리보기 스트림을 재생하며 ① 현재 시점을 출제 시점으로 가져오고
 *  ② 화면 위를 드래그해 그 영역을 잘라 문항 이미지로 첨부한다.
 *
 *  왜 화면을 따오나: 텍스트 보기("삼각형/사각형")는 강의를 안 본 사람도 상식으로 찍지만,
 *  실제 강의 화면 조각은 그 강의를 본 사람만 고를 수 있다 — 시청 검증의 가장 강한 무기.
 *
 *  크롭은 브라우저 canvas로 한다(ffmpeg 불필요). 좌표 변환: 드래그 사각형은 표시 크기
 *  (CSS px) 기준이고 원본 프레임(videoWidth/Height)은 보통 더 크므로 축마다 스케일을
 *  곱해 원본 좌표로 옮긴다. 영상을 width 고정·height auto로 그려 표시 상자가 원본
 *  비율과 정확히 일치한다(레터박스 없음 → 선형 변환만으로 충분).
 *
 *  canvas 오염(taint): 서버 CORS 헤더가 기대대로 안 붙으면 toBlob이 SecurityError를
 *  던진다 — 성공 위장 없이 "보안 정책으로 따올 수 없다"고 정직하게 실패 처리한다. */
function FrameCaptureModal({
  lec,
  attachTarget,
  onAttach,
  onAttached,
  onUsePosition,
  onClose,
}: {
  lec: OpsLecture;
  /** null = 시점 선택 전용(문항 저장 전) — 영역 선택·첨부 UI를 숨긴다 */
  attachTarget: { slot: 'prompt' | 'option'; optionIndex?: number } | null;
  /** 첨부 실행 — null 반환 = 서버 재조회까지 확인된 성공, string = 실패 사유 */
  onAttach: ((file: File) => Promise<string | null>) | null;
  onAttached: () => void;
  onUsePosition: (sec: number) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadMsg, setLoadMsg] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [selecting, setSelecting] = useState(false);
  /** 드래그 사각형 — 오버레이(=영상 표시 상자) 기준 CSS px */
  const [sel, setSel] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [capErr, setCapErr] = useState('');
  const [note, setNote] = useState('');

  const loadPreview = () => {
    setPhase('loading');
    setLoadMsg('');
    lectureApi
      .opsPreview(lec.id)
      .then((d) => {
        setStreamUrl(d.stream_url);
        setPhase('ready');
      })
      .catch((e) => {
        setLoadMsg(errorDetail(e, '미리보기 스트림을 발급받지 못했어요.'));
        setPhase('error');
      });
  };
  useEffect(loadPreview, [lec.id]);

  /* ---- 드래그 영역 선택 (pointer capture — 마우스가 빠르게 움직여도 놓치지 않는다) ---- */
  const startDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const p = { x: e.clientX - box.left, y: e.clientY - box.top };
    dragRef.current = p;
    e.currentTarget.setPointerCapture(e.pointerId);
    setSel({ x: p.x, y: p.y, w: 0, h: 0 });
  };
  const moveDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = dragRef.current;
    if (!s) return;
    const box = e.currentTarget.getBoundingClientRect();
    const cx = Math.min(Math.max(e.clientX - box.left, 0), box.width);
    const cy = Math.min(Math.max(e.clientY - box.top, 0), box.height);
    setSel({ x: Math.min(s.x, cx), y: Math.min(s.y, cy), w: Math.abs(cx - s.x), h: Math.abs(cy - s.y) });
  };
  const endDrag = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    // 클릭 수준의 미세 사각형은 의도가 아니다 — 버린다
    setSel((r) => (r && r.w >= 8 && r.h >= 8 ? r : null));
  };

  const beginSelect = () => {
    videoRef.current?.pause(); // 프레임이 흐르면 지정한 영역과 따온 화면이 어긋난다
    setSelecting(true);
    setSel(null);
    setCapErr('');
    setNote('');
  };

  const usePosition = () => {
    const v = videoRef.current;
    if (!v) return;
    const sec = Math.floor(v.currentTime);
    onUsePosition(sec);
    setNote(`출제 시점 입력에 ${fmtMMSS(sec)}을 채웠어요 — 모달을 닫으면 폼에서 확인할 수 있어요.`);
  };

  /* ---- 선택 영역을 원본 프레임 좌표로 변환 → canvas 크롭 → 첨부 ---- */
  const attachSelection = async () => {
    const v = videoRef.current;
    if (!v || !sel || !onAttach || busy) return;
    setCapErr('');
    setNote('');
    if (!v.videoWidth || !v.videoHeight) {
      setCapErr('영상 프레임을 아직 읽지 못했어요 — 잠시 재생한 뒤 다시 시도하세요.');
      return;
    }
    /* 표시 크기(CSS px) → 원본 프레임 좌표. 축마다 독립 스케일 — 표시 상자가 원본
       비율과 일치하면 두 값이 같고, 혹시 달라도 축별 선형 변환이라 결과는 여전히 정확하다. */
    const scaleX = v.videoWidth / v.clientWidth;
    const scaleY = v.videoHeight / v.clientHeight;
    let sx = Math.round(sel.x * scaleX);
    let sy = Math.round(sel.y * scaleY);
    let sw = Math.round(sel.w * scaleX);
    let sh = Math.round(sel.h * scaleY);
    // 반올림·경계 드래그로 프레임을 벗어나지 않게 클램프
    sx = Math.min(Math.max(sx, 0), v.videoWidth - 1);
    sy = Math.min(Math.max(sy, 0), v.videoHeight - 1);
    sw = Math.min(Math.max(sw, 1), v.videoWidth - sx);
    sh = Math.min(Math.max(sh, 1), v.videoHeight - sy);
    // 첨부 API 5MB 상한 대비 — 긴 변 1280px로 제한(문항 이미지 용도로 충분)
    const outScale = Math.min(1, 1280 / Math.max(sw, sh));
    const dw = Math.max(1, Math.round(sw * outScale));
    const dh = Math.max(1, Math.round(sh * outScale));
    const canvas = document.createElement('canvas');
    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setCapErr('이 브라우저에서 캔버스를 사용할 수 없어 화면을 따올 수 없어요.');
      return;
    }
    let blob: Blob | null = null;
    try {
      ctx.drawImage(v, sx, sy, sw, sh, 0, 0, dw, dh);
      blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
    } catch {
      // canvas 오염(taint) — CORS 헤더가 기대대로 안 붙은 경우. 가짜 성공 금지, 정직한 실패.
      setCapErr(
        '브라우저 보안 정책으로 화면을 따올 수 없습니다 — 서버 CORS 설정(자사 오리진 허용)을 확인해 주세요.',
      );
      return;
    }
    if (!blob) {
      setCapErr('화면을 이미지로 변환하지 못했어요 — 다시 시도해 주세요.');
      return;
    }
    if (blob.size > 5 * 1024 * 1024) {
      setCapErr('따온 이미지가 5MB를 넘어요 — 더 작은 영역을 지정해 주세요.');
      return;
    }
    const file = new File([blob], `lecture-frame-${Math.floor(v.currentTime)}s.png`, {
      type: 'image/png',
    });
    setBusy(true);
    const fail = await onAttach(file); // null = 서버 재조회까지 확인된 성공
    setBusy(false);
    if (fail) setCapErr(fail);
    else onAttached();
  };

  const title = attachTarget
    ? attachTarget.slot === 'prompt'
      ? '문제 이미지 — 강의 화면에서 따오기'
      : `${(attachTarget.optionIndex ?? 0) + 1}번 보기 — 강의 화면에서 따오기`
    : '강의 미리보기 — 출제 시점 고르기';

  return (
    /* 문항 모달 위에 겹쳐 뜬다 — 배경 클릭이 바깥 모달 close로 새지 않게 전파를 끊는다 */
    <div
      className="op-bh-overlay"
      onClick={(e) => {
        e.stopPropagation();
        if (!busy) onClose();
      }}
    >
      <div className="op-formmodal lu-cap-modal" onClick={(e) => e.stopPropagation()}>
        <div className="op-bh-modal-h">
          <span>
            <i className="ph-fill ph-crop" /> {title}
          </span>
          <button className="op-bh-modal-x" onClick={onClose} disabled={busy}>
            <i className="ph-bold ph-x" />
          </button>
        </div>
        <span className="lu-help">
          {lec.title} · 영상 길이 {fmtMMSS(lec.duration_sec)}
          {attachTarget
            ? ' — 원하는 장면에서 멈추고 영역을 드래그하면 그 부분이 이미지로 첨부돼요.'
            : ' — 원하는 장면에서 멈추고 시점을 가져오세요.'}
        </span>

        {phase === 'loading' && <div className="op-logrow">미리보기 스트림을 여는 중…</div>}
        {phase === 'error' && (
          <div className="op-form-err lu-cap-gap">
            <i className="ph-fill ph-warning-circle" /> {loadMsg}
            <button className="op-btn op-btn--reject" onClick={loadPreview}>
              다시 시도
            </button>
          </div>
        )}
        {phase === 'ready' && (
          <>
            <div className="lu-cap-stage">
              <video
                ref={videoRef}
                className="lu-cap-video"
                src={API_ORIGIN + streamUrl}
                crossOrigin="anonymous"
                controls={!selecting}
                preload="metadata"
                onError={() => {
                  setPhase('error');
                  setLoadMsg(
                    '영상을 불러오지 못했어요 — 미리보기 토큰이 만료됐거나 서버 CORS 설정 문제일 수 있어요. 다시 시도해 주세요.',
                  );
                }}
              />
              {selecting && (
                <div
                  className="lu-cap-select"
                  onPointerDown={startDrag}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                >
                  {sel ? (
                    <div
                      className="lu-cap-rect"
                      style={{ left: sel.x, top: sel.y, width: sel.w, height: sel.h }}
                    />
                  ) : (
                    <span className="lu-cap-hint">드래그해서 따올 영역을 지정하세요</span>
                  )}
                </div>
              )}
            </div>
            <div className="lu-cap-tools">
              <button type="button" className="op-btn op-btn--reject" onClick={usePosition} disabled={busy}>
                <i className="ph-bold ph-timer" /> 이 시점을 출제 시점으로
              </button>
              {attachTarget ? (
                !selecting ? (
                  <button type="button" className="op-btn op-btn--approve" onClick={beginSelect}>
                    <i className="ph-bold ph-crop" /> 이 장면에서 영역 지정
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="op-btn op-btn--reject"
                      disabled={busy}
                      onClick={() => {
                        setSelecting(false);
                        setSel(null);
                      }}
                    >
                      <i className="ph-bold ph-arrow-counter-clockwise" /> 다시 재생·이동
                    </button>
                    <button
                      type="button"
                      className="op-btn op-btn--approve"
                      disabled={busy || !sel}
                      onClick={attachSelection}
                    >
                      <i className="ph-bold ph-check" />
                      {busy ? '올리는 중…' : '선택 영역 첨부'}
                    </button>
                  </>
                )
              ) : (
                <span className="lu-cap-note">
                  이미지 첨부는 문항을 먼저 저장한 뒤에 할 수 있어요 — 여기서는 시점만 가져올 수 있어요.
                </span>
              )}
            </div>
            {note && (
              <div className="op-lect-banner-ok lu-cap-gap">
                <i className="ph-fill ph-check-circle" /> {note}
              </div>
            )}
            {capErr && (
              <div className="op-form-err lu-cap-gap">
                <i className="ph-fill ph-warning-circle" /> {capErr}
              </div>
            )}
          </>
        )}
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
