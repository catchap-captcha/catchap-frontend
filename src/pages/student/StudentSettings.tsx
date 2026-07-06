import { useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { useAuth } from '../../hooks/useAuth';
import { useStudentSettings } from '../../stores/studentSettingsStore';
import { playSfx } from '../../utils/feedback';
import './StudentSettings.css';

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
  { key: 'eye', title: '눈 보호 모드', sub: '따뜻한 색으로 눈을 편하게 해줘요', icon: 'ph-fill ph-eye', bg: '#E1F5EC', color: '#17B08C' },
  { key: 'dark', title: '어두운 화면', sub: '밤에 보기 편한 다크 모드', icon: 'ph-fill ph-moon', bg: '#EDE6FF', color: '#8B6BFF' },
  { key: 'reduce', title: '움직임 줄이기', sub: '화면 애니메이션을 줄여요', icon: 'ph-fill ph-wind', bg: '#E6F0FF', color: '#2E7BFF' },
  { key: 'color', title: '색약 친화 표시', sub: '색 외에 아이콘·모양으로도 구분해요', icon: 'ph-fill ph-circles-three', bg: '#FFEDE0', color: '#FF922E' },
];

const NOTIFY_ROWS: ToggleRow[] = [
  { key: 'remind', title: '학습 리마인드', sub: '오늘 학습을 잊지 않게 알려줘요', icon: 'ph-fill ph-alarm', bg: '#FFEDE0', color: '#FF922E' },
  { key: 'badge', title: '배지 획득 알림', sub: '새 배지를 얻으면 알려줘요', icon: 'ph-fill ph-medal', bg: '#FFF3D6', color: '#F0A400' },
  { key: 'weekly', title: '주간 요약 알림', sub: '한 주 학습을 정리해서 보내요', icon: 'ph-fill ph-calendar-check', bg: '#E6F0FF', color: '#2E7BFF' },
];

const SOUND_ROWS: ToggleRow[] = [
  { key: 'sfx', title: '효과음', sub: '정답·오답 소리를 켜요', icon: 'ph-fill ph-music-notes', bg: '#FFE3E9', color: '#FF5A6E' },
  { key: 'voice', title: '냥냥이 목소리', sub: 'AI 선생님이 말로 알려줘요', icon: 'ph-fill ph-microphone', bg: '#EDE6FF', color: '#8B6BFF' },
];

/* 원본 links 그대로 (href는 HANDOFF_ROUTE_MAP 매핑) */
const LINK_ROWS = [
  { title: '비밀번호 변경', sub: '로그인 비밀번호를 바꿔요', icon: 'ph-fill ph-lock-key', bg: '#FFE3E9', color: '#FF5A6E', to: PATHS.PASSWORD_RESET },
  { title: '개인정보 처리방침', sub: '내 정보가 어떻게 쓰이는지 확인해요', icon: 'ph-fill ph-shield-check', bg: '#E1F5EC', color: '#17B08C', to: PATHS.PRIVACY },
  { title: '이용약관', sub: '서비스 이용 규칙을 확인해요', icon: 'ph-fill ph-scroll', bg: '#E6F0FF', color: '#2E7BFF', to: PATHS.TERMS },
  { title: '고객 지원', sub: '궁금한 점을 물어봐요', icon: 'ph-fill ph-lifebuoy', bg: '#FFEDE0', color: '#FF922E', to: PATHS.SUPPORT },
];

const FONT_LABELS = ['작게', '보통', '크게'];

export default function StudentSettings() {
  const { me, logout } = useAuth();
  const navigate = useNavigate();
  // 전역 설정 스토어 — 변경 즉시 화면 효과 적용(눈보호/다크/모션/색약/글자크기) + 서버 저장
  const { settings, update } = useStudentSettings();
  const [logoutOpen, setLogoutOpen] = useState(false);

  const name = (me?.name ?? '하은').trim() || '하은';
  const school = me?.organization_name ?? '햇살초등학교';
  const level = me?.student?.level ?? 7;
  const age = me?.student?.age ?? 7; // /auth/me student.age 실데이터

  const persist = (next: StudentSettingsData) => update(next);

  const tog = (key: ToggleKey) => {
    playSfx('click');
    persist({ ...settings, toggles: { ...settings.toggles, [key]: !settings.toggles[key] } });
  };

  const confirmLogout = async () => {
    await logout();
    navigate('/');
  };

  const renderToggleRow = (row: ToggleRow) => (
    <div key={row.key} className="st-row">
      <span className="st-rowicon" style={{ '--bg': row.bg, '--c': row.color } as CSSProperties}>
        <i className={row.icon} />
      </span>
      <div className="st-rowinfo">
        <div className="st-rowtitle">{row.title}</div>
        <div className="st-rowsub">{row.sub}</div>
      </div>
      <button
        className={`st-toggle${settings.toggles[row.key] ? ' st-toggle--on' : ''}`}
        onClick={() => tog(row.key)}
      >
        <span className="st-knob" />
      </button>
    </div>
  );

  return (
    <div className="st-root">
      {/* NAV */}
      <div className="st-navbar">
        <div className="st-navinner">
          <Link to={PATHS.STUDENT_HOME} className="st-back">
            <i className="ph-bold ph-arrow-left" />
            홈으로
          </Link>
          <div className="st-navtitle">
            <span className="st-navicon">
              <i className="ph-fill ph-gear-six" />
            </span>
            <span className="st-navname">설정</span>
          </div>
        </div>
      </div>

      <div className="st-main">
        {/* PROFILE */}
        <div className="st-profile">
          <div className="st-avatar">{name.charAt(0)}</div>
          <div className="st-profileinfo">
            <div className="st-profilename">{name} · {age}세</div>
            <div className="st-profilesub">
              {school} · 학습 레벨 {level}
            </div>
          </div>
          <Link to={PATHS.STUDENT_PROFILE} className="st-profilebtn">
            <i className="ph-fill ph-paint-brush" />
            프로필 꾸미기
          </Link>
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
