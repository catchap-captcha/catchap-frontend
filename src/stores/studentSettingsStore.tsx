import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { settingsApi } from '../api/settings';
import { useAuth } from '../hooks/useAuth';

/** 학생 설정 — 설정 화면(StudentSettings)의 항목과 1:1 */
export interface StudentToggles {
  eye: boolean; // 눈 보호 모드 (따뜻한 색)
  dark: boolean; // 어두운 화면
  reduce: boolean; // 움직임 줄이기 (애니메이션 off)
  color: boolean; // 색약 친화 표시 (대비·채도 보정)
  remind: boolean; // 학습 리마인드 알림
  badge: boolean; // 배지 획득 알림
  weekly: boolean; // 주간 요약 알림
  sfx: boolean; // 효과음
  voice: boolean; // 냥냥이 목소리 (TTS)
}

export interface StudentSettingsData {
  toggles: StudentToggles;
  font: number; // 0 작게 | 1 보통 | 2 크게
}

export const DEFAULT_STUDENT_SETTINGS: StudentSettingsData = {
  toggles: {
    eye: true,
    dark: false,
    reduce: false,
    color: false,
    remind: true,
    badge: true,
    weekly: false,
    sfx: true,
    voice: true,
  },
  font: 1,
};

const LS_KEY = 'catchap_settings';

export function getCachedStudentSettings(): StudentSettingsData {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_STUDENT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      toggles: { ...DEFAULT_STUDENT_SETTINGS.toggles, ...(parsed.toggles ?? {}) },
      font: typeof parsed.font === 'number' ? parsed.font : 1,
    };
  } catch {
    return DEFAULT_STUDENT_SETTINGS;
  }
}

/** 글자 크기 → 루트 zoom (디자인 px 값 기반이라 rem 대신 zoom 사용) */
const FONT_ZOOM = [0.92, 1, 1.08];

function applyToDocument(s: StudentSettingsData, active: boolean) {
  const root = document.documentElement;
  if (!active) {
    delete root.dataset.ccEye;
    delete root.dataset.ccDark;
    delete root.dataset.ccReduce;
    delete root.dataset.ccColor;
    const app = document.getElementById('root');
    if (app) app.style.removeProperty('zoom');
    return;
  }
  root.dataset.ccEye = s.toggles.eye ? '1' : '0';
  root.dataset.ccDark = s.toggles.dark ? '1' : '0';
  root.dataset.ccReduce = s.toggles.reduce ? '1' : '0';
  root.dataset.ccColor = s.toggles.color ? '1' : '0';
  const app = document.getElementById('root');
  if (app) app.style.setProperty('zoom', String(FONT_ZOOM[s.font] ?? 1));
}

interface Ctx {
  settings: StudentSettingsData;
  update: (next: StudentSettingsData) => void;
}

const StudentSettingsContext = createContext<Ctx | null>(null);

export function StudentSettingsProvider({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const isStudent = me?.role === 'student';
  const [settings, setSettings] = useState<StudentSettingsData>(getCachedStudentSettings);

  // 서버 설정 로드 (학생 로그인 시)
  useEffect(() => {
    if (!isStudent) return;
    settingsApi
      .get()
      .then((data) => {
        if (data && typeof data === 'object') {
          setSettings((s) => ({
            toggles: { ...s.toggles, ...(data.toggles ?? {}) },
            font: typeof data.font === 'number' ? data.font : s.font,
          }));
        }
      })
      .catch(() => {
        /* 서버 실패 시 localStorage 캐시 유지 */
      });
  }, [isStudent]);

  // 화면 효과 적용 + 캐시 (학생일 때만; 로그아웃/타 역할이면 해제)
  useEffect(() => {
    applyToDocument(settings, isStudent);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
    return () => applyToDocument(settings, false);
  }, [settings, isStudent]);

  const update = useCallback((next: StudentSettingsData) => {
    setSettings(next);
    settingsApi.save(next).catch(() => {
      /* 저장 실패해도 로컬 적용은 유지 (원본 동작) */
    });
  }, []);

  return (
    <StudentSettingsContext.Provider value={{ settings, update }}>
      {children}
      {/* 화면 효과 오버레이 — 포인터 통과, 모달 위 포함 전체 화면.
          body filter 방식은 position:fixed(모달)를 깨뜨려 backdrop-filter 오버레이 사용 */}
      {isStudent && <div className="cc-screen-fx" aria-hidden="true" />}
    </StudentSettingsContext.Provider>
  );
}

export function useStudentSettings(): Ctx {
  const ctx = useContext(StudentSettingsContext);
  if (!ctx) throw new Error('useStudentSettings must be used within StudentSettingsProvider');
  return ctx;
}
