import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { useAuth } from '../../hooks/useAuth';
import { studentApi } from '../../api/students';
import { lectureApi, type StudentCourse } from '../../api/lectures';
import { StudentNav } from '../../layouts/StudentLayout';
import { profileColor } from '../../utils/profileColor';
import { useStudentSettings } from '../../stores/studentSettingsStore';
import { useTheme } from '../../hooks/useTheme';
import { playSfx } from '../../utils/feedback';
import StatTile from '../../components/student/StatTile';
import CourseCover from '../../components/course/CourseCover';
import CatMark from '../../components/brand/CatMark';
import './StudentSettings.css';
import './StudentMyPage.css';

/**
 * 통합 마이페이지 = 계정 허브 (좌측 사이드바 탭) — 인프런·Udemy식 account center.
 *
 * 왜 재편(0723): 종전 마이페이지는 프로필+학습요약+수강코스+계정링크를 한 화면에 쌓았는데,
 * 프로필 헤더가 설정과 중복되고 학습요약·수강코스는 나의 기록·홈과 겹쳐 고유 역할이 옅었다.
 * 실서비스처럼 '계정 허브' 하나로 모으고 좌측 탭으로 섹션을 전환한다. **설정 페이지를 흡수**해
 * (프로필/학습 요약/계정·개인정보/알림/화면·소리) 탭으로 편성, 프로필 헤더를 한 곳으로 통일한다.
 * 탭은 ?tab= 쿼리로 링크·뒤로가기 친화(실서비스 규약).
 */
type TabKey = 'profile' | 'learning' | 'account' | 'notify' | 'display';
const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'profile', label: '프로필', icon: 'ph-fill ph-user' },
  { key: 'learning', label: '학습 요약', icon: 'ph-fill ph-chart-line-up' },
  { key: 'account', label: '계정·개인정보', icon: 'ph-fill ph-shield-check' },
  { key: 'notify', label: '알림', icon: 'ph-fill ph-bell' },
  { key: 'display', label: '화면·소리', icon: 'ph-fill ph-eye' },
];

// GET /students/me/records 의 stats는 snake_case(MyRecords.mapRecords와 동일 규약).
interface MyStats {
  streak_days?: number;
  total_solved?: number;
  avg_accuracy?: number;
  total_hours?: number;
  total_minutes?: number;
}

// 설정 페이지에서 흡수한 토글/링크 정의 (원본 StudentSettings와 동일 — 계정 허브로 이관)
type ToggleKey = 'eye' | 'dark' | 'reduce' | 'color' | 'remind' | 'badge' | 'weekly' | 'sfx' | 'voice';
interface ToggleRow {
  key: ToggleKey;
  title: string;
  sub: string;
  icon: string;
  bg: string;
  color: string;
}
const DISPLAY_ROWS: ToggleRow[] = [
  { key: 'eye', title: '눈 보호 모드', sub: '따뜻한 색으로 눈부심을 줄입니다', icon: 'ph-fill ph-eye', bg: 'var(--ok-soft)', color: 'var(--ok)' },
  { key: 'dark', title: '어두운 화면', sub: '밤에 보기 편한 다크 모드', icon: 'ph-fill ph-moon', bg: 'var(--info-soft)', color: 'var(--info)' },
  { key: 'reduce', title: '움직임 줄이기', sub: '화면 애니메이션을 줄입니다', icon: 'ph-fill ph-wind', bg: 'var(--info-soft)', color: 'var(--info)' },
  { key: 'color', title: '색약 친화 표시', sub: '색 외에 아이콘·모양으로도 구분합니다', icon: 'ph-fill ph-circles-three', bg: 'var(--warn-soft)', color: 'var(--warn)' },
];
const NOTIFY_ROWS: ToggleRow[] = [
  { key: 'remind', title: '학습 리마인드', sub: '오늘 학습을 잊지 않게 알려줍니다', icon: 'ph-fill ph-alarm', bg: 'var(--warn-soft)', color: 'var(--warn)' },
  { key: 'badge', title: '배지 획득 알림', sub: '새 배지를 얻으면 알려줍니다', icon: 'ph-fill ph-medal', bg: 'var(--warn-soft)', color: 'var(--warn)' },
  { key: 'weekly', title: '주간 요약 알림', sub: '한 주 학습을 정리해서 보냅니다', icon: 'ph-fill ph-calendar-check', bg: 'var(--info-soft)', color: 'var(--info)' },
];
const SOUND_ROWS: ToggleRow[] = [
  { key: 'sfx', title: '효과음', sub: '정답·오답 소리를 켭니다', icon: 'ph-fill ph-music-notes', bg: 'var(--brand-soft)', color: 'var(--brand)' },
  { key: 'voice', title: '음성 안내', sub: 'AI 선생님이 음성으로 안내합니다', icon: 'ph-fill ph-microphone', bg: 'var(--info-soft)', color: 'var(--info)' },
];
const LINK_ROWS = [
  { title: '비밀번호 변경', sub: '로그인 비밀번호를 바꿉니다', icon: 'ph-fill ph-lock-key', bg: 'var(--brand-soft)', color: 'var(--brand)', to: PATHS.PASSWORD_RESET },
  { title: '개인정보 처리방침', sub: '내 정보가 어떻게 쓰이는지 확인합니다', icon: 'ph-fill ph-shield-check', bg: 'var(--ok-soft)', color: 'var(--ok)', to: PATHS.PRIVACY },
  { title: '이용약관', sub: '서비스 이용 규칙을 확인합니다', icon: 'ph-fill ph-scroll', bg: 'var(--info-soft)', color: 'var(--info)', to: PATHS.TERMS },
  { title: '고객 지원', sub: '궁금한 점을 문의합니다', icon: 'ph-fill ph-lifebuoy', bg: 'var(--warn-soft)', color: 'var(--warn)', to: PATHS.SUPPORT },
];
const FONT_LABELS = ['작게', '보통', '크게'];

