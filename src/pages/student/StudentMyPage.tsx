import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { useAuth } from '../../hooks/useAuth';
import { studentApi } from '../../api/students';
import { lectureApi, type StudentCourse } from '../../api/lectures';
import { StudentNav } from '../../layouts/StudentLayout';
import { profileColor } from '../../utils/profileColor';
import { useRevealOnScroll } from '../../hooks/useRevealOnScroll';
import StatTile from '../../components/student/StatTile';
import CourseCover from '../../components/course/CourseCover';
import CatMark from '../../components/brand/CatMark';
import './StudentMyPage.css';

/**
 * 통합 마이페이지 — 프로필 + 학습 요약 + 수강 코스 + 계정 바로가기.
 * 상단 프로필 아이콘 클릭 시 여기로. 요약은 records().stats, 코스는 courses()의 enrolled 재사용.
 *
 * 디자인 상향(0723): CatMark 브랜드 서명, 코스 생성 커버아트, 데이터시각화 스탯 타일,
 * 진입 리빌(useRevealOnScroll)·hover lift 모션을 얹어 범용 대시보드 룩에서 벗어난다.
 */
// GET /students/me/records 의 stats는 snake_case로 내려온다(MyRecords.mapRecords와 동일 규약).
// camelCase로 읽으면 전부 undefined가 되므로 원시 키 그대로 받고, 필드별로 '—' 폴백한다.
interface MyStats {
  streak_days?: number;
  total_solved?: number;
  avg_accuracy?: number;
  total_hours?: number;
  total_minutes?: number;
}

export default function StudentMyPage() {
  const { me, logout } = useAuth();
  const navigate = useNavigate();
  const name = (me?.name ?? '학습자').trim() || '학습자';
  const age = me?.student?.age ?? null;
  const email = me?.student?.student_login_id ?? me?.email ?? '';

  const [stats, setStats] = useState<MyStats | null>(null);
  const [courses, setCourses] = useState<StudentCourse[] | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  useRevealOnScroll(rootRef);

  useEffect(() => {
    studentApi
      .records()
      .then((d: { stats?: MyStats }) => setStats(d?.stats ?? null))
      .catch(() => setStats(null));
    lectureApi
      .courses()
      .then((cs) => setCourses(cs.filter((c) => c.enrolled)))
      .catch(() => setCourses([]));
  }, []);

  const courseCount = courses?.length ?? null;

  const doLogout = async () => {
    try {
      await logout();
    } finally {
      navigate(PATHS.LOGIN);
    }
  };

  return (
    <div className="mp-root" ref={rootRef}>
      <StudentNav />
      <div className="mp-main cc-reveal-group">
        {/* 프로필 헤더 */}
        <section className="mp-profile">
          <CatMark size={132} variant="ghost" className="mp-profile-cat" />
          <div className="mp-avatar" style={{ background: profileColor(me?.id) }}>
            {name.charAt(0)}
          </div>
          <div className="mp-profileinfo">
            <div className="mp-name">
              {name}
              {age != null ? ` · ${age}세` : ''}
            </div>
            <div className="mp-sub">
              {email}
              {courseCount != null ? ` · 수강 코스 ${courseCount}개` : ''}
            </div>
          </div>
          <button className="mp-editbtn" onClick={() => navigate(PATHS.STUDENT_PROFILE_EDIT)}>
            <i className="ph-bold ph-pencil-simple" /> 수정
          </button>
        </section>

        {/* 학습 요약 */}
        <section className="mp-card">
          <div className="mp-card-head">
            <h2 className="mp-card-title">학습 요약</h2>
            <Link to={PATHS.STUDENT_RECORDS} className="mp-more">
              자세히 <i className="ph-bold ph-arrow-right" />
            </Link>
          </div>
          <div className="mp-stats">
            <StatTile
              icon="ph-fill ph-flame"
              value={stats?.streak_days ?? null}
              label="연속 학습일"
              ratio={stats?.streak_days != null ? stats.streak_days / 30 : null}
            />
            <StatTile
              icon="ph-fill ph-check-circle"
              value={stats?.total_solved ?? null}
              label="푼 문제"
              ratio={stats?.total_solved != null ? stats.total_solved / 500 : null}
            />
            <StatTile
              icon="ph-fill ph-target"
              value={stats?.avg_accuracy ?? null}
              suffix="%"
              label="평균 정답률"
              ratio={stats?.avg_accuracy != null ? stats.avg_accuracy / 100 : null}
            />
            <StatTile
              icon="ph-fill ph-clock"
              value={stats?.total_hours ?? null}
              suffix="시간"
              label="학습 시간"
              ratio={stats?.total_hours != null ? stats.total_hours / 50 : null}
            />
          </div>
        </section>

        {/* 수강 코스 */}
        <section className="mp-card">
          <div className="mp-card-head">
            <h2 className="mp-card-title">
              수강 코스{courseCount != null ? ` (${courseCount})` : ''}
            </h2>
            <Link to={PATHS.STUDENT_LECTURES} className="mp-more">
              강의 <i className="ph-bold ph-arrow-right" />
            </Link>
          </div>
          {courses == null ? (
            <p className="mp-empty">불러오는 중…</p>
          ) : courses.length === 0 ? (
            <div className="mp-emptybox">
              <CatMark size={56} variant="line" whiskers className="mp-empty-cat" />
              <p className="mp-empty">
                아직 수강 중인 코스가 없어요.
                <br />
                <Link to={PATHS.STUDENT_LECTURES} className="mp-inlink">
                  강의 둘러보기 →
                </Link>
              </p>
            </div>
          ) : (
            <ul className="mp-courselist">
              {courses.map((c) => (
                <li key={c.id} className="mp-course">
                  <CourseCover seed={c.id} label={c.title || c.subject} size="sm" />
                  <div className="mp-course-main">
                    <span className="mp-course-title">{c.title}</span>
                    <span className="mp-course-sub">
                      {c.instructor_name ? `${c.instructor_name} 선생님 · ` : ''}
                      {c.lecture_count}강
                      {(c.enrolled_count ?? 0) > 0
                        ? ` · ${c.enrolled_count!.toLocaleString()}명 수강`
                        : ''}
                    </span>
                  </div>
                  {c.exam?.passed ? (
                    <span className="mp-badge mp-badge--done">
                      {c.exam.perfect ? '완벽 수료' : '수료'}
                    </span>
                  ) : (
                    <Link to={PATHS.STUDENT_LECTURES} className="mp-course-go">
                      이어보기 <i className="ph-bold ph-arrow-right" />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 계정 바로가기 */}
        <section className="mp-card">
          <h2 className="mp-card-title">계정</h2>
          <div className="mp-links">
            <Link to={PATHS.STUDENT_RECORDS} className="mp-link">
              <i className="ph-fill ph-chart-line-up" /> 나의 기록
            </Link>
            <Link to={PATHS.STUDENT_SETTINGS} className="mp-link">
              <i className="ph-fill ph-gear-six" /> 설정
            </Link>
            <Link to={PATHS.STUDENT_NOTIFICATIONS} className="mp-link">
              <i className="ph-fill ph-bell" /> 알림
            </Link>
            <button className="mp-link mp-link--danger" onClick={doLogout}>
              <i className="ph-fill ph-sign-out" /> 로그아웃
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
