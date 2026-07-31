import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { lectureApi, thumbnailSrc, type LectureItem, type StudentCourse } from '../../api/lectures';
import { StudentNav } from '../../layouts/StudentLayout';
import { categoryTheme, formatClock } from './lectureSubjects';
import CourseCover from '../../components/course/CourseCover';
import InstructorBioModal from '../../components/course/InstructorBioModal';
import { fmtWon } from '../../api/payments';
import './LectureList.css';

/** 코스(그룹)별 기본 노출 개수 — 그 이상은 '더보기' 카드로 접는다(목업 동일) */
const VISIBLE_PER_GROUP = 5;

/** 한 분류(category) 안의 강의를 강사별 코스로 묶는다(코스는 order_no순). course_id=null은 '기타' 그룹.
 *  rows는 서버가 (과목·order_no·created_at)로 정렬해 주므로 필터만 해도 코스 안 순서가 지켜진다. */
interface CourseGroup {
  key: string;
  title: string | null; // null = 미분류(기타)
  instructor: string | null;
  lectures: LectureItem[];
  /** 코스 Q 배지(3단계-b) — 코스 그룹에만. 미분류(기타)는 코스 Q가 없다 */
  course?: StudentCourse;
}
const CAT_ETC = '기타';
/** 코스의 분류(category) — 없으면 '기타'. 과목 은퇴 후 학생 목록은 이걸로 묶는다. */
function catOf(c: StudentCourse): string {
  return (c.category || '').trim() || CAT_ETC;
}
function courseGroupsForCategory(
  category: string,
  rows: LectureItem[],
  courses: StudentCourse[],
): CourseGroup[] {
  const groups: CourseGroup[] = [];
  const visibleCourseIds = new Set(courses.map((c) => c.id));
  for (const c of courses.filter((c) => catOf(c) === category)) {
    const lects = rows.filter((l) => l.course_id === c.id);
    if (lects.length)
      groups.push({
        key: `c-${c.id}`, title: c.title, instructor: c.instructor_name, lectures: lects, course: c,
      });
  }
  // '기타' 분류엔 코스 없는 강의(또는 숨김·삭제 코스에 매인 강의)도 담는다 — 어느 분류에도
  // 안 걸려 목록에서 사라지는 것을 막는다(코스 없이 올린 강의).
  if (category === CAT_ETC) {
    const uncoursed = rows.filter((l) => !l.course_id || !visibleCourseIds.has(l.course_id));
    if (uncoursed.length)
      groups.push({ key: 'u-etc', title: null, instructor: null, lectures: uncoursed });
  }
  return groups;
}


