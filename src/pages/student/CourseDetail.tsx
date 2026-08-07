import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import StudentLayout from '../../layouts/StudentLayout';
import { PATHS } from '../../routes/paths';
import { lectureApi, thumbnailSrc, type LectureItem, type StudentCourse } from '../../api/lectures';
import { fmtWon } from '../../api/payments';
import { formatClock } from './lectureSubjects';
import CourseCover from '../../components/course/CourseCover';
import { courseCoverUrl } from './demoCover';
import './CourseDetail.css';

/**
 * 코스 상세(커리큘럼) — 강의 둘러보기에서 코스를 누르면 여기로 온다. 소개·강사·가격과 강의 목록
 * (커리큘럼)을 먼저 보여주고, '수강신청'을 누르면 결제(Checkout)로 넘긴다(둘러보기→상세→결제).
 * 데이터는 기존 엔드포인트 재사용: courses()(코스+가격), list()(강의). ?id=로 코스를 고른다.
 */
export default function CourseDetail() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const courseId = params.get('id') || '';
  const [courses, setCourses] = useState<StudentCourse[] | null>(null);
  const [lectures, setLectures] = useState<LectureItem[] | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let alive = true;
    Promise.all([lectureApi.courses(), lectureApi.list()])
      .then(([cs, ls]) => {
        if (!alive) return;
        setCourses(Array.isArray(cs) ? cs : []);
        setLectures(Array.isArray(ls) ? ls : []);
        setState('ready');
      })
      .catch(() => alive && setState('error'));
    return () => {
      alive = false;
    };
  }, []);

  const course = useMemo(() => courses?.find((c) => c.id === courseId) ?? null, [courses, courseId]);
  const lecs = useMemo(
    () =>
      (lectures ?? [])
        .filter((l) => l.course_id === courseId)
        .sort((a, b) => a.order_no - b.order_no),
    [lectures, courseId],
  );

  const price = course?.pricing?.effective_price ?? null;
  const origPrice = course?.pricing?.price ?? null;
  const onSale =
    course?.pricing?.sale_price != null && origPrice != null && (price ?? 0) < origPrice;
  const isFree = price === 0;

  const goCheckout = () => navigate(`${PATHS.STUDENT_CHECKOUT}?course=${courseId}`);
  const goWatch = () => {
    const first = lecs[0];
    if (first) navigate(PATHS.STUDENT_LECTURE, { state: { id: first.id } });
  };

  const cta = course?.enrolled ? (
    <button className="cd-cta cd-cta--watch" onClick={goWatch}>
      <i className="ph-fill ph-play" /> 학습하기
    </button>
  ) : (
    <button className="cd-cta" onClick={goCheckout}>
      <i className="ph-bold ph-plus-circle" /> {isFree ? '무료로 수강신청' : '수강신청'}
    </button>
  );

  return (
    <StudentLayout className="cd-root">
      <section className="cd-wrap">
        <button className="cd-back" onClick={() => navigate(PATHS.STUDENT_LECTURES)}>
          <i className="ph-bold ph-arrow-left" /> 강의 둘러보기로
        </button>

        {state === 'loading' && <div className="cd-empty">불러오는 중…</div>}
        {state === 'error' && (
          <div className="cd-empty">코스를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</div>
        )}
        {state === 'ready' && !course && (
          <div className="cd-empty">
            <p>코스를 찾을 수 없어요.</p>
            <button className="cd-cta" onClick={() => navigate(PATHS.STUDENT_LECTURES)}>
              강의 둘러보기
            </button>
          </div>
        )}

        {state === 'ready' && course && (
          <>
            <div className="cd-hero">
              <CourseCover
                seed={course.id}
                label={course.title || course.subject}
                imageUrl={thumbnailSrc(course.thumbnail_url) ?? courseCoverUrl(course)}
                size="md"
                className="cd-cover"
              />
              <div className="cd-hero-info">
                {course.category && <span className="cd-cat">{course.category}</span>}
                <h1 className="cd-title">{course.title}</h1>
                <p className="cd-meta">
                  {course.instructor_name ? `${course.instructor_name} 강사 · ` : ''}총{' '}
                  {course.lecture_count || lecs.length}강
                </p>
                <div className="cd-price">
                  {price == null ? (
                    <span className="cd-price-now">가격 미정</span>
                  ) : isFree ? (
                    <span className="cd-price-free">무료</span>
                  ) : (
                    <>
                      <span className="cd-price-now">{fmtWon(price)}</span>
                      {onSale && origPrice != null && (
                        <s className="cd-price-orig">{fmtWon(origPrice)}</s>
                      )}
                    </>
                  )}
                </div>
                {cta}
                {course.enrolled && <span className="cd-enrolled">이미 신청한 코스예요</span>}
              </div>
            </div>

            {course.description && <p className="cd-desc">{course.description}</p>}

            <section className="cd-curriculum">
              <div className="cd-cur-head">
                <h2 className="cd-cur-title">
                  <i className="ph-fill ph-list-bullets" /> 커리큘럼
                </h2>
                <span className="cd-cur-count">{lecs.length}강</span>
              </div>
              {lecs.length === 0 ? (
                <div className="cd-empty">아직 등록된 강의가 없어요.</div>
              ) : (
                <ol className="cd-lec-list">
                  {lecs.map((l, i) => (
                    <li key={l.id} className="cd-lec">
                      <span className="cd-lec-num">{i + 1}</span>
                      <span className="cd-lec-title">{l.title}</span>
                      <span className="cd-lec-time">{formatClock(l.duration_sec)}</span>
                      <i
                        className={
                          course.enrolled
                            ? 'ph-fill ph-play-circle cd-lec-ic'
                            : 'ph-fill ph-lock-simple cd-lec-ic cd-lec-ic--lock'
                        }
                      />
                    </li>
                  ))}
                </ol>
              )}
              {!course.enrolled && lecs.length > 0 && (
                <p className="cd-cur-note">
                  <i className="ph-fill ph-lock-simple" /> 수강신청하면 전체 강의를 볼 수 있어요.
                </p>
              )}
            </section>

            {!course.enrolled && (
              <div className="cd-bottom">
                <button className="cd-cta cd-cta--lg" onClick={goCheckout}>
                  <i className="ph-bold ph-plus-circle" />
                  {isFree ? '무료로 수강신청' : `수강신청${price != null ? ` · ${fmtWon(price)}` : ''}`}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </StudentLayout>
  );
}
