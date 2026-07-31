import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StudentLayout from '../../layouts/StudentLayout';
import { PATHS } from '../../routes/paths';
import { useAuth } from '../../hooks/useAuth';
import { lectureApi, thumbnailSrc, type LectureItem, type StudentCourse } from '../../api/lectures';
import CourseCover from '../../components/course/CourseCover';
import InstructorBioModal from '../../components/course/InstructorBioModal';
import CountUp from '../../components/motion/CountUp';
import { formatClock } from './lectureSubjects';
import './LectureList.css';
import './StudentHome.css';

type WatchState = 'new' | 'watching' | 'done';
function watchState(l: LectureItem): WatchState {
  if (l.progress?.status === 'done') return 'done';
  if ((l.progress?.watched_max_sec ?? 0) > 0) return 'watching';
  return 'new';
}

/** 코스별 강의 묶음 — 홈의 '내 코스'·'이런 코스는 어때요'가 강의 카드 그리드로 쓴다. */
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

  // 강의 둘러보기 분야 칩 — 미신청 코스의 subject로 필터(홈 버전 태그 필터). 전체 조건 필터는
  // '전체 보기'의 카탈로그(강의 신청)에서. 없는 분야를 만들지 않게 실제 코스 subject만 칩으로.
  const [browseCat, setBrowseCat] = useState('전체');
  const browseCats = useMemo(() => {
    const subs = Array.from(new Set(discoverGroups.map((g) => g.course.subject).filter(Boolean)));
    return ['전체', ...subs];
  }, [discoverGroups]);
  const shownDiscover =
    browseCat === '전체'
      ? discoverGroups
      : discoverGroups.filter((g) => g.course.subject === browseCat);

  // 강사 소개 모달 — '내 코스'·'이런 코스는 어때요' 양쪽 코스 머리의 버튼이 연다.
  const [bioFor, setBioFor] = useState<{ name: string; courseTitle: string | null } | null>(null);

  // 이어서 학습 레일 — 시청 중(watching)인 강의(발견·재방문 유도). 히어로의 1건과 겹쳐도
  // 여러 개를 가로 스크롤로 노출하는 게 목적(넷플릭스·Coursera '이어보기' 레일 패턴).
  const watchingLecs = useMemo(
    () => (lectures ?? []).filter((l) => l.progress?.status === 'watching'),
    [lectures],
  );

  const goWatch = (id: string) => navigate(PATHS.STUDENT_LECTURE, { state: { id } });

  /** 강의 카드 — 강의 신청 카탈로그(LectureList)와 동일한 ll-card 룩을 재사용한다.
   *  locked=true(미신청)면 설명·시청 버튼을 빼고 '수강신청 후 시청 가능' 잠금 표시만 남긴다. */
  const renderLectureCard = (l: LectureItem, i: number, locked: boolean) => {
    const st = watchState(l);
    const num = i + 1;
    const badgeText = st === 'done' ? '학습 완료' : st === 'watching' ? '학습중' : '새 강의';
    return (
      <div
        key={l.id}
        className={`ll-card${locked ? ' ll-card--locked' : ''}`}
        onClick={locked ? undefined : () => goWatch(l.id)}
      >
        <div className="ll-thumb">
          <CourseCover
            seed={l.course_id || l.id}
            label={l.title}
            imageUrl={thumbnailSrc(l.thumbnail_url)}
            size="md"
            className="ll-thumb-cover"
          />
          <span className="ll-badge">{locked ? '미리보기' : badgeText}</span>
          <span className="ll-time">{formatClock(l.duration_sec)}</span>
        </div>
        <div className="ll-cardbody">
          <span className="ll-cardchip">{num}강</span>
          <div className="ll-cardtitle">{l.title}</div>
          {locked ? (
            <div className="ll-cardlock">
              <i className="ph-fill ph-lock-simple" />
              수강신청 후 시청 가능
            </div>
          ) : (
            <>
              <p className="ll-carddesc">{l.description || '이 강의의 내용을 배워요.'}</p>
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
            </>
          )}
        </div>
      </div>
    );
  };

  /** 코스 묶음 하나 — 작은 코스 머리(커버·제목·강 수) + 강의 카드 그리드. */
  const renderGroup = (g: HomeCourseGroup, locked: boolean) => (
    <div key={g.course.id} className="sh2-lecgroup">
      <div className="sh2-lecgroup-head">
        <CourseCover
          seed={g.course.id}
          label={g.course.title || g.course.subject}
          imageUrl={thumbnailSrc(g.course.thumbnail_url)}
          size="sm"
          className="sh2-lecgroup-cover"
        />
        <div className="sh2-lecgroup-meta">
          <h3 className="sh2-lecgroup-title">{g.course.title}</h3>
          <span className="sh2-lecgroup-sub">
            {g.course.instructor_name ? `${g.course.instructor_name} 강사 · ` : ''}
            {g.lectures.length}강
          </span>
          {/* 강사 소개 — 강사가 프로필에 저장한 이력을 그 자리에서 펼쳐 본다 */}
          {g.course.instructor_name && (
            <button
              type="button"
              className="ibm-trigger sh2-lecgroup-bio"
              onClick={() =>
                setBioFor({ name: g.course.instructor_name!, courseTitle: g.course.title })
              }
            >
              <i className="ph-fill ph-user-circle" /> 강사 소개
            </button>
          )}
        </div>
        {locked && (
          <button
            className="sh2-lecgroup-cta"
            onClick={() => navigate(`${PATHS.STUDENT_CHECKOUT}?course=${g.course.id}`)}
          >
            <i className="ph-bold ph-plus-circle" /> 수강신청
          </button>
        )}
      </div>
      <div className="ll-grid">{g.lectures.map((l, i) => renderLectureCard(l, i, locked))}</div>
    </div>
  );

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
        {state === 'ready' && discoverGroups.length === 0 && (
          <div className="sh2-empty">지금은 둘러볼 새 강의가 없어요.</div>
        )}

        {state === 'ready' && discoverGroups.length > 0 && (
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
            <div className="sh2-lecgroups">
              {shownDiscover.map((g) => renderGroup(g, true))}
            </div>
          </>
        )}
      </section>

      {bioFor && (
        <InstructorBioModal
          name={bioFor.name}
          courseTitle={bioFor.courseTitle}
          onClose={() => setBioFor(null)}
        />
      )}
    </StudentLayout>
  );
}
