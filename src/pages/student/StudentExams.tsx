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

  // ★기준은 '내가 듣는 코스'다 — 종전엔 has_exam(시험 문항이 있는가)으로 걸렀는데,
  // 그러면 화면이 정확히 뒤집힌다: 수강도 안 한 코스가 '잠김'으로 늘어서고, 정작 내가
  // 완주한 코스는 시험 문항이 아직 없다는 이유로 ★사라진다. 실제로 그렇게 신고가 왔다
  // (2026-08-16: "다 봤는데 수료 시험이 안 떠요" — 그 코스는 목록에 아예 없었다).
  // 시험 문항 유무는 목록에서 빼는 근거가 아니라 카드 안에서 '준비 중'으로 말할 사실이다.
  const examCourses = (courses ?? []).filter((c) => c.enrolled && c.exam);
  // 행동 우선 정렬 — 진행 중(이어서) → 응시 전 → 잠김(강의 미완주) → 수료 완료.
  // '진행 중'은 시험을 시작해 일부 문항을 정복했지만 아직 통과 못 한 상태(mastered_count>0).
  const started = (c: StudentCourse) => (c.exam?.mastered_count ?? 0) > 0;
  const progress = examCourses.filter((c) => c.exam?.available && !c.exam?.passed && started(c));
  const fresh = examCourses.filter((c) => c.exam?.available && !c.exam?.passed && !started(c));
  // 잠김(강의 미완주)과 '시험 준비 중'(문항 없음)은 다른 사실이라 나눠서 보여 준다.
  const locked = examCourses.filter(
    (c) => !c.exam?.available && !c.exam?.passed && c.exam?.has_exam,
  );
  const pending = examCourses.filter((c) => !c.exam?.passed && !c.exam?.has_exam);
  const passed = examCourses.filter((c) => c.exam?.passed);
  const ordered = [...progress, ...fresh, ...locked, ...pending, ...passed];

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
              // 잠김(강의 미완주) → 준비 중(문항 없음) → 응시 전 → 진행 중 → 수료 → 만점 수료
              // ★'준비 중'을 '잠김'과 섞지 않는다: 잠김은 ★내가 할 일(더 보기)이 남은 것이고,
              //   준비 중은 ★내가 할 수 있는 게 없는 것이다. 같은 회색 뱃지로 뭉개면 완주자가
              //   "더 볼 게 없는데 왜 잠김이지?"로 갇힌다.
              const status: 'done' | 'progress' | 'new' | 'locked' | 'pending' = ex.passed
                ? 'done'
                : !ex.has_exam
                  ? 'pending'
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
                      {status === 'pending' && (
                        <span className="se-badge se-badge-locked">준비 중</span>
                      )}
                    </div>
                    <div className="se-meta">
                      {status === 'done'
                        ? ex.perfect
                          ? `전 문항을 한 번에 다 맞혀 통과 · 문항 ${ex.question_count}개`
                          : `수료 시험 통과 · 문항 ${ex.question_count}개`
                        : status === 'new'
                          ? `문항 ${ex.question_count}개 · 아직 응시하지 않았어요`
                          : status === 'progress'
                            ? `${ex.mastered_count}/${ex.question_count} 정답 · 아직 통과 전이에요`
                            : status === 'pending'
                              ? `강의 ${ex.lectures_done}/${ex.lectures_total} 완주 · 수료 시험을 준비하고 있어요`
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
