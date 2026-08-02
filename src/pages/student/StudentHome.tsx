import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StudentLayout from '../../layouts/StudentLayout';
import { PATHS } from '../../routes/paths';
import { useAuth } from '../../hooks/useAuth';
import { lectureApi, thumbnailSrc, type LectureItem, type StudentCourse } from '../../api/lectures';
import { studentApi } from '../../api/students';
import CourseCover from '../../components/course/CourseCover';
import CountUp from '../../components/motion/CountUp';
import InterestOnboardModal from '../../components/student/InterestOnboardModal';
import './StudentHome.css';

/** 코스별 강의 묶음 — 홈의 '강의 둘러보기'가 코스 카드로 쓴다. */
interface HomeCourseGroup {
  course: StudentCourse;
  lectures: LectureItem[];
}

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

  // 관심사(온보딩) — interests가 null이면 최초 로그인이라 선택 모달을 띄운다. 실패해도 홈은 정상.
  const [interests, setInterests] = useState<string[] | null>(null);
  const [onboardNeeded, setOnboardNeeded] = useState(false);
  useEffect(() => {
    let alive = true;
    studentApi
      .getInterests()
      .then((d) => {
        if (!alive) return;
        setInterests(d.interests);
        if (!d.onboarded) setOnboardNeeded(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const saveOnboard = async (chosen: string[]) => {
    const res = await studentApi.saveInterests(chosen);
    setInterests(res.interests);
    setOnboardNeeded(false);
  };

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

  // 코스별 강의 묶음(order_no순). '내 코스'(수강 중)와 '이런 코스는 어때요'(미신청)가 이걸로
  // 강의 카드 그리드를 그린다 — 강의 카탈로그(강의 신청)와 같은 카드 룩을 홈에 그대로 얹는다.
  const groupsFor = (wantEnrolled: boolean): HomeCourseGroup[] => {
    if (!courses || !lectures) return [];
    return courses
      .filter((c) => !!c.enrolled === wantEnrolled)
      .map((c) => ({
        course: c,
        lectures: lectures
          .filter((l) => l.course_id === c.id)
          .sort((a, b) => a.order_no - b.order_no),
      }))
      .filter((g) => g.lectures.length > 0);
  };
  // '강의 둘러보기' = 아직 신청 안 한 코스(미리보기 잠금). 수강 중인 코스는 '내 강의' 화면으로 분리했다.
  const discoverGroups = useMemo(() => groupsFor(false), [courses, lectures]);
  const enrolledCount = useMemo(() => (courses ?? []).filter((c) => c.enrolled).length, [courses]);

  // 강의 둘러보기에 보여줄 전체 코스 — 미신청 + 수강 중을 모두 담는다(수강 중은 카드에서 배지로
  // 구분). 미신청을 앞, 수강 중을 뒤로 정렬(새로 신청할 코스가 먼저 눈에 띄게). courses()가 빈
  // 코스는 이미 제외하므로 여기 담기는 코스는 전부 강의가 있다.
  const allGroups = useMemo(() => {
    if (!courses || !lectures) return [];
    return courses
      .map((c) => ({
        course: c,
        lectures: lectures
          .filter((l) => l.course_id === c.id)
          .sort((a, b) => a.order_no - b.order_no),
      }))
      .filter((g) => g.lectures.length > 0)
      .sort((a, b) => Number(!!a.course.enrolled) - Number(!!b.course.enrolled));
  }, [courses, lectures]);

  // 관심사 추천 — 고른 관심사(코스 분류 category)에 맞는 미신청 코스를 홈 상단에 따로 노출한다.
  const recommendedGroups = useMemo(() => {
    if (!interests || interests.length === 0) return [];
    return discoverGroups.filter((g) =>
      interests.includes(g.course.category || g.course.subject || '기타'),
    );
  }, [discoverGroups, interests]);
  // 관심사 선택 모달 후보 — 전체 코스의 분류(처음엔 아무 코스도 안 들었으므로 신청 여부 무관).
  const allCats = useMemo(() => {
    const set = new Set<string>();
    (courses ?? []).forEach((c) => set.add(c.category || c.subject || '기타'));
    return [...set];
  }, [courses]);

  // 강의 둘러보기 분야 칩 — 미신청 코스의 subject로 필터(홈 버전 태그 필터). 전체 조건 필터는
  // '전체 보기'의 카탈로그(강의 신청)에서. 없는 분야를 만들지 않게 실제 코스 subject만 칩으로.
  const [browseCat, setBrowseCat] = useState('전체');
  const browseCats = useMemo(() => {
    // 브라우징 대분류(category) 기준 — 없으면 subject, 그것도 없으면 '기타'
    const cats = Array.from(
      new Set(allGroups.map((g) => g.course.category || g.course.subject || '기타')),
    );
    return ['전체', ...cats];
  }, [allGroups]);
  const shownDiscover =
    browseCat === '전체'
      ? allGroups
      : allGroups.filter(
          (g) => (g.course.category || g.course.subject || '기타') === browseCat,
        );

  // 이어서 학습 레일 — 시청 중(watching)인 강의(발견·재방문 유도). 히어로의 1건과 겹쳐도
  // 여러 개를 가로 스크롤로 노출하는 게 목적(넷플릭스·Coursera '이어보기' 레일 패턴).
  const watchingLecs = useMemo(
    () => (lectures ?? []).filter((l) => l.progress?.status === 'watching'),
    [lectures],
  );

  const goWatch = (id: string) => navigate(PATHS.STUDENT_LECTURE, { state: { id } });

  /** 코스 카드 — 홈 '강의 둘러보기' 미리보기. 미신청·수강 중 코스를 모두 보여주되 수강 중은 커버에
   *  '수강 중' 배지 + CTA를 '학습하기'로 바꿔 확실히 구분한다. 누르면 코스 상세(커리큘럼)로 가고,
   *  상세에서 미신청은 수강신청→결제, 수강 중은 학습하기로 이어진다. */
  const renderCourseCard = (g: HomeCourseGroup) => {
    const c = g.course;
    const enrolled = !!c.enrolled;
    return (
      <button
        key={c.id}
        type="button"
        className={`sh2-ccard${enrolled ? ' sh2-ccard--enrolled' : ''}`}
        onClick={() => navigate(`${PATHS.STUDENT_COURSE_DETAIL}?id=${c.id}`)}
      >
        <span className="sh2-ccover-wrap">
          <CourseCover
            seed={c.id}
            label={c.title || c.subject}
            imageUrl={thumbnailSrc(c.thumbnail_url)}
            size="md"
            className="sh2-ccover"
          />
          {enrolled && (
            <span className="sh2-ccard-badge">
              <i className="ph-fill ph-check-circle" /> 수강 중
            </span>
          )}
        </span>
        <span className="sh2-ccard-body">
          <span className="sh2-ccard-title">{c.title}</span>
          <span className="sh2-ccard-meta">
            {c.instructor_name ? `${c.instructor_name} 강사 · ` : ''}
            {c.lecture_count || g.lectures.length}강
          </span>
          <span className={`sh2-ccard-cta${enrolled ? ' sh2-ccard-cta--learn' : ''}`}>
            {enrolled ? (
              <>
                <i className="ph-fill ph-play" /> 학습하기
              </>
            ) : (
              <>
                <i className="ph-bold ph-arrow-right" /> 자세히 보기
              </>
            )}
          </span>
        </span>
      </button>
    );
  };

  return (
    <StudentLayout className="sh-root" active="home">
      {/* ===== 인사 + 이어보기 배너 + KPI — handoff `CatChap 학습 홈.dc.html` 구조 ===== */}
      <section className="sh2-top">
        <div className="sh2-hero-head">
          <h1 className="sh2-greet">안녕하세요, {name}님</h1>
          <p className="sh2-sub">듣던 강의를 이어서 학습해 보세요.</p>
        </div>

        {state === 'ready' && (
          <>
            {continueLec ? (
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
                    {continueLec.progress && continueLec.duration_sec > 0 &&
                      ` · ${Math.min(100, Math.round((continueLec.progress.watched_max_sec / continueLec.duration_sec) * 100))}% 시청`}
                  </span>
                </div>
                <button className="sh2-continue-btn" onClick={() => goWatch(continueLec.id)}>
                  <i className="ph-fill ph-play" /> 이어서 보기
                </button>
              </div>
            ) : (
              <div className="sh2-continue sh2-continue--empty">
                <div className="sh2-continue-info">
                  <h2 className="sh2-continue-title">수강 중인 강의가 없어요</h2>
                  <span className="sh2-continue-meta">강의 목록에서 학습을 시작해 보세요.</span>
                </div>
                <button className="sh2-continue-btn" onClick={() => navigate(PATHS.STUDENT_LECTURES)}>
                  강의 둘러보기
                </button>
              </div>
            )}

            <div className="sh2-kpis">
              <div className="sh2-kpi">
                <span className="sh2-kpi-num"><CountUp value={enrolledCount} /></span>
                <span className="sh2-kpi-lb">수강 코스</span>
              </div>
              <div className="sh2-kpi">
                <span className="sh2-kpi-num"><CountUp value={doneCount} /></span>
                <span className="sh2-kpi-lb">완주 강의</span>
              </div>
              <div className="sh2-kpi">
                <span className="sh2-kpi-num"><CountUp value={completedCourses} /></span>
                <span className="sh2-kpi-lb">수료 코스</span>
              </div>
            </div>
          </>
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
            {watchingLecs.map((l) => {
              // 어디까지 봤는지 — watched_max_sec / duration_sec. 0나눗셈·초과는 클램프.
              const pct =
                l.duration_sec > 0 && l.progress
                  ? Math.min(100, Math.max(0, Math.round((l.progress.watched_max_sec / l.duration_sec) * 100)))
                  : 0;
              return (
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
                    <div className="sh2-railprog">
                      <div className="sh2-railprog-bar">
                        <div className="sh2-railprog-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="sh2-railprog-pct">{pct}%</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ===== 관심사 추천 — 온보딩에서 고른 관심사(코스 분류)에 맞는 미신청 코스를 먼저 보여준다.
             관심사가 없거나(스킵) 맞는 코스가 없으면 섹션 자체를 숨긴다. ===== */}
      {state === 'ready' && recommendedGroups.length > 0 && (
        <section className="sh2-courses">
          <div className="sh2-sec-head">
            <h2 className="sh2-sec-title">
              <i className="ph-fill ph-sparkle" /> 관심사 추천
            </h2>
          </div>
          <div className="sh2-ccard-grid">{recommendedGroups.map((g) => renderCourseCard(g))}</div>
        </section>
      )}

      {/* ===== 강의 둘러보기 — 미신청 코스 미리보기 + 분야 칩 필터. '내 코스'는 상단 '내 학습 > 내 강의'로
             분리했고(2026-07-31 상단바 개편), 홈은 이어보기 + 새 강의 탐색 중심으로 둔다. ===== */}
      <section className="sh2-courses">
        <div className="sh2-sec-head">
          <h2 className="sh2-sec-title">
            <i className="ph-fill ph-compass" /> 강의 둘러보기
          </h2>
          <button className="sh2-sec-more" onClick={() => navigate(PATHS.STUDENT_LECTURES)}>
            전체 보기 <i className="ph-bold ph-arrow-right" />
          </button>
        </div>

        {state === 'loading' && <div className="sh2-empty">불러오는 중…</div>}
        {state === 'error' && (
          <div className="sh2-empty">강의를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</div>
        )}
        {state === 'ready' && allGroups.length === 0 && (
          <div className="sh2-empty">지금은 둘러볼 강의가 없어요.</div>
        )}

        {state === 'ready' && allGroups.length > 0 && (
          <>
            {/* 분야 칩 — 코스 subject로 클라이언트 필터(홈 버전 태그). 상세 조건 필터는 '전체 보기' 카탈로그에서. */}
            {browseCats.length > 1 && (
              <div className="sh2-cats">
                {browseCats.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`sh2-cat${browseCat === c ? ' sh2-cat-on' : ''}`}
                    onClick={() => setBrowseCat(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
            <div className="sh2-ccard-grid">
              {shownDiscover.map((g) => renderCourseCard(g))}
            </div>
          </>
        )}
      </section>

      {/* 최초 로그인 관심사 온보딩 — interests가 null일 때만(서버 판정). 코스 로드 후 후보를 넘긴다. */}
      {onboardNeeded && courses && (
        <InterestOnboardModal categories={allCats} onDone={saveOnboard} />
      )}
    </StudentLayout>
  );
}
