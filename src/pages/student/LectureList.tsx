import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { lectureApi, type LectureItem, type StudentCourse } from '../../api/lectures';
import ScreenTimeReminder from '../../components/motion/ScreenTimeReminder';
import { StudentNav } from '../../layouts/StudentLayout';
import { LECTURE_SUBJECTS, LECTURE_SUBJECT_ORDER, formatClock } from './lectureSubjects';
import './LectureList.css';

/** 코스(그룹)별 기본 노출 개수 — 그 이상은 '더보기' 카드로 접는다(목업 동일) */
const VISIBLE_PER_GROUP = 5;

type WatchState = 'new' | 'watching' | 'done';

function watchState(l: LectureItem): WatchState {
  if (l.progress?.status === 'done') return 'done';
  if ((l.progress?.watched_max_sec ?? 0) > 0) return 'watching';
  return 'new';
}

/** 한 과목 안의 강의를 강사별 코스로 묶는다(코스는 order_no순). course_id=null은 '기타' 그룹.
 *  rows는 서버가 (과목·order_no·created_at)로 정렬해 주므로 필터만 해도 코스 안 순서가 지켜진다. */
interface CourseGroup {
  key: string;
  title: string | null; // null = 미분류(기타)
  instructor: string | null;
  lectures: LectureItem[];
  /** 코스 Q 배지(3단계-b) — 코스 그룹에만. 미분류(기타)는 코스 Q가 없다 */
  course?: StudentCourse;
}
function courseGroupsForSubject(
  subject: string,
  rows: LectureItem[],
  courses: StudentCourse[],
): CourseGroup[] {
  const groups: CourseGroup[] = [];
  const visibleCourseIds = new Set(courses.map((c) => c.id));
  for (const c of courses.filter((c) => c.subject === subject)) {
    const lects = rows.filter((l) => l.course_id === c.id);
    if (lects.length)
      groups.push({
        key: `c-${c.id}`, title: c.title, instructor: c.instructor_name, lectures: lects, course: c,
      });
  }
  // '기타'는 코스 없음(null)뿐 아니라 '보이지 않는 코스(숨김·삭제)에 매인 강의'도 담는다 —
  // 숨겨진 코스의 course_id를 가진 활성 강의가 어느 그룹에도 안 걸려 목록에서 사라지는 것을 막는다.
  const uncoursed = rows.filter(
    (l) => l.subject === subject && (!l.course_id || !visibleCourseIds.has(l.course_id)),
  );
  if (uncoursed.length)
    groups.push({ key: `u-${subject}`, title: null, instructor: null, lectures: uncoursed });
  return groups;
}

/** 코스 수료 시험 카드(#28) — 코스 그룹 말미. 배움(강의)→연습(Q)→증명(시험)의 마지막 조각.
 *  상태 흐름을 한 카드에: 잠김(완주 필요) → 응시 가능(진행) → 수료(+완벽 통과). */
function ExamCard({ course, onGo }: { course: StudentCourse; onGo: () => void }) {
  const ex = course.exam!;
  const passed = ex.passed;
  const perfect = ex.perfect;
  const locked = !ex.available && !passed;
  return (
    <button
      className={`ll-examcard${passed ? ' ll-examcard--passed' : ''}`}
      onClick={onGo}
    >
      <span
        className={`ll-examicon${passed ? (perfect ? ' ll-examicon--perfect' : ' ll-examicon--passed') : ''}`}
      >
        <i className={passed ? (perfect ? 'ph-fill ph-crown' : 'ph-fill ph-seal-check') : locked ? 'ph-fill ph-lock-simple' : 'ph-fill ph-exam'} />
      </span>
      <span className="ll-exambody">
        <b className="ll-examtitle">
          수료 시험
          {passed && <span className={`ll-exambadge${perfect ? ' ll-exambadge--perfect' : ''}`}>
            {perfect ? '완벽 통과' : '수료'}
          </span>}
        </b>
        <span className="ll-examdesc">
          {passed
            ? (perfect ? '전 문항을 한 번에 다 맞혔어요 🏆' : '수료 완료 · 완벽 통과에 도전할 수 있어요')
            : locked
              ? `강의 ${ex.lectures_done}/${ex.lectures_total} 완주 시 열려요`
              : ex.mastered_count > 0
                ? `수료까지 ${ex.question_count - ex.mastered_count}문항 (${ex.mastered_count}/${ex.question_count} 정복)`
                : `문항 ${ex.question_count}개를 모두 맞히면 수료해요`}
        </span>
      </span>
      {!passed && !locked && (
        <span className="ll-exsmgo">
          <i className="ph-bold ph-arrow-right" />
        </span>
      )}
    </button>
  );
}

