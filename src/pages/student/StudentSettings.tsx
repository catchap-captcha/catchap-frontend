import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { useAuth } from '../../hooks/useAuth';
import { useStudentSettings } from '../../stores/studentSettingsStore';
import { useTheme } from '../../hooks/useTheme';
import { playSfx } from '../../utils/feedback';
import { profileColor } from '../../utils/profileColor';
import { lectureApi } from '../../api/lectures';
import './StudentSettings.css';
import { StudentNav } from '../../layouts/StudentLayout';

/**
 * handoff `CatChap 설정.dc.html` 포팅.
 * 원본 NAV는 풀 NAV가 아닌 "홈으로" 뒤로 버튼 헤더 → 페이지 내 자체 구현(StudentLayout 미사용).
 * 원본이 screen-time-reminder.js를 로드하지 않으므로 ScreenTimeReminder 미포함.
 */

type ToggleKey =
  | 'eye'
  | 'dark'
  | 'reduce'
  | 'color'
  | 'remind'
  | 'badge'
  | 'weekly'
  | 'sfx'
  | 'voice';

interface StudentSettingsData {
  toggles: Record<ToggleKey, boolean>;
  font: number;
}

interface ToggleRow {
  key: ToggleKey;
  title: string;
  sub: string;
  icon: string;
  bg: string;
  color: string;
}

/* 원본 display/notify/sound 행 정의 그대로 */
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

/* 원본 links 그대로 (href는 HANDOFF_ROUTE_MAP 매핑) */
const LINK_ROWS = [
  { title: '비밀번호 변경', sub: '로그인 비밀번호를 바꿉니다', icon: 'ph-fill ph-lock-key', bg: 'var(--brand-soft)', color: 'var(--brand)', to: PATHS.PASSWORD_RESET },
  { title: '개인정보 처리방침', sub: '내 정보가 어떻게 쓰이는지 확인합니다', icon: 'ph-fill ph-shield-check', bg: 'var(--ok-soft)', color: 'var(--ok)', to: PATHS.PRIVACY },
  { title: '이용약관', sub: '서비스 이용 규칙을 확인합니다', icon: 'ph-fill ph-scroll', bg: 'var(--info-soft)', color: 'var(--info)', to: PATHS.TERMS },
  { title: '문의하기', sub: '궁금한 점을 문의합니다', icon: 'ph-fill ph-chat-circle-text', bg: 'var(--warn-soft)', color: 'var(--warn)', to: PATHS.CONTACT },
];

const FONT_LABELS = ['작게', '보통', '크게'];

export default function StudentSettings() {
  const { me, logout } = useAuth();
  const navigate = useNavigate();
  // 전역 설정 스토어 — 변경 즉시 화면 효과 적용(눈보호/다크/모션/색약/글자크기) + 서버 저장
  const { settings, update } = useStudentSettings();
  // '어두운 화면'은 이제 전역 다크 모드(상단바 토글과 동일 상태)를 켠다.
  const { theme, setTheme } = useTheme();
  const [logoutOpen, setLogoutOpen] = useState(false);

  const name = (me?.name ?? '학습자').trim() || '학습자';
  const age = me?.student?.age ?? null; // /auth/me student.age 실데이터
  // 가입 이메일 — 이메일 가입 학생은 student_login_id가 이메일이다(학교 경유는 로그인 아이디).
  const email = me?.student?.student_login_id ?? me?.email ?? '';
  // 수강 코스 수 — /courses의 enrolled 플래그로 센다(별도 엔드포인트 없이 재사용).
  const [courseCount, setCourseCount] = useState<number | null>(null);
  useEffect(() => {
    lectureApi
      .courses()
      .then((cs) => setCourseCount(cs.filter((c) => c.enrolled).length))
      .catch(() => setCourseCount(null));
  }, []);

  const persist = (next: StudentSettingsData) => update(next);

  const tog = (key: ToggleKey) => {
    playSfx('click');
    persist({ ...settings, toggles: { ...settings.toggles, [key]: !settings.toggles[key] } });
  };

  const confirmLogout = async () => {
    await logout();
    navigate('/');
  };

  const renderToggleRow = (row: ToggleRow) => {
    // 다크 모드 행은 전역 테마 상태를 읽고 쓴다(다른 행은 학생 설정 스토어).
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

  return (
    <div className="st-root">
      {/* NAV */}
      {/* NAV — 공용 StudentNav로 통일(사용자 결정 0714) */}
      <StudentNav />

      <div className="st-main">
        {/* PROFILE */}
        <div className="st-profile">
          <div className="st-avatar" style={{ background: profileColor(me?.id) }}>
            {name.charAt(0)}
          </div>
          <div className="st-profileinfo">
            <div className="st-profilename">
              {name}
              {age != null ? ` · ${age}세` : ''}
            </div>
            <div className="st-profilesub">
              {email}
              {courseCount != null ? ` · 수강 코스 ${courseCount}개` : ''}
            </div>
          </div>
          {/* 이름·나이 수정 — 프로필 수정 페이지로 이동 */}
          <button className="st-editbtn" onClick={() => navigate(PATHS.STUDENT_PROFILE_EDIT)}>
            <i className="ph-bold ph-pencil-simple" /> 수정
          </button>
        </div>

        {/* SECTION: 화면 & 눈 건강 */}
        <div className="st-card">
          <div className="st-cardtitle">
            <i className="ph-fill ph-eye" />
            화면 &amp; 눈 건강
          </div>
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
        </div>

        {/* SECTION: 알림 */}
        <div className="st-card">
          <div className="st-cardtitle">
            <i className="ph-fill ph-bell" />
            알림
          </div>
          {NOTIFY_ROWS.map(renderToggleRow)}
        </div>

        {/* SECTION: 소리 */}
        <div className="st-card">
          <div className="st-cardtitle">
            <i className="ph-fill ph-speaker-high" />
            소리
          </div>
          {SOUND_ROWS.map(renderToggleRow)}
        </div>

        {/* SECTION: 계정 & 개인정보 */}
        <div className="st-card">
          <div className="st-cardtitle">
            <i className="ph-fill ph-shield-check" />
            계정 &amp; 개인정보
          </div>
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
        </div>

        {/* LOGOUT */}
        <button className="st-logout" onClick={() => setLogoutOpen(true)}>
          <i className="ph-fill ph-sign-out" />
          로그아웃
        </button>
        <p className="st-version">CatChap v1.2 · © 2026 CatChap</p>
      </div>

      {/* LOGOUT CONFIRM POPUP */}
      {logoutOpen && (
        <div className="st-overlay" onClick={() => setLogoutOpen(false)}>
          <div className="st-popup" onClick={(e) => e.stopPropagation()}>
            <div className="st-popicon">
              <i className="ph-fill ph-sign-out" />
            </div>
            <h2 className="st-poptitle">로그아웃 하시겠어요?</h2>
            <p className="st-poptext">
              로그아웃하면 다시 로그인해야
              <br />
              학습을 이어갈 수 있어요.
            </p>
            <div className="st-popbtns">
              <button className="st-cancel" onClick={() => setLogoutOpen(false)}>
                취소
              </button>
              <button className="st-confirm" onClick={confirmLogout}>
                <i className="ph-fill ph-check-circle" />
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
