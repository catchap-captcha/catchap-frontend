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
import {
  interestsToSubjects,
  interestsToFieldKeys,
  MAX_INTEREST_FIELDS,
} from '../../components/student/interestTaxonomy';
import { DEMO_COURSES, DEMO_LECTURES, isDemoId, demoField } from './demoCourses';
import { courseCoverUrl } from './demoCover';
import './StudentHome.css';

/** 코스별 강의 묶음 — 추천·둘러보기 카드가 코스 단위로 쓴다. */
interface HomeCourseGroup {
  course: StudentCourse;
  lectures: LectureItem[];
}

/**
 * 학생 홈 — 시청 검증형 인강 대시보드(2026-08-05 재디자인).
 *
 * 구조: ① 이어서 학습 히어로(큰 카드) + 학습 요약 스트립 → ② 관심사 추천(가로 레일) →
 * ③ 통합 코스 둘러보기(검색+분야칩+그리드). 종전의 중복 섹션(이어보기 레일·수강 중 코스
 * 전용 섹션·별도 강의 둘러보기)을 걷어내 담백하게 정리했다. 색은 모노크롬 토큰 그대로.
 * 데이터: lectureApi.list()(강의+진행)·lectureApi.courses()(코스+수료 요약).
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

  // 이어서 학습 — 시청 중인 강의 우선, 없으면 아직 안 끝낸 첫 강의(히어로 1건).
  const continueLec = useMemo(() => {
    if (!lectures) return null;
    // ★내가 '수강신청한(enrolled)' 코스의 강의만 노출한다 — 카탈로그엔 있지만 미수강인 코스,
    //   삭제·숨김·미개설 코스, 그리고 코스 미배정(course_id 없음) 강의까지 전부 히어로에서 제외.
    //   (미분류 강의가 '다음 강의'로 잡혀 미수강 코스가 뜨던 문제 — leqsss94 제보. 실제 강사가
    //    코스를 만들고 강의를 올린, 내가 신청한 코스의 강의만 이어서 학습에 뜬다.)
    const enrolledCourseIds = new Set(
      (courses ?? []).filter((c) => c.enrolled).map((c) => c.id),
    );
    const live = lectures.filter((l) => !!l.course_id && enrolledCourseIds.has(l.course_id));
    return (
      live.find((l) => l.progress?.status === 'watching') ??
      live.find((l) => l.progress?.status !== 'done') ??
      null
    );
  }, [lectures, courses]);
  const continueCourse = useMemo(
    () => (continueLec ? (courses ?? []).find((c) => c.id === continueLec.course_id) ?? null : null),
    [continueLec, courses],
  );
  const continuePct =
    continueLec && continueLec.duration_sec > 0 && continueLec.progress
      ? Math.min(100, Math.max(0, Math.round((continueLec.progress.watched_max_sec / continueLec.duration_sec) * 100)))
      : 0;

  // 학습 요약 스트립 지표.
  const enrolledCount = useMemo(() => (courses ?? []).filter((c) => c.enrolled).length, [courses]);
  const doneCount = useMemo(
    () => (lectures ?? []).filter((l) => l.progress?.status === 'done').length,
    [lectures],
  );
  const completedCourses = useMemo(
    () => (courses ?? []).filter((c) => c.exam?.passed).length,
    [courses],
  );
  // 평균 진도 — 진행 기록이 있는 강의들의 시청 비율 평균(%).
  const avgProgress = useMemo(() => {
    const ls = (lectures ?? []).filter((l) => l.duration_sec > 0 && l.progress);
    if (!ls.length) return 0;
    const s = ls.reduce((a, l) => a + Math.min(1, l.progress!.watched_max_sec / l.duration_sec), 0);
    return Math.round((s / ls.length) * 100);
  }, [lectures]);

  // 코스별 강의 묶음(order_no순).
  const groupsFor = (wantEnrolled: boolean): HomeCourseGroup[] => {
    if (!courses || !lectures) return [];
    return courses
      .filter((c) => !!c.enrolled === wantEnrolled)
      .map((c) => ({
        course: c,
        lectures: lectures.filter((l) => l.course_id === c.id).sort((a, b) => a.order_no - b.order_no),
      }))
      .filter((g) => g.lectures.length > 0);
  };
  // 추천 후보 = 아직 신청 안 한(미리보기) 코스.
  const discoverGroups = useMemo(() => groupsFor(false), [courses, lectures]);

  // 코스 둘러보기 대상 — 수강 중 + 미신청 코스 전부(카드 배지·버튼으로 구분). 미신청을 앞에.
  const allCourseGroups = useMemo(() => {
    if (!courses || !lectures) return [];
    return courses
      .map((c) => ({
        course: c,
        lectures: lectures.filter((l) => l.course_id === c.id).sort((a, b) => a.order_no - b.order_no),
      }))
      .filter((g) => g.lectures.length > 0)
      .sort((a, b) => Number(!!a.course.enrolled) - Number(!!b.course.enrolled));
  }, [courses, lectures]);

  // 데모 코스 그룹 — 둘러보기·추천을 담백하게 채운다(실제 코스가 항상 앞). 데모 카드는 클릭해도 이동 안 함.
  const demoGroups = useMemo<HomeCourseGroup[]>(
    () =>
      DEMO_COURSES.map((c) => ({
        course: c,
        lectures: DEMO_LECTURES.filter((l) => l.course_id === c.id).sort((a, b) => a.order_no - b.order_no),
      })),
    [],
  );

  // 관심사 추천 — 고른 관심사(코스 분류)에 맞는 코스. 실제 코스는 분류(category)로만 매칭하고
  // (category 없으면 레거시 subject를 쓰되 기본값 '일반'=미분류는 제외 → 분류 안 된 코스가
  // 엉뚱한 관심사에 뜨는 것 방지), 데모는 고른 분야에서 골고루 뽑아 최대 RECO_TARGET개까지 채운다.
  const recommendedGroups = useMemo(() => {
    if (!interests || interests.length === 0) return [];
    const wantedSubjects = interestsToSubjects(interests);
    const realMatch = discoverGroups.filter((g) => {
      const key =
        g.course.category ||
        (g.course.subject && g.course.subject !== '일반' ? g.course.subject : null);
      return key != null && wantedSubjects.has(key);
    });
    const wantedFields = [...interestsToFieldKeys(interests)].slice(0, MAX_INTEREST_FIELDS);
    const demoByField = wantedFields.map((f) => demoGroups.filter((g) => demoField(g.course.id) === f));
    const maxLen = Math.max(0, ...demoByField.map((l) => l.length));
    const demoRoundRobin: HomeCourseGroup[] = [];
    for (let i = 0; i < maxLen; i++) {
      for (const list of demoByField) if (i < list.length) demoRoundRobin.push(list[i]);
    }
    const RECO_TARGET = 6; // 관심사 추천 전체 최대 개수(실제 매칭 우선 + 데모로 채움)
    return [...realMatch, ...demoRoundRobin].slice(0, RECO_TARGET);
  }, [discoverGroups, interests, demoGroups]);

  // 코스 둘러보기 — 검색 + 분야칩 + '더 보기'. 기본은 앞부분만 담백하게, 좁히거나 펼치면 전부.
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const [browseCat, setBrowseCat] = useState('전체');
  const [coursesExpanded, setCoursesExpanded] = useState(false);
  useEffect(() => {
    setCoursesExpanded(false);
  }, [browseCat, q]);

  const browseGroups = useMemo(() => [...allCourseGroups, ...demoGroups], [allCourseGroups, demoGroups]);
  const browseCats = useMemo(() => {
    const cats = Array.from(
      new Set(browseGroups.map((g) => g.course.category || g.course.subject || '기타')),
    );
    return ['전체', ...cats];
  }, [browseGroups]);
  const shownCourses = useMemo(() => {
    let list = browseGroups;
    if (browseCat !== '전체')
      list = list.filter((g) => (g.course.category || g.course.subject || '기타') === browseCat);
    if (q)
      list = list.filter((g) => {
        const c = g.course;
        return (
          (c.title || '').toLowerCase().includes(q) ||
          (c.instructor_name || '').toLowerCase().includes(q) ||
          (c.category || c.subject || '').toLowerCase().includes(q)
        );
      });
    return list;
  }, [browseGroups, browseCat, q]);
  const COURSE_LIMIT = 10;
  const coursesCollapsible = browseCat === '전체' && !q && shownCourses.length > COURSE_LIMIT;
  const coursesCapped = coursesCollapsible && !coursesExpanded;
  const visibleCourses = coursesCapped ? shownCourses.slice(0, COURSE_LIMIT) : shownCourses;
  const hiddenCourseCount = shownCourses.length - visibleCourses.length;

  const goWatch = (id: string) => navigate(PATHS.STUDENT_LECTURE, { state: { id } });

  // 코스의 이어보기 강의 id — 시청 중 → 안 끝낸 첫 강의 → 1강 순. 없으면 undefined.
  const courseResumeLecId = (cid: string): string | undefined => {
    const ls = (lectures ?? []).filter((l) => l.course_id === cid).sort((a, b) => a.order_no - b.order_no);
    const r =
      ls.find((l) => l.progress?.status === 'watching') ??
      ls.find((l) => l.progress?.status !== 'done') ??
      ls[0];
    return r?.id;
  };

  /** 코스 카드 — 추천·둘러보기 공용. 수강 중은 '이어 학습'(초록)+커리큘럼, 미신청은 커리큘럼+수강신청.
   *  데모 코스(id 'demo-')는 클릭해도 이동하지 않는다(발표용 채우기). */
  const renderCourseCard = (g: HomeCourseGroup) => {
    const c = g.course;
    const enrolled = !!c.enrolled;
    const demo = isDemoId(c.id);
    const lecCount = c.lecture_count ?? g.lectures.length; // 0이면 0 그대로(데모=영상 없음 → '0개 강의')
    const goCurriculum = () => {
      if (!demo) navigate(`${PATHS.STUDENT_COURSE_DETAIL}?id=${c.id}`);
    };
    const goEnroll = () => {
      if (!demo) navigate(`${PATHS.STUDENT_CHECKOUT}?course=${c.id}`);
    };
    const goResume = () => {
      if (demo) return;
      const rid = courseResumeLecId(c.id);
      if (rid) goWatch(rid);
      else goCurriculum();
    };
    return (
      <div key={c.id} className={`sh2-ccard${enrolled ? ' sh2-ccard--enrolled' : ''}`}>
        <button
          type="button"
          className="sh2-ccover-wrap"
          onClick={enrolled ? goResume : goCurriculum}
          aria-label={`${c.title} ${enrolled ? '이어 학습' : '커리큘럼 보기'}`}
        >
          <CourseCover
            seed={c.id}
            label={c.title || c.subject}
            imageUrl={thumbnailSrc(c.thumbnail_url) ?? (demo ? undefined : courseCoverUrl(c))}
            size="md"
            className="sh2-ccover"
          />
          {enrolled ? (
            <span className="sh2-ccard-badge">
              <i className="ph-fill ph-check-circle" /> 수강 중
            </span>
          ) : (
            <span className="sh2-ccard-badge sh2-ccard-badge--lock">
              <i className="ph-fill ph-lock-simple" /> 미신청
            </span>
          )}
          {/* 우상단 — 강의 유무/개수(좌상단 수강 상태 배지의 반대 모서리라 안 겹친다) */}
          {lecCount > 0 ? (
            <span className="sh2-ccard-lec">
              <i className="ph-fill ph-play" /> {lecCount}개 강의
            </span>
          ) : (
            <span className="sh2-ccard-lec sh2-ccard-lec--empty">0개 강의</span>
          )}
        </button>
        <div className="sh2-ccard-body">
          <span className="sh2-ccard-title">{c.title}</span>
          <span className="sh2-ccard-meta">
            {c.instructor_name ? `${c.instructor_name} 강사 · ` : ''}
            {lecCount > 0 ? `${lecCount}강` : '0강'}
          </span>
          <div className="sh2-ccard-actions">
            {enrolled ? (
              <>
                <button
                  type="button"
                  className="sh2-ccard-btn sh2-ccard-btn--learn"
                  onClick={goResume}
                >
                  <i className="ph-fill ph-play" /> 이어 학습
                </button>
                <button
                  type="button"
                  className="sh2-ccard-btn sh2-ccard-btn--ghost"
                  onClick={goCurriculum}
                >
                  <i className="ph-bold ph-list-bullets" /> 커리큘럼
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="sh2-ccard-btn sh2-ccard-btn--ghost"
                  onClick={goCurriculum}
                >
                  <i className="ph-bold ph-list-bullets" /> 커리큘럼
                </button>
                <button
                  type="button"
                  className="sh2-ccard-btn sh2-ccard-btn--primary"
                  onClick={goEnroll}
                >
                  <i className="ph-bold ph-shopping-cart-simple" /> 수강신청
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <StudentLayout className="sh-root" active="home">
      {/* ===== 히어로 — 이어서 학습 + 학습 요약 ===== */}
      <section className="sh3-hero">
        <p className="sh3-greet">
          다시 오셨어요, <b>{name}</b>님 👋 이어서 학습해 볼까요?
        </p>

        {state === 'loading' && (
          <div className="sh3-continue sh3-continue--empty">
            <div className="sh3-continue-body">
              <span className="sh3-continue-lec">불러오는 중…</span>
            </div>
          </div>
        )}
        {state === 'error' && (
          <div className="sh3-continue sh3-continue--empty">
            <div className="sh3-continue-body">
              <span className="sh3-continue-lec">학습 정보를 불러오지 못했어요.</span>
              <span className="sh3-continue-meta">잠시 후 다시 시도해 주세요.</span>
            </div>
          </div>
        )}

        {state === 'ready' &&
          (continueLec ? (
            <div className="sh3-continue">
              <div className="sh3-continue-coverwrap">
                <CourseCover
                  seed={continueLec.course_id || continueLec.id}
                  label={continueLec.title}
                  imageUrl={
                    // 강의 자체 썸네일 → (없으면) 코스 업로드 커버 → (없으면) 생성 커버.
                    // 다른 카드들과 달리 이 히어로만 코스 폴백이 빠져 있어, 강의 썸네일이 null이면
                    // 검은 생성커버(모노크롬 그라데이션)만 떠 '썸네일 없음'처럼 보였다.
                    thumbnailSrc(continueLec.thumbnail_url) ??
                    (continueCourse
                      ? (thumbnailSrc(continueCourse.thumbnail_url) ??
                        (isDemoId(continueCourse.id) ? undefined : courseCoverUrl(continueCourse)))
                      : undefined)
                  }
                  size="md"
                  className="sh3-continue-cover"
                />
                <span className="sh3-vchip">
                  <span className="sh3-vdot" /> 시청 검증 학습
                </span>
                <button
                  type="button"
                  className="sh3-continue-play"
                  onClick={() => goWatch(continueLec.id)}
                  aria-label="이어 보기"
                >
                  <i className="ph-fill ph-play" />
                </button>
              </div>
              <div className="sh3-continue-body">
                <span className="sh3-continue-kicker">
                  {continueLec.progress?.status === 'watching' ? '이어서 학습' : '다음 강의'}
                </span>
                {continueCourse && (
                  <span className="sh3-continue-course">
                    {continueCourse.title}
                    {continueCourse.instructor_name ? ` · ${continueCourse.instructor_name} 강사` : ''}
                  </span>
                )}
                <span className="sh3-continue-lec">{continueLec.title}</span>
                <div className="sh3-bar">
                  <i style={{ width: `${continuePct}%` }} />
                </div>
                <span className="sh3-continue-meta">
                  진도 {continuePct}%
                  {continueLec.question_count > 0 && ` · 확인문항 ${continueLec.question_count}개`}
                </span>
                <div className="sh3-continue-actions">
                  <button
                    type="button"
                    className="sh3-btn sh3-btn-primary"
                    onClick={() => goWatch(continueLec.id)}
                  >
                    <i className="ph-fill ph-play" /> 이어 보기
                  </button>
                  {continueCourse && !isDemoId(continueCourse.id) && (
                    <button
                      type="button"
                      className="sh3-btn sh3-btn-ghost"
                      onClick={() => navigate(`${PATHS.STUDENT_COURSE_DETAIL}?id=${continueCourse.id}`)}
                    >
                      커리큘럼
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="sh3-continue sh3-continue--empty">
              <div className="sh3-continue-body">
                <span className="sh3-continue-kicker">시작해 볼까요</span>
                <span className="sh3-continue-lec">아직 수강 중인 강의가 없어요</span>
                <span className="sh3-continue-meta">관심 있는 코스를 둘러보고 학습을 시작해 보세요.</span>
                <div className="sh3-continue-actions">
                  <button
                    type="button"
                    className="sh3-btn sh3-btn-primary"
                    onClick={() =>
                      document.getElementById('sh2-browse')?.scrollIntoView({ behavior: 'smooth' })
                    }
                  >
                    <i className="ph-fill ph-compass" /> 코스 둘러보기
                  </button>
                </div>
              </div>
            </div>
          ))}

        {state === 'ready' && (
          <div className="sh3-stats">
            <div className="sh3-stat">
              <span className="sh3-stat-n">
                <CountUp value={enrolledCount} />
              </span>
              <span className="sh3-stat-l">수강 코스</span>
            </div>
            <div className="sh3-stat">
              <span className="sh3-stat-n">
                <CountUp value={doneCount} />
              </span>
              <span className="sh3-stat-l">완주 강의</span>
            </div>
            <div className="sh3-stat">
              <span className="sh3-stat-n">
                <CountUp value={avgProgress} />%
              </span>
              <span className="sh3-stat-l">평균 진도</span>
            </div>
            <div className="sh3-stat">
              <span className="sh3-stat-n">
                <CountUp value={completedCourses} />
              </span>
              <span className="sh3-stat-l">수료 코스</span>
            </div>
          </div>
        )}
      </section>

      {/* ===== 관심사 추천 — 고른 관심사에 맞는 코스(실제 우선). 없으면 섹션 숨김. ===== */}
      {state === 'ready' && recommendedGroups.length > 0 && (
        <section className="sh3-sec">
          <div className="sh3-sec-head">
            <h2 className="sh3-sec-title">
              <i className="ph-fill ph-sparkle" /> 관심사 추천
            </h2>
            <span className="sh3-sec-sub">고른 관심사에 맞춘 코스예요</span>
          </div>
          <div className="sh3-rail">{recommendedGroups.map((g) => renderCourseCard(g))}</div>
        </section>
      )}

      {/* ===== 코스 둘러보기 (통합) — 검색 + 분야칩 + 코스 그리드 ===== */}
      <section className="sh3-sec" id="sh2-browse">
        <div className="sh3-sec-head">
          <h2 className="sh3-sec-title">
            <i className="ph-fill ph-compass" /> 코스 둘러보기
          </h2>
        </div>

        <div className="sh2-search sh3-search">
          <i className="ph-bold ph-magnifying-glass sh2-search-ic" />
          <input
            type="search"
            className="sh2-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="코스·강사 검색"
            aria-label="코스 검색"
          />
          {search && (
            <button
              type="button"
              className="sh2-search-clear"
              onClick={() => setSearch('')}
              aria-label="검색 지우기"
            >
              <i className="ph-bold ph-x" />
            </button>
          )}
        </div>

        {state === 'loading' && <div className="sh2-empty">불러오는 중…</div>}
        {state === 'error' && (
          <div className="sh2-empty">코스를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</div>
        )}

        {state === 'ready' && (
          <>
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
            {shownCourses.length > 0 ? (
              <>
                <div className="sh2-ccard-grid">{visibleCourses.map((g) => renderCourseCard(g))}</div>
                {coursesCollapsible && (
                  <button
                    type="button"
                    className="sh2-more"
                    onClick={() => setCoursesExpanded((v) => !v)}
                  >
                    {coursesExpanded ? (
                      <>
                        <i className="ph-bold ph-minus-circle" /> 접기
                      </>
                    ) : (
                      <>
                        <i className="ph-bold ph-plus-circle" /> 코스 더 보기 ({hiddenCourseCount}개)
                      </>
                    )}
                  </button>
                )}
              </>
            ) : (
              <div className="sh2-empty">{q ? '검색 결과가 없어요.' : '지금은 둘러볼 코스가 없어요.'}</div>
            )}
          </>
        )}
      </section>

      {/* 최초 로그인 관심사 온보딩 — interests가 null일 때만(서버 판정). */}
      {onboardNeeded && <InterestOnboardModal onDone={saveOnboard} />}
    </StudentLayout>
  );
}
