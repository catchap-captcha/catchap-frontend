/**
 * 관심사 온보딩 택소노미 — 신규 학생 팝업에 보여줄 "데모 분야"들.
 *
 * 의도(사용자 요청): 팝업엔 분야를 잘게 나눈 데모를 아주 많이 넣되, 홈의 '관심사 추천'에는
 * 진짜 생성된 코스만 뜬다. 그래서 각 그룹은 실제 코스 분류(category)로 매핑되는 subject를
 * 가진다 — subject가 있으면(anchored) 그 그룹의 태그를 고르면 해당 실제 코스가 추천되고,
 * subject가 null인 그룹(IT·디자인 등 아직 코스 없음)은 데모로만 보이고 추천엔 안 뜬다.
 *
 * 실제 코스 분류는 데이터 기반(현재 수학/안전/어학/일반)이라, anchored subject는 그 값과
 * 정확히 일치시킨다. 새 분류가 생기면 여기 subject만 맞춰주면 된다.
 */
export interface InterestGroup {
  key: string;
  label: string;
  /** Phosphor 아이콘 클래스(그룹 헤더 장식). */
  icon: string;
  /** 매핑되는 실제 코스 분류(category). null이면 아직 실제 코스가 없는 데모 분야(추천엔 안 뜸). */
  subject: string | null;
  tags: string[];
}

export const INTEREST_GROUPS: InterestGroup[] = [
  {
    key: 'math',
    label: '수학·수리',
    icon: 'ph-fill ph-plus-minus',
    subject: '수학',
    tags: ['초등 수해력', '중등 수학', '고등 수학', '미적분', '확률과 통계', '기하·도형', '수리 논술', '공학 수학', '금융·경제 수학', '데이터 수리'],
  },
  {
    key: 'safety',
    label: '안전·자격',
    icon: 'ph-fill ph-shield-check',
    subject: '안전',
    tags: ['산업안전', '건설안전', '소방·방재', '생활안전', '교통안전', '전기안전', '화학물질 안전', '응급처치·CPR', '재난 대응', '식품위생'],
  },
  {
    key: 'lang',
    label: '어학·외국어',
    icon: 'ph-fill ph-translate',
    subject: '어학',
    tags: ['영어 회화', 'TOEIC', 'TOEFL', 'OPIc', '비즈니스 영어', '일본어', 'JLPT', '중국어', 'HSK', '기초 스페인어'],
  },
  {
    key: 'general',
    label: '교양·자기계발',
    icon: 'ph-fill ph-book-open',
    subject: '일반',
    tags: ['컴퓨터 활용', '엑셀·오피스', '경제·재테크', '시사·상식', '인문·글쓰기', '심리·마음챙김', '시간관리', '커뮤니케이션', '리더십', '회의·발표'],
  },
  // ── 아래는 아직 실제 코스가 없는 데모 분야(팝업에만 노출, 추천엔 안 뜸) ─────────────
  {
    key: 'it',
    label: 'IT·프로그래밍',
    icon: 'ph-fill ph-code',
    subject: null,
    tags: ['파이썬', '자바', '웹 개발', '앱 개발', '데이터 분석', 'AI·머신러닝', '클라우드', '정보처리기사', '데이터베이스', '정보보안'],
  },
  {
    key: 'design',
    label: '디자인·크리에이티브',
    icon: 'ph-fill ph-palette',
    subject: null,
    tags: ['포토샵', '일러스트', 'UX·UI', '영상 편집', '3D·모델링', '브랜딩', '모션그래픽', '제품 디자인'],
  },
  {
    key: 'biz',
    label: '비즈니스·직무',
    icon: 'ph-fill ph-briefcase',
    subject: null,
    tags: ['마케팅', '회계·세무', '기획·전략', 'PM·프로덕트', '세일즈', '노션·협업툴', '창업', '인사·HR'],
  },
  {
    key: 'cert',
    label: '자격증·시험',
    icon: 'ph-fill ph-certificate',
    subject: null,
    tags: ['공무원', '한국사능력검정', '컴활 1급', '전산회계', '사회복지사', '한식조리기능사', '바리스타', '드론 자격'],
  },
  {
    key: 'life',
    label: '취미·라이프',
    icon: 'ph-fill ph-heart',
    subject: null,
    tags: ['드로잉', '사진', '요리·베이킹', '악기·음악', '홈트·운동', '캘리그라피', '가드닝', '반려동물'],
  },
];

/** 연령대 옵션(단일 선택). 추천 매칭엔 쓰지 않고(실제 코스에 연령 타깃 없음) 저장만 한다. */
export const AGE_BANDS = ['10대', '20대', '30대', '40대', '50대 이상'];

/** 연령대는 interests 배열에 이 접두사로 1칸 저장한다 — 추천 매칭에서 걸러진다. */
export const AGE_PREFIX = '연령대:';

/** 관심사에서 한 번에 고를 수 있는 분야 최대 개수(백엔드 20개 한도 + 연령대 1칸 여유). */
export const MAX_INTEREST_FIELDS = 15;

// 데모 태그 → 실제 코스 분류(subject). anchored 그룹만 매핑에 넣는다.
const TAG_SUBJECT: Record<string, string> = {};
for (const g of INTEREST_GROUPS) {
  if (g.subject) for (const t of g.tags) TAG_SUBJECT[t] = g.subject;
}

/**
 * 저장된 관심사(태그 배열) → 추천에서 매칭할 실제 코스 분류(subject) 집합.
 * 데모 태그는 매핑된 subject로 치환하고, 그 밖의 문자열(직접 분류명 등 하위호환)은 그대로 포함한다.
 * 연령대 접두사 항목은 무시한다.
 */
export function interestsToSubjects(interests: string[] | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const raw of interests ?? []) {
    if (!raw || raw.startsWith(AGE_PREFIX)) continue;
    const mapped = TAG_SUBJECT[raw];
    if (mapped) out.add(mapped);
    else out.add(raw); // 태그가 실제 분류명과 같으면 그대로 매칭(구 버전 저장값 호환)
  }
  return out;
}

/** 저장된 관심사에서 연령대만 추출(없으면 null). */
export function parseAgeBand(interests: string[] | null | undefined): string | null {
  for (const raw of interests ?? []) {
    if (raw?.startsWith(AGE_PREFIX)) return raw.slice(AGE_PREFIX.length);
  }
  return null;
}
