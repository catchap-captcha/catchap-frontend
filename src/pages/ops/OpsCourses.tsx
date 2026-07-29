import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { lectureApi, type OpsCourse } from '../../api/lectures';
import OpsNav from '../../components/ops/OpsNav';
import { ExamQuestionsModal, PricingModal } from './OpsLectures';
import './OpsApproval.css';
import './OpsRenewalShared.css';
import './OpsCourses.css';

/** 학생 카탈로그 브라우징용 대분류 — 과목(subject, 생성 후 불변)과 달리 언제든 바꿀 수 있다.
 *  '강의 관리'의 코스 모달을 없애면서(상단 '코스 관리'로 일원화) 여기로 옮겨 왔다. */
const COURSE_CATEGORIES = ['법정의무교육', '자격증', '어학', '직무/기업교육', 'IT/개발', '기타'];

/**
 * 코스 관리 — CatChap '코스 관리' 리뉴얼 화면 그대로. 여러 강의를 코스로 묶어 학생 화면에
 * 하나의 과정으로 보여준다. 운영자(ops)는 감독만(공개/숨김) — 생성·내용 편집·삭제 버튼은
 * 서버 규약(require_content_author)과 동일하게 강사에게만 보인다.
 */
export default function OpsCourses() {
  const { me } = useAuth();
  const isOps = me?.role === 'ops';

  const [rows, setRows] = useState<OpsCourse[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [toast, setToast] = useState('');
  const say = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 2200);
  };

  const load = () => {
    setState('loading');
    lectureApi
      .opsCourses()
      .then((d) => {
        setRows(Array.isArray(d) ? d : []);
        setState('ready');
      })
      .catch(() => setState('error'));
  };
  useEffect(load, []);
  useEffect(() => {
    lectureApi
      .opsSubjects()
      .then(setSubjects)
      .catch(() => setSubjects([]));
  }, []);

  // 생성/수정 — 레퍼런스와 동일하게 모달이 아니라 표 위에 펼쳐지는 인라인 폼 하나.
  const [form, setForm] = useState<{
    mode: 'create' | 'edit';
    id?: string;
    title: string;
    subject: string;
    /** 브라우징용 대분류('' = 미분류). 과목과 달리 만든 뒤에도 바꿀 수 있다. */
    category: string;
    description: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');

  const openCreate = () =>
    setForm({ mode: 'create', title: '', subject: subjects[0] ?? '국어', category: '', description: '' });
  const openEdit = (c: OpsCourse) =>
    setForm({
      mode: 'edit',
      id: c.id,
      title: c.title,
      subject: c.subject,
      category: c.category ?? '',
      description: c.description ?? '',
    });
  const closeForm = () => {
    setForm(null);
    setFormErr('');
  };

  const submit = async () => {
    if (!form) return;
    if (!form.title.trim()) return setFormErr('코스 이름을 입력해 주세요.');
    setSaving(true);
    setFormErr('');
    try {
      if (form.mode === 'create') {
        await lectureApi.opsCourseCreate({
          title: form.title.trim(),
          subject: form.subject,
          category: form.category.trim() || null,
          description: form.description.trim() || null,
        });
        say('코스를 만들었어요.');
      } else if (form.id) {
        await lectureApi.opsCourseUpdate(form.id, {
          title: form.title.trim(),
          category: form.category.trim() || null,
          description: form.description.trim() || null,
        });
        say('코스를 수정했어요.');
      }
      setForm(null);
      load();
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } };
      setFormErr(err.response?.data?.detail ?? '저장에 실패했어요. 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const [busyId, setBusyId] = useState<string | null>(null);
  // 수료 시험 문항 — '강의 관리' 코스 관리 모달과 완전히 같은 컴포넌트를 그대로 띄운다.
  const [examCourse, setExamCourse] = useState<OpsCourse | null>(null);
  // 수강료 설정 — 같은 이유로 PricingModal 도 그대로 공유한다(두 화면의 동작이 갈리지 않게).
  const [priceCourse, setPriceCourse] = useState<OpsCourse | null>(null);

  const toggleStatus = async (c: OpsCourse) => {
    const next = c.status === 'active' ? 'hidden' : 'active';
    setBusyId(c.id);
    try {
      await lectureApi.opsCourseUpdate(c.id, { status: next });
      say(next === 'hidden' ? '코스를 숨겼어요.' : '코스를 공개했어요.');
      load();
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } };
      say(err.response?.data?.detail ?? '변경에 실패했어요.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (c: OpsCourse) => {
    if (
      !window.confirm(
        `'${c.title}' 코스를 삭제할까요? 소속 강의(${c.lecture_count}개)는 삭제되지 않고 '미분류'로 풀려요.`,
      )
    )
      return;
    setBusyId(c.id);
    try {
      const res = await lectureApi.opsCourseDelete(c.id);
      say(`코스를 삭제했어요. 강의 ${res.lectures_unassigned}개가 미분류로 풀렸어요.`);
      load();
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } };
      say(err.response?.data?.detail ?? '삭제에 실패했어요.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    // 헤더 셸·본문 폭은 콘솔 공통 규격(op-*) — 이 화면만 orn-* 셸 + 1040px이라 형제
    // 페이지들과 좌우 여백·제목 크기가 어긋났다.
    <div className="op-root">
      <OpsNav />
      <main className="op-main crs-page">
        <div className="op-head">
          <div>
            <h1 className="op-title">코스 관리</h1>
            <p className="op-sub" style={{ maxWidth: 620 }}>
              여러 강의를 코스로 묶어 학생 화면에서 하나의 과정으로 보여줍니다. 코스는 한 과목으로 고정됩니다.
            </p>
          </div>
          {!isOps && (
            <button className="op-btn op-btn--approve" onClick={openCreate}>
              <i className="ph ph-plus" />
              코스 만들기
            </button>
          )}
        </div>

        <div className="crs-banner">
          <i className="ph ph-info" />
          <span>
            코스를 삭제해도 담긴 강의는 삭제되지 않고 '미분류'로 풀립니다. 과목은 만든 뒤 변경할 수 없습니다.
          </span>
        </div>

        {toast && <div className="orn-toast"><i className="ph ph-check-circle" />{toast}</div>}

        {form && (
          <div className="orn-card crs-formcard">
            <div className="crs-formcard-head">
              <i className="ph ph-stack" />
              <h2>{form.mode === 'create' ? '새 코스 만들기' : '코스 수정'}</h2>
            </div>
            <div className="crs-form-grid">
              <div>
                <label className="crs-form-lb">코스 이름</label>
                <input
                  className="crs-form-in"
                  type="text"
                  placeholder="예: 초등 수학 완성"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div>
                <label className="crs-form-lb">과목</label>
                <select
                  className="crs-form-sel"
                  value={form.subject}
                  disabled={form.mode === 'edit'}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                >
                  {subjects.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="crs-form-lb">분류 (선택)</label>
                <select
                  className="crs-form-sel"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  <option value="">미분류</option>
                  {COURSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="crs-form-full">
              <label className="crs-form-lb">코스 소개 (선택)</label>
              <input
                className="crs-form-in"
                type="text"
                placeholder="예: 개념부터 차근차근 다지는 기초 과정"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            {formErr && <div className="crs-form-err"><i className="ph ph-warning-circle" />{formErr}</div>}
            <div className="crs-form-actions">
              <button className="orn-btn orn-btn--secondary" disabled={saving} onClick={closeForm}>취소</button>
              <button className="orn-btn orn-btn--primary" disabled={saving} onClick={submit}>
                <i className="ph ph-check" />
                {saving ? '저장 중…' : form.mode === 'create' ? '만들기' : '저장'}
              </button>
            </div>
          </div>
        )}

        <div className="orn-card crs-table">
          <div className="crs-thead">
            <span>코스</span><span>과목</span><span>강의</span><span>수강료</span><span>상태</span>
            <span style={{ textAlign: 'right' }}>관리</span>
          </div>

          {state === 'loading' && <div className="orn-loading"><i className="ph-duotone ph-spinner-gap" />불러오는 중…</div>}
          {state === 'error' && <div className="orn-empty"><i className="ph-duotone ph-warning-circle" /><p>코스 목록을 불러오지 못했어요.</p></div>}
          {state === 'ready' && rows.length === 0 && (
            <div className="orn-empty">
              <i className="ph-duotone ph-stack" />
              <p>{isOps ? '아직 등록된 코스가 없어요.' : "아직 만든 코스가 없어요. '코스 만들기'로 시작해 보세요."}</p>
            </div>
          )}
          {state === 'ready' &&
            rows.map((c) => (
              <div key={c.id} className="crs-row">
                <div style={{ minWidth: 0 }}>
                  <div className="crs-title">{c.title}</div>
                  {/* 분류는 열을 하나 더 만들지 않고 제목 아래에 붙인다(관리 버튼 자리를 지키려고) */}
                  {c.category && <div className="crs-cat">{c.category}</div>}
                  {c.description && <div className="crs-desc">{c.description}</div>}
                </div>
                <span className="crs-subject">{c.subject}</span>
                <span className="crs-count">{c.lecture_count}개</span>
                {/* 수강료 — 할인 중이면 실제 청구 금액 아래 정상가를 취소선으로 */}
                <span className="crs-price">
                  {!c.pricing ? (
                    '—'
                  ) : c.pricing.is_free ? (
                    <span className="crs-free">무료</span>
                  ) : (
                    <>
                      <b>{c.pricing.effective_price.toLocaleString('ko-KR')}원</b>
                      {c.pricing.sale_price != null && c.pricing.sale_price < c.pricing.price && (
                        <s>{c.pricing.price.toLocaleString('ko-KR')}원</s>
                      )}
                    </>
                  )}
                </span>
                <span className={`crs-badge crs-badge--${c.status === 'active' ? 'active' : 'hidden'}`}>
                  {c.status === 'active' ? '공개' : '숨김'}
                </span>
                <div className="crs-rowactions">
                  <button
                    className="crs-abtn crs-abtn--exam"
                    onClick={() => setExamCourse(c)}
                    title="이 코스의 수료 시험 문항을 관리해요"
                  >
                    <i className="ph ph-exam" />시험 문항
                  </button>
                  {!isOps && (
                    <button
                      className="crs-abtn crs-abtn--price"
                      disabled={busyId === c.id}
                      onClick={() => setPriceCourse(c)}
                      title="이 코스의 수강료를 정해요(학생 결제 금액의 정본)"
                    >
                      <i className="ph ph-tag" />가격 설정
                    </button>
                  )}
                  {!isOps && (
                    <button className="crs-abtn crs-abtn--edit" disabled={busyId === c.id} onClick={() => openEdit(c)}>
                      <i className="ph ph-pencil-simple" />수정
                    </button>
                  )}
                  {!isOps && (
                    <button
                      className="crs-abtn crs-abtn--icon"
                      disabled={busyId === c.id}
                      title="삭제"
                      onClick={() => remove(c)}
                    >
                      <i className="ph ph-trash" />
                    </button>
                  )}
                  <button
                    className="crs-abtn crs-abtn--icon"
                    disabled={busyId === c.id}
                    title={c.status === 'active' ? '숨기기' : '공개'}
                    onClick={() => toggleStatus(c)}
                  >
                    <i className={c.status === 'active' ? 'ph ph-eye-slash' : 'ph ph-eye'} />
                  </button>
                </div>
              </div>
            ))}
        </div>
      </main>

      {examCourse && (
        <ExamQuestionsModal
          course={examCourse}
          onClose={() => setExamCourse(null)}
          say={say}
        />
      )}

      {priceCourse && (
        <PricingModal
          course={priceCourse}
          onClose={() => setPriceCourse(null)}
          onSaved={load}
          say={say}
        />
      )}
    </div>
  );
}
