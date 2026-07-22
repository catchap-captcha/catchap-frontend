/**
 * 강의 화면(목록·강의실) 공용 과목 테마 — Concepts.tsx의 SUBJECTS와 동일한 디자인 값.
 * (새 팔레트 발명 금지 — 기존 과목별 색·그라데이션·아이콘을 그대로 재사용한다)
 */
export interface LectureSubjectTheme {
  color: string;
  soft: string;
  band: string;
  grad: string;
  icon: string;
}

export const LECTURE_SUBJECTS: Record<string, LectureSubjectTheme> = {
  '국어': { color: '#ea5443', soft: '#fcede9', band: 'linear-gradient(150deg,#FFE6E0,#FFD3CB)', grad: 'linear-gradient(150deg,#FF7A7A,#FF5A6E)', icon: 'ph-fill ph-book-open' },
  '영어': { color: '#FF922E', soft: '#FFEDD6', band: 'linear-gradient(150deg,#FFEFD9,#FFE0BE)', grad: 'linear-gradient(150deg,#FFB43C,#FF922E)', icon: 'ph-fill ph-translate' },
  '수학': { color: '#17B08C', soft: '#DFF6EE', band: 'linear-gradient(150deg,#E4F7F0,#CDEEE1)', grad: 'linear-gradient(150deg,#33C892,#17B0A0)', icon: 'ph-fill ph-plus-minus' },
  '과학': { color: '#2E7BFF', soft: '#E1EDFF', band: 'linear-gradient(150deg,#E9F1FF,#D3E3FF)', grad: 'linear-gradient(150deg,#4AA6FF,#2E7BFF)', icon: 'ph-fill ph-flask' },
  '사회': { color: '#8B6BFF', soft: '#EAE2FF', band: 'linear-gradient(150deg,#EFE9FF,#DED2FF)', grad: 'linear-gradient(150deg,#A98CFF,#8B6BFF)', icon: 'ph-fill ph-scroll' },
  '생활': { color: '#FF6DA6', soft: '#FFE3EF', band: 'linear-gradient(150deg,#FFE8F1,#FFD3E3)', grad: 'linear-gradient(150deg,#FF93BE,#FF6DA6)', icon: 'ph-fill ph-house-line' },
};

export const LECTURE_SUBJECT_ORDER = ['국어', '영어', '수학', '과학', '사회', '생활'];

/** 위 6개(구 학교 과목) 밖의 분류(예: 코스 중심 전환 후 기본값 '일반', 성인 인강 카테고리)를
 *  위한 기본 테마 — 하드코딩 6과목만 그리던 탓에 그 밖의 코스·수강신청이 안 보이던 문제를 막는다. */
export const DEFAULT_SUBJECT_THEME: LectureSubjectTheme = {
  color: '#6b6b73',
  soft: '#eeedf0',
  band: 'linear-gradient(150deg,#efeef1,#e2e1e6)',
  grad: 'linear-gradient(150deg,#8a8a93,#6b6b73)',
  icon: 'ph-fill ph-graduation-cap',
};

/** 과목명 → 테마. 알려진 6과목이면 고유 테마, 그 외(‘일반’ 등)는 기본 테마로 폴백한다. */
export function subjectTheme(sub: string): LectureSubjectTheme {
  return LECTURE_SUBJECTS[sub] ?? DEFAULT_SUBJECT_THEME;
}

/** 초 → 화면 표시(29분 / 45초). 목차·플레이어 시간 표기에 공용. */
export function formatDurationLabel(sec: number): string {
  const s = Math.max(0, Math.round(sec || 0));
  if (s < 60) return `${s}초`;
  return `${Math.round(s / 60)}분`;
}

/** 초 → mm:ss (플레이어 현재 시각 표기) */
export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}
