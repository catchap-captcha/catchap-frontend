/**
 * 화면 route 정의 + handoff 원본 파일 매핑.
 * handoff의 `*.dc.html` 링크는 반드시 아래 매핑대로 변환한다.
 * (오늘의퀴즈/오답노트/검색의 깨진 링크 — 한글낱말/그림찾기/숫자놀이터 등 개별 게임 파일 —
 *  은 전부 STUDENT_GAME(`?subject=`)으로 통일한다.)
 */
export const PATHS = {
  // 공개 — handoff: CatChap 메인/문의하기/고객지원/이용약관/개인정보처리방침
  HOME: '/',
  CONTACT: '/contact',
  SUPPORT: '/support',
  TERMS: '/terms',
  PRIVACY: '/privacy',

  // 인증 — handoff: CatChap 로그인(회원가입 포함), 비밀번호 재설정, 보안캡챠
  LOGIN: '/login',
  PASSWORD_RESET: '/password-reset',
  CAPTCHA: '/captcha',
  INVITE: '/invite', // 교사 초대링크 (?token=) → 검증 후 프리필된 가입화면으로

  // 학생 — handoff: CatChap 학습 홈 외
  STUDENT_HOME: '/student/home',
  STUDENT_CHAPTERS: '/student/chapters', // ?subject=
  STUDENT_GAME: '/student/game', // ?subject=&chapter=
  STUDENT_CHAPTER_PLAY: '/student/chapter-play', // ?subject=&chapter= — 주간 챕터 한 단계(2문항) 플레이
  STUDENT_RESULT: '/student/result', // ?subject=
  STUDENT_DAILY_QUIZ: '/student/daily-quiz',
  STUDENT_ALL_LEARNING: '/student/all-learning',
  STUDENT_CONCEPTS: '/student/concepts', // ?tab=
  STUDENT_RECORDS: '/student/records',
  STUDENT_WRONG_NOTES: '/student/wrong-notes',
  STUDENT_BADGES: '/student/badges',
  STUDENT_PROFILE: '/student/profile',
  STUDENT_RECOMMENDED: '/student/recommended',
  STUDENT_AI_TEACHER: '/student/ai-teacher',
  STUDENT_SEARCH: '/student/search',
  STUDENT_NOTIFICATIONS: '/student/notifications',
  STUDENT_SETTINGS: '/student/settings',

  // 학부모 — handoff: CatChap 학부모 외
  PARENT_HOME: '/parent/home', // ?child=
  PARENT_REPORTS: '/parent/reports',
  PARENT_COUNSEL_AI: '/parent/counsel-ai',
  PARENT_NOTIFICATIONS: '/parent/notifications',
  PARENT_MYPAGE: '/parent/mypage',

  // 교사 — handoff: CatChap 선생님 외
  TEACHER_HOME: '/teacher/home',
  TEACHER_CLASS: '/teacher/class',
  TEACHER_STUDENTS: '/teacher/students',
  TEACHER_ANALYTICS: '/teacher/analytics',
  TEACHER_FAMILY_NOTICE: '/teacher/family-notice',
  TEACHER_MYPAGE: '/teacher/mypage',

  // 기관 관리자 — handoff: CatChap 기관 외
  ORG_HOME: '/org/home',
  ORG_CLASSES: '/org/classes',
  ORG_TEACHERS: '/org/teachers',
  ORG_ANALYTICS: '/org/analytics',
  ORG_CAPTCHA_SETTINGS: '/org/captcha-settings',
  ORG_API_KEYS: '/org/api-keys',
  ORG_AI_MODELS: '/org/ai-models',
  ORG_SECURITY_POLICY: '/org/security-policy',
  ORG_AUDIT: '/org/audit', // 기관 활동 기록 (자기 기관 감사로그)
  ORG_MYPAGE: '/org/mypage',
  ORG_CONTACT: '/org/contact', // 관리자 문의 폼 (사이드바 '문의하기' 버튼)

  // 운영자(ops)
  OPS_LOGIN: '/ops/login', // 숨겨진 운영자 전용 로그인 (공개 라우트, 링크 노출 안 함)
  OPS_APPROVAL: '/ops/approvals',
  OPS_ORGS: '/ops/orgs',
  OPS_API_KEYS: '/ops/api-keys',
  OPS_INQUIRIES: '/ops/inquiries',
  OPS_BEHAVIOR: '/ops/behavior',
  OPS_BEHAVIOR_EXPORT: '/ops/behavior/export', // 외부 업체 제공용 익명 내보내기
  OPS_LOGS: '/ops/logs',
  OPS_OPERATORS: '/ops/operators', // 운영자 계정 관리
  OPS_SYSTEM: '/ops/system', // 시스템 상태 (실측 헬스체크)
  OPS_AI_MODELS: '/ops/ai-models', // 모델 레지스트리 관리(기관 콘솔 노출 콘텐츠)

  // 기관 학생 관리 (학생 생성 + 가입코드 배부)
  ORG_STUDENTS: '/org/students',

  // 학생 코드 활성화 가입 (공개)
  ACTIVATE: '/activate',
} as const;