export default function LectureList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [tab, setTab] = useState<string>(() => {
    const t = searchParams.get('subject');
    if (t && LECTURE_SUBJECTS[t]) return t;
    return '전체';
  });
  const [rows, setRows] = useState<LectureItem[] | null>(null);
  const [courses, setCourses] = useState<StudentCourse[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = () => {
    setState('loading');
    // 강의와 코스를 함께 불러온다 — 코스는 과목→강사별 코스→강의 그룹의 상위 메타.
    // 강의 로드가 실패하면 에러 상태(정직 노출), 코스만 실패하면 코스 없이 과목·미분류로만 묶는다.
    Promise.all([lectureApi.list(), lectureApi.courses().catch(() => [] as StudentCourse[])])
      .then(([lects, crs]) => {
        setRows(Array.isArray(lects) ? lects : []);
        setCourses(Array.isArray(crs) ? crs : []);
        setState('ready');
      })
      .catch(() => setState('error')); // 강의 목록 실패는 빈 목록처럼 보이지 않게 에러로 노출
  };
  useEffect(load, []);

  const total = rows?.length ?? 0;
  const watched = (rows ?? []).filter((l) => watchState(l) === 'done').length;

  const tabDefs = [{ key: '전체', icon: 'ph-fill ph-squares-four' }].concat(
    LECTURE_SUBJECT_ORDER.map((sub) => ({ key: sub, icon: LECTURE_SUBJECTS[sub].icon })),
  );
  const visibleSubjects = tab === '전체' ? LECTURE_SUBJECT_ORDER : [tab];

  const goWatch = (id: string) => navigate(PATHS.STUDENT_LECTURE, { state: { id } });

  /** 강의 카드 — 코스 그룹 안에서 반복 렌더한다(그룹 내 순번 i로 강 번호를 센다). */
  const renderCard = (l: LectureItem, i: number, sub: string) => {
    const st = watchState(l);
    // 코스 안 순서는 그룹 내 위치(1강·2강…)로 센다 — order_no는 과목 전역이라 코스로 묶으면
    // 2강·3강처럼 건너뛰어 보인다(정렬 순서는 이미 order_no로 맞춰져 있어 위치가 곧 강 순서).
    const num = i + 1;
    const badgeText = st === 'done' ? '봤어요' : st === 'watching' ? '학습중' : '새 강의';
    return (
      <div key={l.id} className="ll-card" onClick={() => goWatch(l.id)}>
        <div className="ll-thumb">
          <i className="ph-fill ph-play" />
          <span className="ll-badge">{badgeText}</span>
          <span className="ll-time">{formatClock(l.duration_sec)}</span>
        </div>
        <div className="ll-cardbody">
          <span className="ll-cardchip">{num}강</span>
          <div className="ll-cardtitle">{l.title}</div>
          <p className="ll-carddesc">{l.description || `${sub} 개념을 배우는 강의예요.`}</p>
          <div className="ll-cardfoot">
            <span className={`ll-cardstatus${st === 'done' ? ' ll-cardstatus--done' : ''}`}>
              <i
                className={
                  st === 'done'
                    ? 'ph-fill ph-check-circle'
                    : st === 'watching'
                      ? 'ph-fill ph-play-circle'
                      : 'ph-fill ph-sparkle'
                }
              />
              {st === 'done' ? '다시 보기' : st === 'watching' ? '이어서 보기' : '새 강의'}
            </span>
            <button
              className="ll-cardwatch"
              onClick={(e) => {
                e.stopPropagation();
                goWatch(l.id);
              }}
            >
              인강 보기
              <i className="ph-bold ph-arrow-right" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="ll-root">
      <StudentNav />

      <div className="ll-container">
        {/* HERO */}
        <section className="ll-hero">
          <div className="ll-heroleft">
            <span className="ll-herobadge">
              <i className="ph-fill ph-video-camera" />
              강의 카탈로그
            </span>
            <h1 className="ll-herotitle">과목별 강의를 골라 학습하세요</h1>
            <p className="ll-herodesc">
              각 과목의 핵심 개념을 강의로 배우고, 시청 중 확인 문제로 이해를 점검합니다.
            </p>
          </div>
          <div className="ll-herostats">
            {state === 'ready' ? (
              <>
                <div className="ll-herostatnum">
                  {watched}
                  <span className="ll-herostatslash">/{total}편</span>
                </div>
                <div className="ll-herostatlabel">시청 완료</div>
              </>
            ) : state === 'loading' ? (
              <div className="ll-herostatlabel">내 시청 기록을 불러오는 중…</div>
            ) : (
              <div className="ll-herostatlabel ll-herostatlabel-err">시청 기록을 불러오지 못했어요</div>
            )}
          </div>
        </section>

        {/* SUBJECT FILTER TABS */}
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

        {state === 'ready' &&
          visibleSubjects.map((sub) => {
            const s = LECTURE_SUBJECTS[sub];
            // 과목 → 강사별 코스 → 강의. 코스가 하나도 없으면 '기타' 그룹 하나로 떨어진다.
            const groups = courseGroupsForSubject(sub, rows ?? [], courses);
            const subjTotal = groups.reduce((n, g) => n + g.lectures.length, 0);
            if (subjTotal === 0 && tab === '전체') return null; // 전체 탭에선 빈 과목 생략
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
                      {groups.some((g) => g.title) ? ` · 코스 ${groups.filter((g) => g.title).length}개` : ''}
                    </p>
                  </div>
                </div>
                {subjTotal === 0 ? (
                  <div className="ll-state">
                    <i className="ph-fill ph-video-camera-slash" />
                    아직 등록된 {sub} 강의가 없어요. 조금만 기다려 주세요!
                  </div>
                ) : (
                  (() => {
                    // 이 과목에 진짜 코스가 하나라도 있나 — 없으면 '기타 강의' 머리를 숨겨
                    // (코스 없는 과목은 예전처럼 카드만 평면 노출) 어색한 라벨을 피한다.
                    const hasCourses = groups.some((g) => g.title);
                    return groups.map((g) => {
                      const showAll = !!expanded[g.key];
                      const shown = showAll ? g.lectures : g.lectures.slice(0, VISIBLE_PER_GROUP);
                      const hidden = g.lectures.length - shown.length;
                      const showHead = !!g.title || hasCourses;
                      return (
                        <div key={g.key} className="ll-coursegroup">
                          {/* 코스 머리 — 강사별 코스명(+강사). 미분류는 '기타 강의'로 옅게.
                              코스가 아예 없는 과목이면 머리를 생략한다. */}
                          {showHead && (
                            <div className="ll-coursehead">
                              {g.title ? (
                                <>
                                  <span className="ll-coursebadge">
                                    <i className="ph-fill ph-stack" /> 코스
                                  </span>
                                  <h3 className="ll-coursetitle">{g.title}</h3>
                                  {g.instructor && (
                                    <span className="ll-courseinst">
                                      <i className="ph-fill ph-chalkboard-teacher" /> {g.instructor} 선생님
                                    </span>
                                  )}
                                </>
                              ) : (
                                <h3 className="ll-coursetitle ll-coursetitle--none">기타 강의</h3>
                              )}
                              <span className="ll-coursecount">{g.lectures.length}강</span>
                              {/* 코스 Q(3단계-b) — 완주로 열린 문항이 있으면 연습 버튼, 문항은
                                  있는데 전부 잠겨 있으면 '완주하면 열려요'(배움→연습 순서 안내).
                                  은행 배치 문항이 0개면 아무것도 안 보인다(빈 약속 금지). */}
                              {g.course && (g.course.unlocked_question_count ?? 0) > 0 && (
                                <button
                                  className="ll-course-qbtn"
                                  onClick={() =>
                                    navigate(
                                      `${PATHS.STUDENT_GAME}?subject=${encodeURIComponent(sub)}&bank=1&course=${g.course!.id}`,
                                    )
                                  }
                                >
                                  <i className="ph-fill ph-lightning" />
                                  이 코스 문제 풀기 ({g.course.unlocked_question_count})
                                </button>
                              )}
                              {g.course &&
                                (g.course.bank_question_count ?? 0) > 0 &&
                                (g.course.unlocked_question_count ?? 0) === 0 && (
                                  <span className="ll-course-qlock">
                                    <i className="ph-fill ph-lock-simple" />
                                    문제 {g.course.bank_question_count}개 · 강의 완주 시 열려요
                                  </span>
                                )}
                            </div>
                          )}
                        <div className="ll-grid">
                          {shown.map((l, i) => renderCard(l, i, sub))}
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
                        {/* 수료 시험 카드(#28) — 코스 그룹 말미. 배움→연습→증명의 마지막 조각.
                            활성 문항 0개면 렌더 안 함(시험 없는 코스). 상태: 잠김/응시/진행/수료 */}
                        {g.course?.exam?.has_exam && (
                          <ExamCard course={g.course} onGo={() =>
                            navigate(`${PATHS.STUDENT_COURSE_EXAM}?course=${g.course!.id}`)
                          } />
                        )}
                      </div>
                    );
                  });
                })()
                )}
              </section>
            );
          })}
      </div>

      <ScreenTimeReminder />
    </div>
  );
}
