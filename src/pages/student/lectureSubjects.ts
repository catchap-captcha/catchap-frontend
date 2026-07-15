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
  '국어': { color: '#FF5A4D', soft: '#FFE0DB', band: 'linear-gradient(150deg,#FFE6E0,#FFD3CB)', grad: 'linear-gradient(150deg,#FF7A7A,#FF5A6E)', icon: 'ph-fill ph-book-open' },
  '영어': { color: '#FF922E', soft: '#FFEDD6', band: 'linear-gradient(150deg,#FFEFD9,#FFE0BE)', grad: 'linear-gradient(150deg,#FFB43C,#FF922E)', icon: 'ph-fill ph-translate' },
  '수학': { color: '#17B08C', soft: '#DFF6EE', band: 'linear-gradient(150deg,#E4F7F0,#CDEEE1)', grad: 'linear-gradient(150deg,#33C892,#17B0A0)', icon: 'ph-fill ph-plus-minus' },
  '과학': { color: '#2E7BFF', soft: '#E1EDFF', band: 'linear-gradient(150deg,#E9F1FF,#D3E3FF)', grad: 'linear-gradient(150deg,#4AA6FF,#2E7BFF)', icon: 'ph-fill ph-flask' },
  '사회': { color: '#8B6BFF', soft: '#EAE2FF', band: 'linear-gradient(150deg,#EFE9FF,#DED2FF)', grad: 'linear-gradient(150deg,#A98CFF,#8B6BFF)', icon: 'ph-fill ph-scroll' },
  '생활': { color: '#FF6DA6', soft: '#FFE3EF', band: 'linear-gradient(150deg,#FFE8F1,#FFD3E3)', grad: 'linear-gradient(150deg,#FF93BE,#FF6DA6)', icon: 'ph-fill ph-house-line' },
};

export const LECTURE_SUBJECT_ORDER = ['국어', '영어', '수학', '과학', '사회', '생활'];

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
