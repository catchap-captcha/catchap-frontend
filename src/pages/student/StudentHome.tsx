import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StudentLayout from '../../layouts/StudentLayout';
import { PATHS } from '../../routes/paths';
import { useAuth } from '../../hooks/useAuth';
import { lectureApi, thumbnailSrc, type LectureItem, type StudentCourse } from '../../api/lectures';
import CourseCover from '../../components/course/CourseCover';
import CountUp from '../../components/motion/CountUp';
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

  // '내 코스' = 실제 수강신청한 코스만. 종전엔 전체 코스를 노출해(enrolled 무시) 미신청 코스도
  // '내 코스'로 보였고, 추천 레일(미신청)과 같은 화면에서 겹치는 모순이 있었다 → enrolled로 좁힌다.
  const courseCards = useMemo(() => {
    if (!courses || !lectures) return [];
    return courses
      .filter((c) => c.enrolled)
      .map((c) => {
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
  const enrolledCount = useMemo(() => (courses ?? []).filter((c) => c.enrolled).length, [courses]);

  // 이어서 학습 레일 — 시청 중(watching)인 강의(발견·재방문 유도). 히어로의 1건과 겹쳐도
  // 여러 개를 가로 스크롤로 노출하는 게 목적(넷플릭스·Coursera '이어보기' 레일 패턴).
  const watchingLecs = useMemo(
    () => (lectures ?? []).filter((l) => l.progress?.status === 'watching'),
    [lectures],
  );
  // 추천(둘러보기) 레일 — 아직 신청 안 한 코스. 별점·인기 데이터가 없어 알고리즘을 지어내지 않고
  // '미신청 코스'라는 정직한 기준으로만 노출한다. 전부 신청했으면 레일을 숨긴다.
  const discoverCourses = useMemo(
    () => (courses ?? []).filter((c) => !c.enrolled),
    [courses],
  );

  const goWatch = (id: string) => navigate(PATHS.STUDENT_LECTURE, { state: { id } });

  // 시간대 인사 라벨(복제본 랩의 '오후 학습' eyebrow 이식) — 지어낸 값이 아니라 현재 시각 기준.
  const hour = new Date().getHours();
  const daypart = hour < 12 ? '오전' : hour < 18 ? '오후' : '저녁';

  return (
    <StudentLayout className="sh-root" active="home">
      {/* ===== 인사 + 벤토(이어보기 히어로 2×2 + 스탯) — 복제본 랩 레이아웃 이식 ===== */}
      <section className="sh2-top">
        <div className="sh2-hero-head">
          <p className="sh2-eyebrow">{daypart} 학습</p>
          <h1 className="sh2-greet">안녕하세요, {name}님</h1>
          <p className="sh2-sub">듣던 강의를 이어서 학습해요.</p>
        </div>

        {state === 'ready' && (
          <div className="sh2-bento">
            {continueLec ? (
              <button className="sh2-bento-hero" onClick={() => goWatch(continueLec.id)}>
                <div className="sh2-bento-cover">
                  <CourseCover
                    seed={continueLec.course_id || continueLec.id}
                    label={continueLec.title || continueLec.subject}
                    imageUrl={thumbnailSrc(continueLec.thumbnail_url)}
                    size="md"
                    className="sh2-bento-coverimg"
                  />
                  <span className="sh2-bento-tag">
                    <i className="ph-fill ph-play-circle" />
                    {continueLec.progress?.status === 'watching' ? '이어보기' : '다음 강의'}
                  </span>
                  <span className="sh2-bento-play"><i className="ph-fill ph-play" /></span>
                </div>
                <div className="sh2-bento-info">
                  <div className="sh2-bento-title">{continueLec.title}</div>
                  <div className="sh2-bento-meta">
                    {continueLec.subject}
                    {continueLec.question_count > 0 && ` · 확인문항 ${continueLec.question_count}개`}
                  </div>
                </div>
              </button>
            ) : (
              <div className="sh2-bento-hero sh2-bento-hero--empty">
                <div className="sh2-bento-info">
                  <div className="sh2-bento-title">수강 중인 강의가 없어요</div>
                  <div className="sh2-bento-meta">강의 목록에서 학습을 시작해 보세요.</div>
                  <button
                    className="sh2-continue-btn"
                    onClick={() => navigate(PATHS.STUDENT_LECTURES)}
                  >
                    강의 둘러보기
                  </button>
                </div>
              </div>
            )}

            <div className="sh2-stat">
              <span className="sh2-stat-chip"><i className="ph-fill ph-stack" /></span>
              <span className="sh2-stat-num"><CountUp value={enrolledCount} /></span>
              <span className="sh2-stat-lb">수강 코스</span>
            </div>
            <div className="sh2-stat">
              <span className="sh2-stat-chip"><i className="ph-fill ph-check-circle" /></span>
              <span className="sh2-stat-num"><CountUp value={doneCount} /></span>
              <span className="sh2-stat-lb">완주 강의</span>
            </div>
            <div className="sh2-stat sh2-stat--wide">
              <span className="sh2-stat-chip"><i className="ph-fill ph-seal-check" /></span>
              <span className="sh2-stat-num"><CountUp value={completedCourses} /></span>
              <span className="sh2-stat-lb">수료 코스</span>
            </div>
          </div>
        )}
      </section>

      {/* ===== 이어서 학습 레일 ===== */}
      {state === 'ready' && watchingLecs.length > 0 && (
        <section className="sh2-rail">
          <div className="sh2-sec-head">
            <h2 className="sh2-sec-title">
              <i className="ph-fill ph-play-circle" /> 이어서 학습
            </h2>
          </div>
          <div className="sh2-railscroll">
            {watchingLecs.map((l) => (
              <button key={l.id} className="sh2-railcard" onClick={() => goWatch(l.id)}>
                <CourseCover
                  seed={l.course_id || l.id}
                  label={l.title}
                  imageUrl={thumbnailSrc(l.thumbnail_url)}
                  size="md"
                  className="sh2-railcover"
                />
                <div className="sh2-railbody">
                  <span className="sh2-railtitle">{l.title}</span>
                  <span className="sh2-railmeta">{l.subject}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ===== 추천(둘러보기) 레일 — 미신청 코스 ===== */}
      {state === 'ready' && discoverCourses.length > 0 && (
        <section className="sh2-rail">
          <div className="sh2-sec-head">
            <h2 className="sh2-sec-title">
              <i className="ph-fill ph-compass" /> 이런 코스는 어때요
            </h2>
            <button className="sh2-sec-more" onClick={() => navigate(PATHS.STUDENT_LECTURES)}>
              전체 보기 <i className="ph-bold ph-arrow-right" />
            </button>
          </div>
          <div className="sh2-railscroll">
            {discoverCourses.map((c) => (
              <button
                key={c.id}
                className="sh2-railcard"
                onClick={() => navigate(PATHS.STUDENT_LECTURES)}
              >
                <CourseCover
                  seed={c.id}
                  label={c.title || c.subject}
                  imageUrl={thumbnailSrc(c.thumbnail_url)}
                  size="md"
                  className="sh2-railcover"
                />
                <div className="sh2-railbody">
                  <span className="sh2-railtitle">{c.title}</span>
                  <span className="sh2-railmeta">
                    {c.instructor_name ? `${c.instructor_name} 강사 · ` : ''}
                    {c.lecture_count}강
                  </span>
                </div>
              </button>
            ))}
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
          <div className="sh2-empty">
            아직 수강 중인 코스가 없어요. 위에서 관심 있는 코스를 시작해 보세요.
          </div>
        )}

        {state === 'ready' && courseCards.length > 0 && (
          <div className="sh2-course-grid">
            {courseCards.map(({ c, done, total, pct, next }) => {
              const passed = !!c.exam?.passed;
              const examReady = !!c.exam?.available && !passed;
              return (
                <article key={c.id} className="sh2-course">
                  <CourseCover
                    seed={c.id}
                    label={c.title || c.subject}
                    imageUrl={thumbnailSrc(c.thumbnail_url)}
                    size="md"
                    className="sh2-course-cover"
                  />
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
