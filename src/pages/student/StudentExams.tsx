import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StudentLayout from '../../layouts/StudentLayout';
import { PATHS } from '../../routes/paths';
import { lectureApi, thumbnailSrc, type StudentCourse } from '../../api/lectures';
import CourseCover from '../../components/course/CourseCover';
import './StudentExams.css';

/**
 * 수료시험 — 상단바 '수료' 그룹. 강의를 완주한 코스에서 수료 시험에 '응시'하는 화면.
 * 흐름: 강의 시청 → 수료시험 응시 → 통과 → 수료증 발급. 시험 응시 자체는 기존 CourseExam
 * (/student/course-exam?course=)이 맡고, 여기선 어떤 코스가 응시 가능한지 모아 보여준다.
 *
 * '수료 현황'(진행률·통계)과는 별개다 — 그건 나의 기록의 수료 현황 탭이 담당(상태 조회).
 * 이 페이지는 '지금 응시할 수 있는 시험'에 초점을 둔다(행동 우선).
 */
export default function StudentExams() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<StudentCourse[] | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let alive = true;
    lectureApi
      .courses()
      .then((cs) => {
        if (!alive) return;
        setCourses(Array.isArray(cs) ? cs : []);
        setState('ready');
      })
      .catch(() => alive && setState('error'));
    return () => {
      alive = false;
    };
  }, []);

  const examCourses = (courses ?? []).filter((c) => c.exam?.has_exam);
  // 행동 우선 정렬 — 진행 중(이어서) → 응시 전 → 잠김(강의 미완주) → 수료 완료.
  // '진행 중'은 시험을 시작해 일부 문항을 정복했지만 아직 통과 못 한 상태(mastered_count>0).
  const started = (c: StudentCourse) => (c.exam?.mastered_count ?? 0) > 0;
  const progress = examCourses.filter((c) => c.exam?.available && !c.exam?.passed && started(c));
  const fresh = examCourses.filter((c) => c.exam?.available && !c.exam?.passed && !started(c));
  const locked = examCourses.filter((c) => !c.exam?.available && !c.exam?.passed);
  const passed = examCourses.filter((c) => c.exam?.passed);
  const ordered = [...progress, ...fresh, ...locked, ...passed];

  const goExam = (id: string) => navigate(`${PATHS.STUDENT_COURSE_EXAM}?course=${id}`);

  return (
    <StudentLayout className="se-root">
      <section className="se-wrap">
        <div className="se-head">
          <h1 className="se-title">수료시험</h1>
          <p className="se-sub">
            강의를 완주하면 수료 시험에 응시할 수 있어요. 통과하면 수료증이 발급됩니다.
          </p>
        </div>

        {state === 'loading' && <div className="se-empty">불러오는 중…</div>}
        {state === 'error' && (
          <div className="se-empty">수료 시험 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</div>
        )}

        {state === 'ready' && examCourses.length === 0 && (
          <div className="se-empty">
            <i className="ph ph-exam se-empty-ic" />
            <p className="se-empty-txt">
              아직 수료 시험이 있는 코스가 없어요.
              <br />
              강의를 완주하면 수료 시험에 도전할 수 있어요.
            </p>
            <button className="se-cta" onClick={() => navigate(PATHS.STUDENT_HOME)}>
              <i className="ph-fill ph-compass" /> 강의 둘러보기
            </button>
          </div>
        )}

        {state === 'ready' && examCourses.length > 0 && (
          <div className="se-list">
            {ordered.map((c) => {
              const ex = c.exam!;
              // 5단계: 잠김(강의 미완주) → 응시 전(안 봄) → 진행 중(봤는데 미통과) → 수료 → 만점 수료
              const status: 'done' | 'progress' | 'new' | 'locked' = ex.passed
                ? 'done'
                : !ex.available
                  ? 'locked'
                  : ex.mastered_count > 0
                    ? 'progress'
                    : 'new';
              return (
                <div key={c.id} className={`se-card se-card--${status}`}>
                  <CourseCover
                    seed={c.id}
                    label={c.title || c.subject}
                    imageUrl={thumbnailSrc(c.thumbnail_url)}
                    size="sm"
                    className="se-cover"
                  />
                  <div className="se-body">
                    <div className="se-ctop">
                      <span className="se-ctitle">{c.title}</span>
                      {status === 'done' && (
                        <span className={`se-badge ${ex.perfect ? 'se-badge-perfect' : 'se-badge-done'}`}>
                          {ex.perfect ? '만점 수료' : '수료'}
                        </span>
                      )}
                      {status === 'new' && <span className="se-badge se-badge-ready">응시 전</span>}
                      {status === 'progress' && (
                        <span className="se-badge se-badge-progress">진행 중</span>
                      )}
                      {status === 'locked' && <span className="se-badge se-badge-locked">잠김</span>}
                    </div>
                    <div className="se-meta">
                      {status === 'done'
                        ? ex.perfect
                          ? `전 문항을 한 번에 다 맞혀 통과 · 문항 ${ex.question_count}개`
                          : `수료 시험 통과 · 문항 ${ex.question_count}개`
                        : status === 'new'
                          ? `문항 ${ex.question_count}개 · 아직 응시하지 않았어요`
                          : status === 'progress'
                            ? `${ex.mastered_count}/${ex.question_count} 정복 · 아직 통과 전이에요`
                            : `강의 ${ex.lectures_done}/${ex.lectures_total} 완주 시 열려요`}
                    </div>
                  </div>
                  {status === 'new' && (
                    <button className="se-btn" onClick={() => goExam(c.id)}>
                      <i className="ph-fill ph-exam" /> 수료시험 응시
                    </button>
                  )}
                  {status === 'progress' && (
                    <button className="se-btn" onClick={() => goExam(c.id)}>
                      <i className="ph-fill ph-arrow-right" /> 이어서 응시
                    </button>
                  )}
                  {status === 'done' && (
                    <button className="se-btn se-btn-ghost" onClick={() => goExam(c.id)}>
                      <i className="ph-fill ph-exam" /> 수료 시험 보기
                    </button>
                  )}
                  {status === 'locked' && (
                    <button className="se-btn se-btn-ghost" onClick={() => navigate(PATHS.STUDENT_MY_COURSES)}>
                      <i className="ph-fill ph-play" /> 이어서 학습
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </StudentLayout>
  );
}