export default function StudentMyPage() {
  const { me, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { settings, update } = useStudentSettings();
  const { theme, setTheme } = useTheme();

  const rawTab = searchParams.get('tab') as TabKey | null;
  const tab: TabKey = TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : 'profile';
  const setTab = (t: TabKey) =>
    setSearchParams(t === 'profile' ? {} : { tab: t }, { replace: false });

  const name = (me?.name ?? '학습자').trim() || '학습자';
  const age = me?.student?.age ?? null;
  const email = me?.student?.student_login_id ?? me?.email ?? '';

  const [stats, setStats] = useState<MyStats | null>(null);
  // 실집계가 없어 서버가 데모(예시)값을 내려주면 demo=true → 가짜 숫자 대신 빈 상태를 보여준다.
  const [demo, setDemo] = useState(false);
  const [courses, setCourses] = useState<StudentCourse[] | null>(null);
  useEffect(() => {
    studentApi
      .records()
      .then((d: { stats?: MyStats; demo?: boolean }) => {
        setStats(d?.stats ?? null);
        setDemo(!!d?.demo);
      })
      .catch(() => setStats(null));
    lectureApi
      .courses()
      .then((cs) => setCourses(cs.filter((c) => c.enrolled)))
      .catch(() => setCourses([]));
  }, []);
  const courseCount = courses?.length ?? null;

  const persist = (next: { toggles: Record<ToggleKey, boolean>; font: number }) => update(next);
  const tog = (key: ToggleKey) => {
    playSfx('click');
    persist({ ...settings, toggles: { ...settings.toggles, [key]: !settings.toggles[key] } });
  };
  const renderToggleRow = (row: ToggleRow) => {
    // '어두운 화면'만 전역 테마(상단바 토글과 동일 상태), 나머지는 학생 설정 스토어.
    const isDark = row.key === 'dark';
    const on = isDark ? theme === 'dark' : settings.toggles[row.key];
    const onClick = isDark
      ? () => {
          playSfx('click');
          setTheme(theme === 'dark' ? 'light' : 'dark');
        }
      : () => tog(row.key);
    return (
      <div key={row.key} className="st-row">
        <span className="st-rowicon" style={{ '--bg': row.bg, '--c': row.color } as CSSProperties}>
          <i className={row.icon} />
        </span>
        <div className="st-rowinfo">
          <div className="st-rowtitle">{row.title}</div>
          <div className="st-rowsub">{row.sub}</div>
        </div>
        <button className={`st-toggle${on ? ' st-toggle--on' : ''}`} onClick={onClick}>
          <span className="st-knob" />
        </button>
      </div>
    );
  };

  const doLogout = async () => {
    try {
      await logout();
    } finally {
      navigate(PATHS.LOGIN);
    }
  };

  return (
    <div className="mp-root">
      <StudentNav />
      <div className="mp-hub">
        {/* ===== 좌측 사이드바 ===== */}
        <aside className="mp-side">
          <div className="mp-side-user">
            <div className="mp-avatar-sm" style={{ background: profileColor(me?.id) }}>
              {name.charAt(0)}
            </div>
            <div className="mp-side-id">
              <div className="mp-side-name">{name}</div>
              <div className="mp-side-email">{email}</div>
            </div>
          </div>
          <nav className="mp-tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`mp-tab${tab === t.key ? ' mp-tab-on' : ''}`}
                onClick={() => setTab(t.key)}
              >
                <i className={t.icon} />
                {t.label}
              </button>
            ))}
          </nav>
          <button className="mp-logout" onClick={doLogout}>
            <i className="ph-fill ph-sign-out" /> 로그아웃
          </button>
        </aside>

        {/* ===== 우측 콘텐츠 패널 ===== */}
        <div className="mp-panel">
          {/* 프로필 */}
          {tab === 'profile' && (
            <section className="mp-card mp-profile">
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
          )}

          {/* 학습 요약 */}
          {tab === 'learning' && (
            <>
              <section className="mp-card">
                <div className="mp-card-head">
                  <h2 className="mp-card-title">학습 요약</h2>
                  <Link to={PATHS.STUDENT_RECORDS} className="mp-more">
                    자세히 <i className="ph-bold ph-arrow-right" />
                  </Link>
                </div>
                {demo ? (
                  <div className="mp-emptybox">
                    <CatMark size={56} variant="line" whiskers className="mp-empty-cat" />
                    <p className="mp-empty">
                      아직 학습 기록이 없어요.
                      <br />
                      강의를 듣고 확인 문제를 풀면 학습 요약이 여기에 쌓여요.
                      <br />
                      <Link to={PATHS.STUDENT_LECTURES} className="mp-inlink">
                        강의 시작하기 →
                      </Link>
                    </p>
                  </div>
                ) : (
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
                )}
              </section>

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
            </>
          )}

          {/* 계정·개인정보 */}
          {tab === 'account' && (
            <section className="mp-card">
              <h2 className="mp-card-title mp-card-title--pad">계정 · 개인정보</h2>
              {LINK_ROWS.map((row) => (
                <Link key={row.title} to={row.to} className="st-link">
                  <span
                    className="st-rowicon"
                    style={{ '--bg': row.bg, '--c': row.color } as CSSProperties}
                  >
                    <i className={row.icon} />
                  </span>
                  <div className="st-rowinfo">
                    <div className="st-rowtitle">{row.title}</div>
                    <div className="st-rowsub">{row.sub}</div>
                  </div>
                  <i className="ph-bold ph-caret-right st-caret" />
                </Link>
              ))}
            </section>
          )}

          {/* 알림 */}
          {tab === 'notify' && (
            <section className="mp-card">
              <h2 className="mp-card-title mp-card-title--pad">알림</h2>
              {NOTIFY_ROWS.map(renderToggleRow)}
            </section>
          )}

          {/* 화면·소리 */}
          {tab === 'display' && (
            <>
              <section className="mp-card">
                <h2 className="mp-card-title mp-card-title--pad">화면 &amp; 눈 건강</h2>
                {DISPLAY_ROWS.map(renderToggleRow)}
                <div className="st-row">
                  <span
                    className="st-rowicon"
                    style={{ '--bg': '#FFF3D6', '--c': '#F0A400' } as CSSProperties}
                  >
                    <i className="ph-fill ph-text-aa" />
                  </span>
                  <div className="st-rowinfo">
                    <div className="st-rowtitle">글자 크기</div>
                    <div className="st-rowsub">읽기 편한 크기로 맞춰요</div>
                  </div>
                  <div className="st-fonts">
                    {FONT_LABELS.map((label, i) => (
                      <button
                        key={label}
                        className={`st-fbtn${settings.font === i ? ' st-fbtn--on' : ''}`}
                        onClick={() => persist({ ...settings, font: i })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </section>
              <section className="mp-card">
                <h2 className="mp-card-title mp-card-title--pad">소리</h2>
                {SOUND_ROWS.map(renderToggleRow)}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
