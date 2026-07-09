/**
 * 과목 공통 메타 — 단일 소스(single source of truth).
 *
 * 6과목의 순서·이름·시그니처 색·아이콘은 전 화면에서 동일하다(핸드오프 기준).
 * 페이지별로 gradient 등 추가 필드가 필요한 경우, 이 기본값을 spread 해서 확장한다.
 *   예) const theme = { ...SUBJECT_META.국어, progGrad: '...' }
 *
 * 주의: 값은 원본 handoff와 100% 동일해야 한다. 색을 바꾸면 디자인이 바뀐다.
 */
export type SubjectKey = '국어' | '영어' | '수학' | '과학' | '사회' | '생활';

export interface SubjectMeta {
  key: SubjectKey;
  /** 시그니처 진한 색 (버튼·활성 등) */
  solid: string;
  /** 연한 배경색 (칩·소프트 배경) */
  soft: string;
  /** Phosphor 아이콘 클래스 */
  icon: string;
}

export const SUBJECT_ORDER: SubjectKey[] = ['국어', '영어', '수학', '과학', '사회', '생활'];

export const SUBJECT_META: Record<SubjectKey, SubjectMeta> = {
  국어: { key: '국어', solid: '#FF5A4D', soft: '#FFE0DB', icon: 'ph-fill ph-book-open' },
  영어: { key: '영어', solid: '#FF922E', soft: '#FFEDD6', icon: 'ph-fill ph-translate' },
  수학: { key: '수학', solid: '#17B08C', soft: '#DFF6EE', icon: 'ph-fill ph-plus-minus' },
  과학: { key: '과학', solid: '#2E7BFF', soft: '#E1EDFF', icon: 'ph-fill ph-flask' },
  사회: { key: '사회', solid: '#8B6BFF', soft: '#EAE2FF', icon: 'ph-fill ph-scroll' },
  생활: { key: '생활', solid: '#FF6DA6', soft: '#FFE3EF', icon: 'ph-fill ph-house-line' },
};

export const SUBJECT_LIST: SubjectMeta[] = SUBJECT_ORDER.map((k) => SUBJECT_META[k]);