export default function LectureList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [tab, setTab] = useState<string>(() => {
    const t = searchParams.get('subject');
    if (t) return t; // 알려진 분류뿐 아니라 어떤 분류 딥링크도 허용(없으면 빈 탭·무해)
    return '전체';
  });
  const [rows, setRows] = useState<LectureItem[] | null>(null);
  const [courses, setCourses] = useState<StudentCourse[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = () => {
    setState('loading');
    // 강의와 코스를 함께 불러온다 — 코스는 분류→강사별 코스→강의 그룹의 상위 메타.
    // 강의 로드가 실패하면 에러 상태(정직 노출), 코스만 실패하면 코스 없이 분류·미분류로만 묶는다.
    Promise.all([lectureApi.list(), lectureApi.courses().catch(() => [] as StudentCourse[])])
      .then(([lects, crs]) => {
        setRows(Array.isArray(lects) ? lects : []);
        setCourses(Array.isArray(crs) ? crs : []);
        setState('ready');
      })
      .catch(() => setState('error')); // 강의 목록 실패는 빈 목록처럼 보이지 않게 에러로 노출
  };
  useEffect(load, []);

  // 이 페이지는 '강의 신청(구매)' 전용 — 아직 수강신청 안 한 코스와 그 강의만 다룬다.
  // 영상(강의) 0개인 코스는 제외한다 — 서버(GET /courses)도 빈 코스를 빼지만, 방어적으로 한 번 더
  // 거른다(강의 없는 코스는 수강신청 화면에 아예 안 뜨게).
  const shopCourses = courses.filter((c) => !c.enrolled && (c.lecture_count ?? 0) > 0);
  const shopCourseIds = new Set(shopCourses.map((c) => c.id));
  const shopRows = (rows ?? []).filter((l) => l.course_id && shopCourseIds.has(l.course_id));
  const shopCourseCount = shopCourses.length;

  // 과목 은퇴(0722) — 코스의 '분류(category)'로 브라우징한다. 구매 페이지라 미신청 코스가 있는
  // 분류만 노출한다(코스 없이 올린 강의 '기타'는 구매 대상이 아니라 제외).
  const presentCategories = (() => {
    const set = new Set<string>();
    for (const c of shopCourses) set.add(catOf(c));
    return [...set].filter((x) => x !== CAT_ETC).sort();
  })();

  const tabDefs = [{ key: '전체', icon: 'ph-fill ph-squares-four' }].concat(
    presentCategories.map((cat) => ({ key: cat, icon: categoryTheme(cat).icon })),
  );
  const visibleCategories = tab === '전체' ? presentCategories : [tab];

  // 미신청 코스라 재생이 아니라 수강신청(결제)로 보낸다 — 강의 카드도 그 코스의 결제 화면으로.
  const goEnroll = (courseId: string) => navigate(`${PATHS.STUDENT_CHECKOUT}?course=${courseId}`);

  // 장바구니 — 구매(수강신청)할 코스를 여러 개 담는다. 코스 머리의 체크박스로 토글하고,
  // 하단 바의 '구매하기'가 선택 코스들을 결제(Checkout) 페이지로 넘긴다(?cart=id1,id2).
  const [cart, setCart] = useState<Set<string>>(new Set());

  // 코스별 수강료 — 목록 API(GET /courses)가 pricing.effective_price로 함께 내려준다.
  // (종전엔 코스를 담을 때마다 GET /courses/{id}/checkout을 1건씩 더 불렀다 — 백엔드가 가격을
  //  목록에 실어 주면서 그 왕복이 필요 없어졌다. 최종 결제 금액은 주문 생성 때 서버가 다시 정한다.)
  const priceOf = (c: { pricing?: { effective_price: number } }): number | undefined =>
    c.pricing ? c.pricing.effective_price : undefined;

  const toggleCart = (courseId: string) => {
    setCart((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  };
  const goCheckout = () => {
    if (cart.size === 0) return;
    navigate(`${PATHS.STUDENT_CHECKOUT}?cart=${[...cart].join(',')}`);
  };
  // 선택된 코스 메타(하단 바 표시용) — shopCourses는 위에서 계산됨.
  const cartCourses = shopCourses.filter((c) => cart.has(c.id));

  // 장바구니 합계 — 가격을 못 받은 코스가 하나라도 있으면 합계를 확정하지 않는다(실제보다 적게
  // 보이는 채로 결제로 넘어가지 않게). 구 백엔드 응답엔 pricing이 없어 undefined가 올 수 있다.
  const cartPrices = cartCourses.map((c) => priceOf(c));
  const priceFailed = cartPrices.some((p) => p === undefined);
  const priceLoading = false;
  const cartTotal = cartPrices.reduce<number>((n, p) => n + (p ?? 0), 0);

  // 강사 소개 모달 — 코스 머리의 '강사 소개' 버튼이 연다.
  const [bioFor, setBioFor] = useState<{ name: string; courseTitle: string | null } | null>(null);

  /** 강의 카드 — 코스 그룹 안에서 반복 렌더한다(그룹 내 순번 i로 강 번호를 센다).
   *  이 페이지는 '미신청' 코스만 다루므로 카드는 재생이 아니라 '수강신청'을 유도한다. 수강 취소로
   *  진행 이력만 남은 코스가 '이어서 보기'처럼 보이던 혼란을 없앤다 — 신청 전엔 시청할 수 없다. */
  const renderCard = (l: LectureItem, i: number) => {
    // 코스 안 순서는 그룹 내 위치(1강·2강…)로 센다 — order_no는 과목 전역이라 코스로 묶으면
    // 2강·3강처럼 건너뛰어 보인다(정렬 순서는 이미 order_no로 맞춰져 있어 위치가 곧 강 순서).
    const num = i + 1;
    const enroll = () => l.course_id && goEnroll(l.course_id);
    // 썸네일 인프라(Object Storage)가 없어 코스별 결정적 커버로 색을 준다 — 같은 코스 강의는
    // 같은 색 계열(cohesive), 코스가 없으면 강의 id로.
    return (
      <div key={l.id} className="ll-card" onClick={enroll}>
        <div className="ll-thumb">
          {/* 앱 전체와 일관된 CourseCover(모노그램 커버) — 복제본 랩 커버 룩 */}
          <CourseCover
            seed={l.course_id || l.id}
            label={l.title}
            imageUrl={thumbnailSrc(l.thumbnail_url)}
            size="md"
            className="ll-thumb-cover"
          />
          <span className="ll-badge ll-badge--locked">
            <i className="ph-fill ph-lock-simple" /> 미신청
          </span>
          <span className="ll-time">{formatClock(l.duration_sec)}</span>
        </div>
        <div className="ll-cardbody">
          <span className="ll-cardchip">{num}강</span>
          <div className="ll-cardtitle">{l.title}</div>
          <p className="ll-carddesc">{l.description || '이 강의의 내용을 배워요.'}</p>
          <div className="ll-cardfoot">
            <span className="ll-cardstatus ll-cardstatus--locked">
              <i className="ph-fill ph-lock-simple" /> 수강신청하면 볼 수 있어요
            </span>
            <button
              className="ll-cardwatch ll-cardenroll"
              onClick={(e) => {
                e.stopPropagation();
                enroll();
              }}
            >
              수강신청
              <i className="ph-bold ph-arrow-right" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`ll-root${cartCourses.length > 0 ? ' ll-root--cart' : ''}`}>
      <StudentNav />

      <div className="ll-container">
        {/* HERO */}
        <section className="ll-hero">
          <div className="ll-heroleft">
            <span className="ll-herobadge">
              <i className="ph-fill ph-shopping-bag-open" />
              강의 신청
            </span>
            <h1 className="ll-herotitle">수강신청할 강의를 골라보세요</h1>
            <p className="ll-herodesc">
              관심 있는 코스를 수강신청하고, 시청 검증 강의로 학습을 시작하세요.
            </p>
          </div>
          <div className="ll-herostats">
            {state === 'ready' ? (
              <>
                <div className="ll-herostatnum">
                  {shopCourseCount}
                  <span className="ll-herostatslash">개</span>
                </div>
                <div className="ll-herostatlabel">신청 가능한 코스</div>
              </>
            ) : state === 'loading' ? (
              <div className="ll-herostatlabel">코스를 불러오는 중…</div>
            ) : (
              <div className="ll-herostatlabel ll-herostatlabel-err">코스를 불러오지 못했어요</div>
            )}
          </div>
        </section>

        {/* CATEGORY FILTER TABS */}
        <div className="ll-tabsrow">
          {tabDefs.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                className={`ll-tab${active ? ' ll-tab-on' : ''}`}
                onClick={() => setTab(t.key)}
              >
                <i className={t.icon} />
                {t.key}
              </button>
            );
          })}
        </div>

        {state === 'loading' && (
          <div className="ll-state">
            <i className="ph-fill ph-hourglass-medium" />
            강의 목록을 불러오고 있어요…
          </div>
        )}
        {state === 'error' && (
          <div className="ll-state ll-state-err">
            <i className="ph-fill ph-warning-circle" />
            강의 목록을 불러오지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.
            <button className="ll-retry" onClick={load}>
              다시 불러오기
            </button>
          </div>
        )}

        {/* 구매 페이지 — 신청 가능한(미신청) 코스가 하나도 없을 때 */}
        {state === 'ready' && shopCourseCount === 0 && (
          <div className="ll-state">
            <i className="ph-fill ph-shopping-bag" />
            신청할 수 있는 새 코스가 없어요. 이미 모든 코스를 수강 중이에요.
            <button className="ll-retry" onClick={() => navigate(PATHS.STUDENT_HOME)}>
              강의 홈으로
            </button>
          </div>
        )}

        {state === 'ready' &&
          visibleCategories.map((sub) => {
            const s = categoryTheme(sub);
            // 분류(category) → 강사별 코스 → 강의. 구매 페이지라 미신청 코스만 묶는다.
            const groups = courseGroupsForCategory(sub, shopRows, shopCourses);
            const subjTotal = groups.reduce((n, g) => n + g.lectures.length, 0);
            if (subjTotal === 0 && tab === '전체') return null; // 전체 탭에선 빈 분류 생략
            return (
              <section key={sub} className="ll-section">
                <div className="ll-sechead">
                  <span className="ll-secicon">
                    <i className={s.icon} />
                  </span>
                  <div>
                    <h2 className="ll-sectitle">{sub}</h2>
                    <p className="ll-secsub">
                      {subjTotal}강
                      {groups.some((g) => g.title)
                        ? ` · 코스 ${groups.filter((g) => g.title).length}개`
                        : ''}
                    </p>
                  </div>
                </div>
                {subjTotal === 0 ? (
                  <div className="ll-state">
                    <i className="ph-fill ph-video-camera-slash" />
                    아직 등록된 강의가 없어요. 조금만 기다려 주세요!
                  </div>
                ) : (
                  (() => {
                    // 이 분류에 진짜 코스가 하나라도 있나 — 없으면 '기타 강의' 머리를 숨겨
                    // (코스 없는 분류는 카드만 평면 노출) 어색한 라벨을 피한다.
                    const hasCourses = groups.some((g) => g.title);
                    return groups.map((g) => {
                      // 코스 안 원래 순서(강 번호)를 보존 — 'N강'은 원래 위치로 표시
                      const numMap = new Map(g.lectures.map((l, idx) => [l.id, idx + 1]));
                      const gl = g.lectures;
                      const showAll = !!expanded[g.key];
                      const shown = showAll ? gl : gl.slice(0, VISIBLE_PER_GROUP);
                      const hidden = gl.length - shown.length;
                      const showHead = !!g.title || hasCourses;
                      return (
                        <div key={g.key} className="ll-coursegroup">
                          {/* 코스 머리 — 강사별 코스명(+강사). 미분류는 '기타 강의'로 옅게.
                              코스가 아예 없는 분류면 머리를 생략한다. */}
                          {showHead && (
                            <div className="ll-coursehead">
                              {g.title ? (
                                <>
                                  <CourseCover
                                    seed={g.course?.id || g.key}
                                    label={g.title}
                                    imageUrl={thumbnailSrc(g.course?.thumbnail_url)}
                                    size="sm"
                                    className="ll-coursecover"
                                  />
                                  <span className="ll-coursebadge">
                                    <i className="ph-fill ph-stack" /> 코스
                                  </span>
                                  <h3 className="ll-coursetitle">{g.title}</h3>
                                  {g.instructor && (
                                    <>
                                      <span className="ll-courseinst">
                                        <i className="ph-fill ph-chalkboard-teacher" /> {g.instructor} 선생님
                                      </span>
                                      <button
                                        type="button"
                                        className="ibm-trigger"
                                        onClick={() =>
                                          setBioFor({ name: g.instructor!, courseTitle: g.title })
                                        }
                                      >
                                        <i className="ph-fill ph-user-circle" /> 강사 소개
                                      </button>
                                    </>
                                  )}
                                </>
                              ) : (
                                <h3 className="ll-coursetitle ll-coursetitle--none">기타 강의</h3>
                              )}
                              <span className="ll-coursecount">
                                {`${g.lectures.length}강`}
                              </span>
                              {/* 장바구니 담기 — 실제 코스(g.course)가 있는 그룹에만. 여러 코스를
                                  담아 하단 바의 '구매하기'로 한 번에 결제(Checkout)로 넘긴다. */}
                              {g.course && (
                                <button
                                  className={`ll-cartadd${cart.has(g.course.id) ? ' ll-cartadd--on' : ''}`}
                                  onClick={() => toggleCart(g.course!.id)}
                                  aria-pressed={cart.has(g.course.id)}
                                >
                                  {cart.has(g.course.id) ? (
                                    <>
                                      <i className="ph-fill ph-check-circle" /> 담김
                                    </>
                                  ) : (
                                    <>
                                      <i className="ph-fill ph-shopping-cart-simple" /> 장바구니 담기
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          )}
                        <div className="ll-grid">
                          {shown.map((l) => renderCard(l, (numMap.get(l.id) ?? 1) - 1))}
                          {hidden > 0 && (
                            <button
                              className="ll-more"
                              onClick={() => setExpanded((prev) => ({ ...prev, [g.key]: true }))}
                            >
                              <span className="ll-more-icon">
                                <i className="ph-bold ph-caret-down" />
                              </span>
                              <span className="ll-more-title">더보기</span>
                              <span className="ll-more-sub">강의 {hidden}개 더 있어요</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()
                )}
              </section>
            );
          })}
      </div>

      {/* 장바구니 바 — 선택한 코스가 있을 때만. '구매하기'가 결제 페이지(?cart=)로 넘긴다. */}
      {cartCourses.length > 0 && (
        <div className="ll-cartbar">
          <div className="ll-cartbar-inner">
            <div className="ll-cartbar-info">
              <span className="ll-cartbar-badge">
                <i className="ph-fill ph-shopping-cart" />
                {cartCourses.length}
              </span>
              <span className="ll-cartbar-titles">
                {cartCourses.map((c) => c.title).join(', ')}
              </span>
            </div>
            {/* 총 가격 — 담긴 코스들의 수강료 합계. 최종 결제 금액은 결제 페이지에서 서버가 확정한다. */}
            <div className="ll-cartbar-total">
              <span className="ll-cartbar-totlabel">총 가격</span>
              {priceLoading ? (
                <span className="ll-cartbar-totcalc">계산 중…</span>
              ) : (
                <strong className="ll-cartbar-totnum">{fmtWon(cartTotal)}</strong>
              )}
              {priceFailed && !priceLoading && (
                <span className="ll-cartbar-toterr">
                  <i className="ph-fill ph-warning-circle" /> 일부 코스 금액을 불러오지 못했어요
                </span>
              )}
            </div>
            <div className="ll-cartbar-actions">
              <button className="ll-cartbar-clear" onClick={() => setCart(new Set())}>
                비우기
              </button>
              <button className="ll-cartbar-btn" onClick={goCheckout}>
                <i className="ph-fill ph-lock-simple" />
                {cartCourses.length}개 코스 구매하기
                <i className="ph-bold ph-arrow-right" />
              </button>
            </div>
          </div>
        </div>
      )}

      {bioFor && (
        <InstructorBioModal
          name={bioFor.name}
          courseTitle={bioFor.courseTitle}
          onClose={() => setBioFor(null)}
        />
      )}
    </div>
  );
}