/** handoff 파일명 → route (링크 변환용 레퍼런스) */
export const HANDOFF_ROUTE_MAP: Record<string, string> = {
  'CatChap 메인.dc.html': PATHS.HOME,
  'CatChap 문의하기.dc.html': PATHS.CONTACT,
  'CatChap 고객지원.dc.html': PATHS.SUPPORT,
  'CatChap 이용약관.dc.html': PATHS.TERMS,
  'CatChap 개인정보처리방침.dc.html': PATHS.PRIVACY,
  'CatChap 로그인.dc.html': PATHS.LOGIN,
  'CatChap 비밀번호 재설정.dc.html': PATHS.PASSWORD_RESET,
  'CatChap 보안캡챠.dc.html': PATHS.CAPTCHA,
  'CatChap 학습 홈.dc.html': PATHS.STUDENT_HOME,
  'CatChap 챕터지도.dc.html': PATHS.STUDENT_CHAPTERS,
  'CatChap 게임화면.dc.html': PATHS.STUDENT_GAME,
  'CatChap 학습결과.dc.html': PATHS.STUDENT_RESULT,
  'CatChap 오늘의퀴즈.dc.html': PATHS.STUDENT_DAILY_QUIZ,
  'CatChap 전체학습.dc.html': PATHS.STUDENT_ALL_LEARNING,
  'CatChap 개념설명.dc.html': PATHS.STUDENT_CONCEPTS,
  'CatChap 나의기록.dc.html': PATHS.STUDENT_RECORDS,
  'CatChap 오답노트.dc.html': PATHS.STUDENT_WRONG_NOTES,
  'CatChap 배지.dc.html': PATHS.STUDENT_BADGES,
  'CatChap 프로필 꾸미기.dc.html': PATHS.STUDENT_PROFILE,
  'CatChap 취약문제추천.dc.html': PATHS.STUDENT_RECOMMENDED,
  'CatChap AI선생님.dc.html': PATHS.STUDENT_AI_TEACHER,
  'CatChap 검색.dc.html': PATHS.STUDENT_SEARCH,
  'CatChap 알림.dc.html': PATHS.STUDENT_NOTIFICATIONS,
  'CatChap 설정.dc.html': PATHS.STUDENT_SETTINGS,
  // 깨진 링크(파일 없음) → 게임화면으로 통일
  'CatChap 한글낱말.dc.html': `${PATHS.STUDENT_GAME}?subject=국어`,
  'CatChap 그림찾기.dc.html': `${PATHS.STUDENT_GAME}?subject=과학`,
  'CatChap 학부모.dc.html': PATHS.PARENT_HOME,
  'CatChap 학부모 도윤.dc.html': `${PATHS.PARENT_HOME}?child=doyun`,
  'CatChap 학부모리포트.dc.html': PATHS.PARENT_REPORTS,
  'CatChap 학부모 상담 AI.dc.html': PATHS.PARENT_COUNSEL_AI,
  'CatChap 학부모알림.dc.html': PATHS.PARENT_NOTIFICATIONS,
  'CatChap 학부모 마이페이지.dc.html': PATHS.PARENT_MYPAGE,
  'CatChap 선생님.dc.html': PATHS.TEACHER_HOME,
  'CatChap 우리반.dc.html': PATHS.TEACHER_CLASS,
  'CatChap 전체학생조회.dc.html': PATHS.TEACHER_STUDENTS,
  'CatChap 선생님 학습분석.dc.html': PATHS.TEACHER_ANALYTICS,
  'CatChap 가정안내.dc.html': PATHS.TEACHER_FAMILY_NOTICE,
  'CatChap 선생님 마이페이지.dc.html': PATHS.TEACHER_MYPAGE,
  'CatChap 기관.dc.html': PATHS.ORG_HOME,
  'CatChap 학급학생관리.dc.html': PATHS.ORG_CLASSES,
  'CatChap 선생님관리.dc.html': PATHS.ORG_TEACHERS,
  'CatChap 학습분석.dc.html': PATHS.ORG_ANALYTICS,
  'CatChap 캡차설정.dc.html': PATHS.ORG_CAPTCHA_SETTINGS,
  'CatChap AI모델.dc.html': PATHS.ORG_AI_MODELS,
  'CatChap 보안정책.dc.html': PATHS.ORG_SECURITY_POLICY,
  'CatChap 기관 마이페이지.dc.html': PATHS.ORG_MYPAGE,
};
