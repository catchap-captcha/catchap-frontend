import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StudentLayout from '../../layouts/StudentLayout';
import { PATHS } from '../../routes/paths';
import { lectureApi, thumbnailSrc, type LectureItem, type StudentCourse } from '../../api/lectures';
import CourseCover from '../../components/course/CourseCover';
import './MyCourses.css';

/**
 * 내 강의 — 상단바 '내 학습' 그룹. 신청한 코스를 수강 중/완료로 나눠 진도율·마지막 학습 위치와
 * '계속 학습' 버튼을 보여준다. 종전엔 이 내용이 학습 홈의 '내 코스'에 섞여 있었는데, 상단바를
 * 카테고리로 정리하며 전용 화면으로 분리했다(홈은 이어보기+둘러보기 중심).
 *
 * 데이터는 기존 엔드포인트 재사용: lectureApi.list()(강의+진행), lectureApi.courses()(코스+수료).
 */
interface CourseRow {
  course: StudentCourse;
  total: number;
  done: number;
  pct: number;
  continueLec: LectureItem | null;
  completed: boolean;
}

export default function MyCourses() {
  const navigate = useNavigate();
  const [lectures, setLectures] = useState<LectureItem[] | null>(null);
  const [courses, setCourses] = useState<StudentCourse[] | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [tab, setTab] = useState<'active' | 'done'>('active');
  const [canceling, setCanceling] = useState<string | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setState('loading');
    try {
      const [ls, cs] = await Promise.all([lectureApi.list(), lectureApi.courses()]);
      setLectures(Array.isArray(ls) ? ls : []);
      setCourses(Array.isArray(cs) ? cs : []);
      setState('ready');
    } catch {
      if (!opts?.silent) setState('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** 수강 취소 — 무료 코스는 서버가 바로 withdrawn 처리(진행 이력은 보존). 유료 코스는 서버가
   *  409(paid_enrollment)로 막으므로 결제 내역·환불 화면으로 안내한다(환불 규정은 그쪽에서 적용). */
  const cancelEnroll = async (courseId: string, title: string) => {
    if (canceling) return;
    if (!window.confirm(`'${title}' 수강을 취소할까요?\n진행 이력은 남아, 다시 신청하면 이어서 학습할 수 있어요.`))
      return;
    setCanceling(courseId);
    try {
      await lectureApi.unenrollCourse(courseId);
      await load({ silent: true });
    } catch (e) {
      const err = e as {
        response?: { status?: number; data?: { detail?: { reason?: string; message?: string } } };
      };
      const detail = err.response?.data?.detail;
      if (err.response?.status === 409 && detail?.reason === 'paid_enrollment') {
        window.alert(detail.message || '결제한 코스는 결제 취소 메뉴에서 환불해 주세요.');
        navigate(PATHS.STUDENT_ORDERS);
      } else {
        window.alert('수강 취소에 실패했어요. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setCanceling(null);
    }
  };

  const rows: CourseRow[] = useMemo(() => {
    if (!courses || !lectures) return [];
    return courses
      .filter((c) => c.enrolled)
      .map((c) => {
        const ls = lectures
          .filter((l) => l.course_id === c.id)
          .sort((a, b) => a.order_no - b.order_no);
        const total = ls.length;
        const done = ls.filter((l) => l.progress?.status === 'done').length;
        const pct = total ? Math.round((done / total) * 100) : 0;
        // 이어볼 강의 — 시청 중 우선, 없으면 아직 안 끝낸 첫 강의
        const continueLec =
          ls.find((l) => l.progress?.status === 'watching') ??
          ls.find((l) => l.progress?.status !== 'done') ??
          null;
        // 완료 = 전 강의 완주 또는 수료 시험 통과
        const completed = (total > 0 && done === total) || !!c.exam?.passed;
        return { course: c, total, done, pct, continueLec, completed };
      });
  }, [courses, lectures]);

  const active = rows.filter((r) => !r.completed);
  const done = rows.filter((r) => r.completed);
  const shown = tab === 'active' ? active : done;

  const goWatch = (id: string) => navigate(PATHS.STUDENT_LECTURE, { state: { id } });

  return (
    <StudentLayout className="mc-root">
      <section className="mc-wrap">
        <div className="mc-head">
          <h1 className="mc-title">내 강의</h1>
          <p className="mc-sub">신청한 강의를 이어서 학습하세요.</p>
        </div>

        {state === 'loading' && <div className="mc-empty">불러오는 중…</div>}
        {state === 'error' && (
          <div className="mc-empty">강의를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</div>
        )}

        {state === 'ready' && rows.length === 0 && (
          <div className="mc-empty">
            <p>아직 수강 중인 강의가 없어요.</p>
            <button className="mc-cta" onClick={() => navigate(PATHS.STUDENT_LECTURES)}>
              <i className="ph-fill ph-compass" /> 강의 둘러보기
            </button>
          </div>
        )}

        {state === 'ready' && rows.length > 0 && (
          <>
            <div className="mc-tabs">
              <button
                className={`mc-tab${tab === 'active' ? ' mc-tab-on' : ''}`}
                onClick={() => setTab('active')}
              >
                수강 중 {active.length}
              </button>
              <button
                className={`mc-tab${tab === 'done' ? ' mc-tab-on' : ''}`}
                onClick={() => setTab('done')}
              >
                완료 {done.length}
              </button>
            </div>

            {shown.length === 0 ? (
              <div className="mc-empty">
                {tab === 'active' ? '수강 중인 강의가 없어요.' : '완료한 강의가 없어요.'}
              </div>
            ) : (
              <div className="mc-list">
                {shown.map((r) => (
                  <div key={r.course.id} className="mc-card">
                    <CourseCover
                      seed={r.course.id}
                      label={r.course.title || r.course.subject}
                      imageUrl={thumbnailSrc(r.course.thumbnail_url)}
                      size="sm"
                      className="mc-cover"
                    />
                    <div className="mc-body">
                      <div className="mc-ctop">
                        <span className="mc-ctitle">{r.course.title}</span>
                        {r.completed && (
                          <span className="mc-badge">
                            {r.course.exam?.passed ? '수료' : '완주'}
                          </span>
                        )}
                      </div>
                      <div className="mc-meta">
                        {r.completed
                          ? `${r.total}강 완주${r.course.exam?.passed ? ' · 수료 시험 통과' : ''}`
                          : r.continueLec
                            ? `마지막 학습 · ${r.continueLec.title}`
                            : `${r.total}강`}
                      </div>
                      <div className="mc-progrow">
                        <div className="mc-bar">
                          <div className="mc-fill" style={{ width: `${r.pct}%` }} />
                        </div>
                        <span className="mc-pct">{r.pct}%</span>
                      </div>
                    </div>
                    {r.completed ? (
                      <button
                        className="mc-btn mc-btn-ghost"
                        onClick={() => navigate(`${PATHS.STUDENT_RECORDS}?tab=completion`)}
                      >
                        <i className="ph-fill ph-certificate" /> 수료 현황
                      </button>
                    ) : (
                      <div className="mc-actions">
                        <button
                          className="mc-btn"
                          onClick={() => r.continueLec && goWatch(r.continueLec.id)}
                          disabled={!r.continueLec}
                        >
                          <i className="ph-fill ph-play" /> 계속 학습
                        </button>
                        <button
                          className="mc-cancel"
                          onClick={() => cancelEnroll(r.course.id, r.course.title)}
                          disabled={canceling === r.course.id}
                        >
                          {canceling === r.course.id ? '취소 중…' : '수강 취소'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </StudentLayout>
  );
}
