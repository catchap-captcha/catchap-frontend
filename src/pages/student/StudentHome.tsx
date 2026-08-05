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

  // 수강신청한 코스(수강 중) — '이어서 학습' 아래 전용 섹션으로 노출(#4).
  const enrolledGroups = useMemo(() => groupsFor(true), [courses, lectures]);
  // 강의 id→코스 조회(수강 여부·코스명·강사) — '강의 둘러보기' 카드·검색이 쓴다.
  const courseById = useMemo(() => {
    const m = new Map<string, StudentCourse>();
    (courses ?? []).forEach((c) => m.set(c.id, c));
    DEMO_COURSES.forEach((c) => m.set(c.id, c)); // 데모 강의가 코스별 그룹에 묶이도록
    return m;
  }, [courses]);

  // 코스 둘러보기 — 수강 중 + 미신청 코스를 모두 담는다(카드에서 배지·버튼으로 구분). 미신청을
  // 앞에 정렬(새로 신청할 코스가 먼저 눈에 띄게). 강의가 있는 코스만(빈 코스 제외).
  const allCourseGroups = useMemo(() => {
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

  // 데모 코스/강의 그룹 — 최종 발표용으로 둘러보기·추천을 풍성하게 채운다. 실제 코스가 항상 앞,
  // 데모는 뒤에 붙는다. 데모 카드는 클릭해도 페이지 이동 안 함(renderCourseCard가 isDemoId로 판정).
  const demoGroups = useMemo<HomeCourseGroup[]>(
    () =>
      DEMO_COURSES.map((c) => ({
        course: c,
        lectures: DEMO_LECTURES.filter((l) => l.course_id === c.id).sort(
          (a, b) => a.order_no - b.order_no,
        ),
      })),
    [],
  );

  // 관심사 추천 — 고른 관심사에 맞는 코스를 홈 상단에 노출. 실제 코스(분류=subject 매칭)를 앞에,
  // 그 뒤에 같은 분야(field) 데모 코스를 붙여 '쫙' 채운다(진짜 강의 있는 코스가 먼저 = 발표 때
  // 선택 편함). 데모 카드는 클릭해도 이동 안 한다.
  const recommendedGroups = useMemo(() => {
    if (!interests || interests.length === 0) return [];
    const wantedSubjects = interestsToSubjects(interests);
    // 실제 코스는 '분류(category)'로만 매칭한다(관심사=코스 분류 선택이므로). category가 없으면
    // 레거시 subject를 쓰되 기본값 '일반'(미분류)은 제외한다 — 안 그러면 분류 안 된 코스
    // (예: 카카오 클라우드·AWS는 subject가 기본값 '일반')가 '교양(일반)' 관심사에 잘못 뜬다.
    const realMatch = discoverGroups.filter((g) => {
      const key =
        g.course.category ||
        (g.course.subject && g.course.subject !== '일반' ? g.course.subject : null);
      return key != null && wantedSubjects.has(key);
    });
    // 데모는 고른 관심사 분야(최대 MAX_INTEREST_FIELDS개)만, 분야별로 골고루(라운드로빈) 뽑아
    // 실제 매칭과 합쳐 목표 개수까지만 보여준다 — 4개를 고르면 분야당 3개×4=12개가 쏟아져
    // '너무 많다'는 피드백 반영. 실제 강의 코스를 앞에 두고(발표 때 선택 편하게) 데모로 담백하게 채운다.
    const wantedFields = [...interestsToFieldKeys(interests)].slice(0, MAX_INTEREST_FIELDS);
    const demoByField = wantedFields.map((f) =>
      demoGroups.filter((g) => demoField(g.course.id) === f),
    );
    const maxLen = Math.max(0, ...demoByField.map((l) => l.length));
    const demoRoundRobin: HomeCourseGroup[] = [];
    for (let i = 0; i < maxLen; i++) {
      for (const list of demoByField) if (i < list.length) demoRoundRobin.push(list[i]);
    }
    const RECO_TARGET = 6; // 관심사 추천 전체 최대 개수(실제 매칭 우선 + 데모로 채움)
    return [...realMatch, ...demoRoundRobin].slice(0, RECO_TARGET);
  }, [discoverGroups, interests, demoGroups]);

  // 코스 둘러보기 검색 — 코스명·강사·분류 실시간 필터.
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  // 강의 둘러보기 검색 — 강의명·코스명·강사 실시간 필터(코스 검색과 별도).
  const [lecSearch, setLecSearch] = useState('');
  const lecQ = lecSearch.trim().toLowerCase();
  // 강의 둘러보기 코스 그룹 펼침(드롭다운) — 기본 접힘, 헤더 클릭으로 토글. 검색 중이면
  // 결과가 바로 보이도록 전부 펼친 것으로 취급한다.
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (id: string) =>
    setOpenGroups((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  // 코스 둘러보기 분야 칩 — 전체 코스(수강 중+미신청)의 분류(category, 없으면 subject) 기준.
  const [browseCat, setBrowseCat] = useState('전체');
  // 둘러보기 기본은 앞부분만 노출(전체 덤프 방지) — 분야칩·검색으로 좁히거나 '더 보기'로 펼친다.
  // 기본이 전부 다 뜨면 검색이 의미 없다는 피드백 반영. 분야·검색이 바뀌면 다시 접어 담백하게 유지.
  const [coursesExpanded, setCoursesExpanded] = useState(false);
  const [lecExpanded, setLecExpanded] = useState(false);
  useEffect(() => {
    setCoursesExpanded(false);
  }, [browseCat, q]);
  useEffect(() => {
    setLecExpanded(false);
  }, [lecQ]);
  // 코스 둘러보기 대상 — 실제 코스(앞) + 데모 코스(뒤). 발표용으로 분야가 쫙 보이게 채운다.
  const browseGroups = useMemo(
    () => [...allCourseGroups, ...demoGroups],
    [allCourseGroups, demoGroups],
  );
  const browseCats = useMemo(() => {
    const cats = Array.from(
      new Set(browseGroups.map((g) => g.course.category || g.course.subject || '기타')),
    );
    return ['전체', ...cats];
  }, [browseGroups]);
  // 코스 둘러보기 = 실제+데모 코스 + 분야 칩 + 검색.
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
  // 강의 둘러보기 = 개별 강의(실제 활성 강의 + 데모 강의) + 강의 검색. 데모 강의는 클릭해도 이동 안 함.
  const shownLectures = useMemo(() => {
    const base = [...(lectures ?? []), ...DEMO_LECTURES];
    if (!lecQ) return base;
    return base.filter((l) => {
      const c = courseById.get(l.course_id ?? '');
      return (
        (l.title || '').toLowerCase().includes(lecQ) ||
        (l.subject || '').toLowerCase().includes(lecQ) ||
        (c?.title || '').toLowerCase().includes(lecQ) ||
        (c?.instructor_name || '').toLowerCase().includes(lecQ)
      );
    });
  }, [lectures, courseById, lecQ]);
  // 강의 둘러보기를 코스별로 묶는다 — 코스 헤더로 어떤 코스인지 한눈에. 수강 중 코스를 앞으로,
  // 그다음 코스명순. 코스가 조회 안 되는 강의는 건너뛴다.
  const lectureGroups = useMemo(() => {
    const byId = new Map<string, LectureItem[]>();
    for (const l of shownLectures) {
      const cid = l.course_id ?? '';
      if (!byId.has(cid)) byId.set(cid, []);
      byId.get(cid)!.push(l);
    }
    const groups: { course: StudentCourse; lectures: LectureItem[] }[] = [];
    byId.forEach((ls, cid) => {
      const course = courseById.get(cid);
      if (!course) return;
      groups.push({ course, lectures: ls.sort((a, b) => a.order_no - b.order_no) });
    });
    return groups.sort(
      (a, b) =>
        Number(!!b.course.enrolled) - Number(!!a.course.enrolled) ||
        (a.course.title || '').localeCompare(b.course.title || ''),
    );
  }, [shownLectures, courseById]);

  // 둘러보기 기본 노출 개수 — 담백하게. 분야칩/검색으로 좁히면 전체를 보여주고(자연히 몇 개 안 됨),
  // 아무 조건 없는 '전체' 기본에서만 앞부분을 잘라 '더 보기'로 나머지를 펼친다.
  const COURSE_LIMIT = 8;
  // '전체' 기본에서만 접기/펼치기가 의미 있다(분야칩·검색은 이미 좁혀져 결과를 전부 보여준다).
  const coursesCollapsible = browseCat === '전체' && !q && shownCourses.length > COURSE_LIMIT;
  const coursesCapped = coursesCollapsible && !coursesExpanded;
  const visibleCourses = coursesCapped ? shownCourses.slice(0, COURSE_LIMIT) : shownCourses;
  const hiddenCourseCount = shownCourses.length - visibleCourses.length;
  // 강의 둘러보기(비검색)는 코스별 그룹이 많아 기본 6개 코스만 접어 보여주고 나머지는 '더 보기'로 펼친다.
  const LEC_GROUP_LIMIT = 6;
  const lecCollapsible = lectureGroups.length > LEC_GROUP_LIMIT;
  const visibleLecGroups =
    lecExpanded || !lecCollapsible ? lectureGroups : lectureGroups.slice(0, LEC_GROUP_LIMIT);
  const hiddenLecGroupCount = lectureGroups.length - visibleLecGroups.length;

  // 이어서 학습 레일 — 시청 중(watching)인 강의(발견·재방문 유도). 히어로의 1건과 겹쳐도
  // 여러 개를 가로 스크롤로 노출하는 게 목적(넷플릭스·Coursera '이어보기' 레일 패턴).
  const watchingLecs = useMemo(
    () => (lectures ?? []).filter((l) => l.progress?.status === 'watching'),
    [lectures],
  );

  const goWatch = (id: string) => navigate(PATHS.STUDENT_LECTURE, { state: { id } });

  /** 코스 카드 — 코스 둘러보기·추천·수강 중 섹션 공용. 수강 중은 '수강 중' 배지 + [커리큘럼],
   *  미신청은 '미신청' 배지 + [커리큘럼]·[수강신청] 버튼으로 확실히 구분한다. 커리큘럼은 코스
   *  상세(커리큘럼)로, 수강신청은 결제로 바로 보낸다. */
  const renderCourseCard = (g: HomeCourseGroup) => {
    const c = g.course;
    const enrolled = !!c.enrolled;
    const demo = isDemoId(c.id); // 데모 코스는 클릭해도 페이지 이동 안 함(발표용 채우기)
    const goCurriculum = () => {
      if (!demo) navigate(`${PATHS.STUDENT_COURSE_DETAIL}?id=${c.id}`);
    };
    const goEnroll = () => {
      if (!demo) navigate(`${PATHS.STUDENT_CHECKOUT}?course=${c.id}`);
    };
    return (
      <div key={c.id} className={`sh2-ccard${enrolled ? ' sh2-ccard--enrolled' : ''}`}>
        <button
          type="button"
          className="sh2-ccover-wrap"
          onClick={goCurriculum}
          aria-label={`${c.title} 커리큘럼 보기`}
        >
          <CourseCover
            seed={c.id}
            label={c.title || c.subject}
            imageUrl={thumbnailSrc(c.thumbnail_url)}
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
        </button>
        <div className="sh2-ccard-body">
          <span className="sh2-ccard-title">{c.title}</span>
          <span className="sh2-ccard-meta">
            {c.instructor_name ? `${c.instructor_name} 강사 · ` : ''}
            {c.lecture_count || g.lectures.length}강
          </span>
          <div className="sh2-ccard-actions">
            <button
              type="button"
              className="sh2-ccard-btn sh2-ccard-btn--ghost"
              onClick={goCurriculum}
            >
              <i className="ph-bold ph-list-bullets" /> 커리큘럼
            </button>
            {!enrolled && (
              <button
                type="button"
                className="sh2-ccard-btn sh2-ccard-btn--primary"
                onClick={goEnroll}
              >
                <i className="ph-bold ph-shopping-cart-simple" /> 수강신청
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  /** 강의 카드 — 홈 '강의 둘러보기'(개별 강의). 코스 카드 룩을 재사용하되, 수강 중 코스의
   *  강의는 바로 이어 보기, 미신청 코스의 강의는 코스 상세(수강신청)로 보낸다. */
  const renderLectureCard = (l: LectureItem, showCourse = false) => {
    const c = courseById.get(l.course_id ?? '');
    const enrolled = !!c?.enrolled;
    const demo = isDemoId(l.id) || isDemoId(l.course_id); // 데모 강의는 클릭해도 이동 안 함
    const go = () => {
      if (demo) return;
      if (enrolled) goWatch(l.id);
      else navigate(`${PATHS.STUDENT_COURSE_DETAIL}?id=${l.course_id}`);
    };
    return (
      <button
        key={l.id}
        type="button"
        className={`sh2-ccard${enrolled ? ' sh2-ccard--enrolled' : ''}`}
        onClick={go}
      >
        <span className="sh2-ccover-wrap">
          <CourseCover
            seed={l.course_id || l.id}
            label={l.title}
            imageUrl={thumbnailSrc(l.thumbnail_url)}
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
        </span>
        <span className="sh2-ccard-body">
          <span className="sh2-ccard-title">{l.title}</span>
          <span className="sh2-ccard-meta">{showCourse && c?.title ? c.title : l.subject || '강의'}</span>
          <span className={`sh2-ccard-cta${enrolled ? ' sh2-ccard-cta--learn' : ''}`}>
            {enrolled ? (
              <>
                <i className="ph-fill ph-play" /> 이어 보기
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
                <button
                  className="sh2-continue-btn"
                  onClick={() =>
                    document.getElementById('sh2-browse')?.scrollIntoView({ behavior: 'smooth' })
                  }
                >
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

      {/* ===== 수강 중인 코스 (#4) — '이어서 학습' 아래에 수강신청한 코스를 전용 섹션으로 보여준다.
             (강의 단위 '이어서 학습' 레일과 달리, 여기선 코스 단위로 묶어 진행/학습 진입점을 준다) ===== */}
      {state === 'ready' && enrolledGroups.length > 0 && (
        <section className="sh2-courses">
          <div className="sh2-sec-head">
            <h2 className="sh2-sec-title">
              <i className="ph-fill ph-books" /> 수강 중인 코스
            </h2>
            <button className="sh2-sec-more" onClick={() => navigate(PATHS.STUDENT_MY_COURSES)}>
              전체 보기 <i className="ph-bold ph-arrow-right" />
            </button>
          </div>
          <div className="sh2-ccard-grid">{enrolledGroups.map((g) => renderCourseCard(g))}</div>
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

      {/* ===== 둘러보기 (#2/#3) — 상단 검색 + '코스 둘러보기'(미신청 코스) + '강의 둘러보기'(개별 강의).
             검색은 코스·강의 공용 실시간 필터. 상세 조건 필터는 '전체 보기' 카탈로그에서. ===== */}
      <section className="sh2-browse" id="sh2-browse">
        <div className="sh2-search">
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
          <div className="sh2-empty">강의를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</div>
        )}

        {state === 'ready' && (
          <>
            {/* 코스 둘러보기 — 아직 신청 안 한 코스(미리보기) */}
            <div className="sh2-sec-head sh2-sec-head--sub">
              <h2 className="sh2-sec-title">
                <i className="ph-fill ph-compass" /> 코스 둘러보기
              </h2>
            </div>
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
                <div className="sh2-ccard-grid">
                  {visibleCourses.map((g) => renderCourseCard(g))}
                </div>
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

            {/* 강의 둘러보기 — 개별 강의를 코스별로 묶어(코스 헤더로 어떤 코스인지 한눈에) + 강의 검색 */}
            <div className="sh2-sec-head sh2-sec-head--sub sh2-browse-lechead">
              <h2 className="sh2-sec-title">
                <i className="ph-fill ph-monitor-play" /> 강의 둘러보기
              </h2>
            </div>
            <div className="sh2-search sh2-search--lec">
              <i className="ph-bold ph-magnifying-glass sh2-search-ic" />
              <input
                type="search"
                className="sh2-search-input"
                value={lecSearch}
                onChange={(e) => setLecSearch(e.target.value)}
                placeholder="강의·강사 검색"
                aria-label="강의 검색"
              />
              {lecSearch && (
                <button
                  type="button"
                  className="sh2-search-clear"
                  onClick={() => setLecSearch('')}
                  aria-label="검색 지우기"
                >
                  <i className="ph-bold ph-x" />
                </button>
              )}
            </div>
            {/* 검색 중에는 결과 영역에 최소 높이를 예약해, 결과 수가 오르내려도 페이지가
                짧아져 스크롤이 위로 끌려 올라가는(clamp) 현상을 막는다. */}
            <div className={`sh2-lecresults${lecQ ? ' sh2-lecresults--search' : ''}`}>
            {lecQ ? (
              /* 검색 중 — 매칭 강의를 평면 그리드로 보여준다. (그룹 드롭다운을 매 타자마다
                 열고/닫고/필터링하면 페이지 높이가 크게 요동쳐 스크롤이 튄다 → 평면으로 안정화) */
              shownLectures.length > 0 ? (
                <div className="sh2-ccard-grid">
                  {shownLectures.map((l) => renderLectureCard(l, true))}
                </div>
              ) : (
                <div className="sh2-empty">검색 결과가 없어요.</div>
              )
            ) : lectureGroups.length > 0 ? (
              <>
              <div className="sh2-lecgroups">
                {visibleLecGroups.map((g) => {
                  const c = g.course;
                  const enrolled = !!c.enrolled;
                  const open = openGroups.has(c.id);
                  return (
                    <div key={c.id} className="sh2-lecgroup">
                      <button
                        type="button"
                        className="sh2-lecgroup-head"
                        onClick={() => toggleGroup(c.id)}
                        aria-expanded={open}
                      >
                        <CourseCover
                          seed={c.id}
                          label={c.title || c.subject}
                          imageUrl={thumbnailSrc(c.thumbnail_url)}
                          size="sm"
                          className="sh2-lecgroup-cover"
                        />
                        <span className="sh2-lecgroup-meta">
                          <span className="sh2-lecgroup-title">
                            {c.title}
                            {enrolled && <span className="sh2-lecgroup-badge">수강 중</span>}
                          </span>
                          <span className="sh2-lecgroup-sub">
                            {c.instructor_name ? `${c.instructor_name} 강사 · ` : ''}강의 {g.lectures.length}개
                          </span>
                        </span>
                        <i
                          className={`ph-bold ph-caret-down sh2-lecgroup-caret${open ? ' sh2-lecgroup-caret--open' : ''}`}
                        />
                      </button>
                      {open && (
                        <div className="sh2-ccard-grid sh2-lecgroup-grid">
                          {g.lectures.map((l) => renderLectureCard(l))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {lecCollapsible && (
                <button
                  type="button"
                  className="sh2-more"
                  onClick={() => setLecExpanded((v) => !v)}
                >
                  {lecExpanded ? (
                    <>
                      <i className="ph-bold ph-minus-circle" /> 접기
                    </>
                  ) : (
                    <>
                      <i className="ph-bold ph-plus-circle" /> 강의 더 보기 ({hiddenLecGroupCount}개 코스)
                    </>
                  )}
                </button>
              )}
              </>
            ) : (
              <div className="sh2-empty">지금은 둘러볼 강의가 없어요.</div>
            )}
            </div>
          </>
        )}
      </section>

      {/* 최초 로그인 관심사 온보딩 — interests가 null일 때만(서버 판정). 데모 분야 택소노미는
          모달이 직접 들고 있어 코스 로드를 기다릴 필요 없다. */}
      {onboardNeeded && <InterestOnboardModal onDone={saveOnboard} />}
    </StudentLayout>
  );
}
