import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StudentLayout from '../../layouts/StudentLayout';
import { PATHS } from '../../routes/paths';
import { useAuth } from '../../hooks/useAuth';
import { lectureApi, type LectureItem, type StudentCourse } from '../../api/lectures';
import './StudentHome.css';

/**
 * 학생 홈 — 성인 시청검증 인강 대시보드(2026-07-20 재편).
 *
 * 왜: 종전 홈은 옛 아동 교육 제품 잔재(고양이 마스코트·유아 말투·초등 6과목 고정 설명·
 * 오늘의Q/추천문제/오답노트/성장리포트 같은 퀴즈-게임 개념)로 성인 인강과 어긋났다.
 * 실제 학습 데이터(내가 듣는 코스·이어보기·완주율·수료)를 중심으로 담백하게 재구성한다.
 * 데이터: lectureApi.list()(강의+내 진행)·lectureApi.courses()(코스+수료 요약).
 */
export default function StudentHome() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const [lectures, setLectures] = useState<LectureItem[] | null>(null);
  const [courses, setCourses] = useState<StudentCourse[] | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let alive = true;
    setState('loading');
    Promise.all([lectureApi.list(), lectureApi.courses()])
      .then(([ls, cs]) => {
        if (!alive) return;
        setLectures(Array.isArray(ls) ? ls : []);
        setCourses(Array.isArray(cs) ? cs : []);
        setState('ready');
      })
      .catch(() => alive && setState('error'));
    return () => {
      alive = false;
    };
  }, []);

  const name = (me?.name ?? '').trim() || '학습자';

  // 이어보기 — 시청 중인 강의 우선, 없으면 아직 안 끝낸 첫 강의
  const continueLec = useMemo(() => {
    if (!lectures) return null;
    return (
      lectures.find((l) => l.progress?.status === 'watching') ??
      lectures.find((l) => l.progress?.status !== 'done') ??
      null
    );
  }, [lectures]);

  const doneCount = useMemo(
    () => (lectures ?? []).filter((l) => l.progress?.status === 'done').length,
    [lectures],
  );
  const completedCourses = useMemo(
    () => (courses ?? []).filter((c) => c.exam?.passed).length,
    [courses],
  );

  // 코스별 진행 — 완주 강의 수 / 전체, 다음(이어볼) 강의
  const courseCards = useMemo(() => {
    if (!courses || !lectures) return [];
    return courses.map((c) => {
      const cl = lectures
        .filter((l) => l.course_id === c.id)
        .sort((a, b) => a.order_no - b.order_no);
      const done = cl.filter((l) => l.progress?.status === 'done').length;
      const total = cl.length || c.lecture_count;
      const next = cl.find((l) => l.progress?.status !== 'done') ?? cl[0] ?? null;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      return { c, done, total, pct, next };
    });
  }, [courses, lectures]);

  const goWatch = (id: string) => navigate(PATHS.STUDENT_LECTURE, { state: { id } });

  return (
    <StudentLayout className="sh-root" active="home">
      {/* ===== 인사 + 이어보기 ===== */}
      <section className="sh2-hero">
        <div className="sh2-hero-head">
          <h1 className="sh2-greet">안녕하세요, {name}님</h1>
          <p className="sh2-sub">듣던 강의를 이어서 학습해요.</p>
        </div>

        {state === 'ready' && continueLec ? (
          <div className="sh2-continue">
            <div className="sh2-continue-info">
              <span className="sh2-continue-tag">
                <i className="ph-fill ph-play-circle" />
                {continueLec.progress?.status === 'watching' ? '이어보기' : '다음 강의'}
              </span>
              <h2 className="sh2-continue-title">{continueLec.title}</h2>
              <span className="sh2-continue-meta">
                {continueLec.subject}
                {continueLec.question_count > 0 && ` · 확인문항 ${continueLec.question_count}개`}
              </span>
            </div>
            <button className="sh2-continue-btn" onClick={() => goWatch(continueLec.id)}>
              <i className="ph-bold ph-play" /> 이어서 보기
            </button>
          </div>
        ) : state === 'ready' ? (
          <div className="sh2-continue sh2-continue--empty">
            <div className="sh2-continue-info">
              <h2 className="sh2-continue-title">수강 중인 강의가 없어요</h2>
              <span className="sh2-continue-meta">강의 목록에서 학습을 시작해 보세요.</span>
            </div>
            <button
              className="sh2-continue-btn"
              onClick={() => navigate(PATHS.STUDENT_LECTURES)}
            >
              강의 둘러보기
            </button>
          </div>
        ) : null}
      </section>

      {/* ===== 학습 요약 ===== */}
      {state === 'ready' && (
        <section className="sh2-kpis">
          <div className="sh2-kpi">
            <span className="sh2-kpi-num">{courses?.length ?? 0}</span>
            <span className="sh2-kpi-lb">수강 코스</span>
          </div>
          <div className="sh2-kpi">
            <span className="sh2-kpi-num">{doneCount}</span>
            <span className="sh2-kpi-lb">완주 강의</span>
          </div>
          <div className="sh2-kpi">
            <span className="sh2-kpi-num">{completedCourses}</span>
            <span className="sh2-kpi-lb">수료 코스</span>
          </div>
        </section>
      )}

      {/* ===== 내 코스 ===== */}
      <section className="sh2-courses">
        <div className="sh2-sec-head">
          <h2 className="sh2-sec-title">
            <i className="ph-fill ph-stack" /> 내 코스
          </h2>
        </div>

        {state === 'loading' && <div className="sh2-empty">불러오는 중…</div>}
        {state === 'error' && (
          <div className="sh2-empty">강의를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</div>
        )}
        {state === 'ready' && courseCards.length === 0 && (
          <div className="sh2-empty">아직 배정된 코스가 없어요.</div>
        )}

        {state === 'ready' && courseCards.length > 0 && (
          <div className="sh2-course-grid">
            {courseCards.map(({ c, done, total, pct, next }) => {
              const passed = !!c.exam?.passed;
              const examReady = !!c.exam?.available && !passed;
              return (
                <article key={c.id} className="sh2-course">
                  <div className="sh2-course-top">
                    <span className="sh2-course-subj">{c.subject}</span>
                    {passed && <span className="sh2-course-done">수료 완료</span>}
                  </div>
                  <h3 className="sh2-course-title">{c.title}</h3>
                  {c.instructor_name && (
                    <span className="sh2-course-inst">{c.instructor_name} 강사</span>
                  )}
                  <div className="sh2-course-progress">
                    <div className="sh2-course-bar">
                      <div className="sh2-course-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="sh2-course-frac">
                      {done}/{total}강 완주 · {pct}%
                    </span>
                  </div>
                  {passed ? (
                    <button className="sh2-course-btn sh2-course-btn--ghost" disabled>
                      <i className="ph-bold ph-seal-check" /> 수료했어요
                    </button>
                  ) : examReady ? (
                    <button
                      className="sh2-course-btn sh2-course-btn--exam"
                      onClick={() => navigate(`${PATHS.STUDENT_COURSE_EXAM}?course=${c.id}`)}
                    >
                      <i className="ph-bold ph-exam" /> 수료 시험 보기
                    </button>
                  ) : next ? (
                    <button className="sh2-course-btn" onClick={() => goWatch(next.id)}>
                      <i className="ph-bold ph-play" />
                      {done > 0 ? '이어서 보기' : '학습 시작'}
                    </button>
                  ) : (
                    <button className="sh2-course-btn sh2-course-btn--ghost" disabled>
                      준비 중인 코스
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </StudentLayout>
  );
}
