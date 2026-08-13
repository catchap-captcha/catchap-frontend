import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { lectureApi, thumbnailSrc, type OpsCourse } from '../../api/lectures';
import { COURSE_FIELDS, subjectLabel } from '../../components/student/interestTaxonomy';
import OpsNav from '../../components/ops/OpsNav';
import { ExamQuestionsModal, PricingModal } from './OpsLectures';
import './OpsApproval.css';
import './OpsRenewalShared.css';
import './OpsCourses.css';

// 코스 '분야' = 관심사·문제은행 필터와 공유하는 정본(interestTaxonomy COURSE_FIELDS).
// 별도 '분류(category)'는 폐지 — 분야 하나로 일원화했다(과목 필드도 화면에선 '분야'로 부른다).

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

  // 생성/수정 — 레퍼런스와 동일하게 모달이 아니라 표 위에 펼쳐지는 인라인 폼 하나.
  const [form, setForm] = useState<{
    mode: 'create' | 'edit';
    id?: string;
    title: string;
    subject: string; // = 분야. 화면 라벨은 '분야'(COURSE_FIELDS), 저장은 subject 값.
    description: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');

  const openCreate = () =>
    setForm({ mode: 'create', title: '', subject: COURSE_FIELDS[0]?.value ?? '일반', description: '' });
  const openEdit = (c: OpsCourse) => {
    // 레거시 과목(과학·사회 등)이 공통 분야로 흡수되면 그 분야(canonical)로 맞춰 보여준다
    // → 드롭다운에 '… (기존)' 중복 항목이 안 뜨고, 저장 시 정식 분야로 확정된다.
    const field = COURSE_FIELDS.find((f) => f.label === subjectLabel(c.subject));
    setForm({
      mode: 'edit',
      id: c.id,
      title: c.title,
      subject: field ? field.value : c.subject,
      description: c.description ?? '',
    });
  };
  const closeForm = () => {
    setForm(null);
    setFormErr('');
  };
  // 수정/새 코스 폼이 열리면 그 카드로 부드럽게 스크롤한다(아래 코스에서 '수정'을 눌러도 폼이 보이게).
  const formRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (form) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.id, form?.mode]);

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
          description: form.description.trim() || null,
        });
        say('코스를 만들었어요.');
      } else if (form.id) {
        await lectureApi.opsCourseUpdate(form.id, {
          title: form.title.trim(),
          subject: form.subject,
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
  // 코스 커버(대표 이미지) — 강의 없이도 코스 자체에 붙인다(코스 썸네일 기능).
  const [coverCourse, setCoverCourse] = useState<OpsCourse | null>(null);

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
            코스를 삭제해도 담긴 강의는 삭제되지 않고 '미분류'로 풀립니다. 분야를 바꾸면 그 코스의 강의·연습문항도 함께 옮겨가요.
          </span>
        </div>

        {toast && <div className="orn-toast"><i className="ph ph-check-circle" />{toast}</div>}

        {form && (
          <div className="orn-card crs-formcard" ref={formRef}>
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
                <label className="crs-form-lb">분야</label>
                <select
                  className="crs-form-sel"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                >
                  {COURSE_FIELDS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                  {/* 현재 값이 목록 밖(레거시 과학·사회 등)이면 선택이 유지되도록 항목을 덧붙인다 */}
                  {!COURSE_FIELDS.some((f) => f.value === form.subject) && (
                    <option value={form.subject}>{subjectLabel(form.subject)} (기존)</option>
                  )}
                </select>
                {form.mode === 'edit' && (
                  <p style={{ margin: '6px 2px 0', fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.4 }}>
                    분야를 바꾸면 이 코스의 강의·연습문항도 함께 옮겨가요.
                  </p>
                )}
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
            <span>코스</span><span>분야</span><span>강의</span><span>수강료</span><span>상태</span>
            <span>관리</span>
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
                  {c.description && <div className="crs-desc">{c.description}</div>}
                </div>
                <span className="crs-subject">{subjectLabel(c.subject)}</span>
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
                    <button
                      className="crs-abtn crs-abtn--edit"
                      disabled={busyId === c.id}
                      onClick={() => setCoverCourse(c)}
                      title="이 코스의 대표 커버 이미지를 올려요(강의 없어도 가능)"
                    >
                      <i className="ph ph-image" />커버
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

      {coverCourse && (
        <CourseCoverModal
          course={coverCourse}
          onClose={() => setCoverCourse(null)}
          onSaved={load}
          say={say}
        />
      )}
    </div>
  );
}

/** 코스 커버(대표 이미지) 업로드·제거 모달 — 강의 없이도 코스 자체에 붙는다(코스 썸네일 기능).
 *  코스당 1장, 16:9 권장. 저장 시 목록 재조회로 새 thumbnail_url 반영. */
function CourseCoverModal({
  course,
  onClose,
  onSaved,
  say,
}: {
  course: OpsCourse;
  onClose: () => void;
  onSaved: () => void;
  say: (m: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedUrl, setSavedUrl] = useState<string | null>(null); // 방금 저장한 커버 — 미리보기 즉시 반영
  const [savedPopup, setSavedPopup] = useState(false); // '코스 커버 사진이 수정되었습니다.' 팝업
  const cur = course.thumbnail_url ? thumbnailSrc(course.thumbnail_url) ?? null : null;
  const objUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(
    () => () => {
      if (objUrl) URL.revokeObjectURL(objUrl);
    },
    [objUrl],
  );
  const preview = objUrl ?? savedUrl ?? cur;

  const pick = (f: File | null) => {
    if (f && !/\.(jpe?g|png|webp)$/i.test(f.name))
      return say('jpg/png/webp 이미지만 올릴 수 있어요.');
    if (f && f.size > 5 * 1024 * 1024) return say('이미지는 5MB 이하만 올릴 수 있어요.');
    setFile(f);
  };
  const upload = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const updated = await lectureApi.opsUploadCourseThumbnail(course.id, file);
      // 모달을 닫지 않고, 방금 저장한 커버를 즉시 미리보기에 반영('커버 없음'이 아니라 사진이 뜨게).
      setSavedUrl(thumbnailSrc(updated.thumbnail_url) ?? null);
      setFile(null);
      setSavedPopup(true); // 저장 완료 팝업
      onSaved(); // 목록 갱신 — 학생 카드에도 반영
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } };
      say(err.response?.data?.detail ?? '업로드에 실패했어요.');
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await lectureApi.opsDeleteCourseThumbnail(course.id);
      say('코스 커버를 제거했어요.');
      onSaved();
      onClose();
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } };
      say(err.response?.data?.detail ?? '제거에 실패했어요.');
      setBusy(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        className="orn-card"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(520px, 94vw)', padding: 22 }}
      >
        <div className="crs-formcard-head">
          <i className="ph ph-image" />
          <h2>코스 커버 이미지</h2>
        </div>
        <p style={{ color: 'var(--ink-2)', fontSize: 13, margin: '8px 0 14px', lineHeight: 1.5 }}>
          학생 코스 카드에 보이는 대표 이미지예요. 강의가 없어도 붙일 수 있어요. 권장 16:9 ·
          jpg/png/webp · 5MB 이하.
        </p>
        <div
          style={{
            aspectRatio: '16 / 9',
            borderRadius: 12,
            overflow: 'hidden',
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
          }}
        >
          {preview ? (
            <img
              src={preview}
              alt="코스 커버 미리보기"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span
              style={{
                color: 'var(--ink-3)',
                fontSize: 13,
                display: 'flex',
                gap: 6,
                alignItems: 'center',
              }}
            >
              <i className="ph ph-image" />커버 없음 (자동 커버 사용)
            </span>
          )}
        </div>
        <label
          className="orn-btn orn-btn--secondary"
          style={{
            cursor: 'pointer',
            display: 'inline-flex',
            gap: 6,
            alignItems: 'center',
            marginBottom: 14,
          }}
        >
          <i className="ph ph-upload-simple" /> 이미지 선택
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: 'none' }}
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
        </label>
        <div className="crs-form-actions">
          {cur && !file && (
            <button className="orn-btn orn-btn--secondary" disabled={busy} onClick={remove}>
              <i className="ph ph-trash" /> 커버 제거
            </button>
          )}
          <button className="orn-btn orn-btn--secondary" disabled={busy} onClick={onClose}>
            취소
          </button>
          <button className="orn-btn orn-btn--primary" disabled={!file || busy} onClick={upload}>
            <i className="ph ph-check" /> {busy ? '저장 중…' : '저장'}
          </button>
        </div>
        {/* 저장 완료 팝업 — 카드 안에 두어(카드 stopPropagation) 팝업 클릭이 모달을 닫지 않게 한다. */}
        {savedPopup && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              setSavedPopup(false);
            }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,.55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1100,
              padding: 20,
            }}
          >
            <div
              className="orn-card"
              onClick={(e) => e.stopPropagation()}
              style={{ width: 'min(360px, 92vw)', padding: '26px 22px', textAlign: 'center' }}
            >
              <i className="ph-fill ph-check-circle" style={{ fontSize: 40, color: 'var(--ok)' }} />
              <p style={{ margin: '12px 0 18px', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
                코스 커버 사진이 수정되었습니다.
              </p>
              <button className="orn-btn orn-btn--primary" onClick={() => setSavedPopup(false)}>
                확인
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
