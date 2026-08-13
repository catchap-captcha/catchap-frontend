/**
 * 관심사 온보딩 택소노미 — 신규 학생 팝업에 보여줄 "데모 분야"들.
 *
 * 의도(사용자 요청): 팝업엔 분야를 잘게 나눈 데모를 아주 많이 넣되, 홈의 '관심사 추천'에는
 * 진짜 생성된 코스만 뜬다. 그래서 각 그룹은 실제 코스 과목(subject)에 앵커된다 — 그 그룹의
 * 태그를 고르면 해당 subject의 실제 코스가 추천되고, 없으면 데모만(분야별 '비슷한 추천').
 *
 * 코스 과목 어휘는 강사 콘솔 드롭다운(OpsCourses COURSE_SUBJECTS)·백엔드 검증
 * (COURSE_SUBJECT_VOCAB)과 1:1로 맞춘다: 수학·어학·안전·IT·디자인·비즈니스·자격증·취미·일반.
 * 강사가 코스 과목을 그 어휘로 분류하면 이 추천이 그대로 따라간다. 세 곳을 함께 바꿔야 한다.
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
  // ── 아래 분야도 과목에 앵커됨 — 강사가 코스를 그 과목으로 분류하면 실제 코스가 추천에 뜬다 ──
  {
    key: 'it',
    label: 'IT·프로그래밍',
    icon: 'ph-fill ph-code',
    subject: 'IT',
    tags: ['파이썬', '자바', '웹 개발', '앱 개발', '데이터 분석', 'AI·머신러닝', '클라우드', '정보처리기사', '데이터베이스', '정보보안'],
  },
  {
    key: 'design',
    label: '디자인·크리에이티브',
    icon: 'ph-fill ph-palette',
    subject: '디자인',
    tags: ['포토샵', '일러스트', 'UX·UI', '영상 편집', '3D·모델링', '브랜딩', '모션그래픽', '제품 디자인'],
  },
  {
    key: 'biz',
    label: '비즈니스·직무',
    icon: 'ph-fill ph-briefcase',
    subject: '비즈니스',
    tags: ['마케팅', '회계·세무', '기획·전략', 'PM·프로덕트', '세일즈', '노션·협업툴', '창업', '인사·HR'],
  },
  {
    key: 'cert',
    label: '자격증·시험',
    icon: 'ph-fill ph-certificate',
    subject: '자격증',
    tags: ['공무원', '한국사능력검정', '컴활 1급', '전산회계', '사회복지사', '한식조리기능사', '바리스타', '드론 자격'],
  },
  {
    key: 'life',
    label: '취미·라이프',
    icon: 'ph-fill ph-heart',
    subject: '취미',
    tags: ['드로잉', '사진', '요리·베이킹', '악기·음악', '홈트·운동', '캘리그라피', '가드닝', '반려동물'],
  },
];

/** 연령대 옵션(단일 선택). 추천 매칭엔 쓰지 않고(실제 코스에 연령 타깃 없음) 저장만 한다. */
export const AGE_BANDS = ['10대', '20대', '30대', '40대', '50대 이상'];

/** 연령대는 interests 배열에 이 접두사로 1칸 저장한다 — 추천 매칭에서 걸러진다. */
export const AGE_PREFIX = '연령대:';

/** 관심사에서 한 번에 고를 수 있는 태그 최대 개수. 너무 많이 고르면 홈 '관심사 추천'이
 *  복잡하게 쏟아져서 4개로 제한한다(연령대는 별도 1칸이라 이 상한에 포함되지 않는다). */
export const MAX_INTEREST_FIELDS = 4;

// 데모 태그 → 실제 코스 분류(subject). anchored 그룹만 매핑에 넣는다.
const TAG_SUBJECT: Record<string, string> = {};
for (const g of INTEREST_GROUPS) {
  if (g.subject) for (const t of g.tags) TAG_SUBJECT[t] = g.subject;
}

// 데모 태그 → 그룹 key(field). 관심사 추천에서 그 분야의 데모 코스를 고를 때 쓴다.
const TAG_FIELD: Record<string, string> = {};
for (const g of INTEREST_GROUPS) {
  for (const t of g.tags) TAG_FIELD[t] = g.key;
}

/** 저장된 관심사(태그) → 매칭할 데모 코스의 field(그룹 key) 집합. 관심사 추천에서 고른 분야의
 *  데모 코스를 뽑을 때 쓴다(연령대 접두사는 무시). */
export function interestsToFieldKeys(interests: string[] | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const raw of interests ?? []) {
    if (!raw || raw.startsWith(AGE_PREFIX)) continue;
    const f = TAG_FIELD[raw];
    if (f) out.add(f);
  }
  return out;
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
