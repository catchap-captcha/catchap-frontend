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
  // 접힌 페이지 — /contact 로 리다이렉트만 한다(북마크·이메일에 남은 링크 보호). 새 링크는 CONTACT 를 쓴다.
  SUPPORT: '/support',
  TERMS: '/terms',
  PRIVACY: '/privacy',

  // 인증 — handoff: CatChap 로그인(회원가입 포함), 비밀번호 재설정, 보안캡챠
  LOGIN: '/login',
  FIND_ID: '/find-id', // 아이디 찾기 — 가입 이메일 본인확인 후 로그인 아이디 안내
  PASSWORD_RESET: '/password-reset',
  CAPTCHA: '/captcha',
  INVITE: '/invite', // 교사 초대링크 (?token=) → 검증 후 프리필된 가입화면으로

  // 학생 — handoff: CatChap 학습 홈 외. 게임화 잔재(챕터/연습장/배지/프로필꾸미기/AI선생님)는
  // 제품 전환(2026-07-18)으로 제거 — 종전 경로는 git 이력 참고.
  STUDENT_HOME: '/student/home',
  STUDENT_GAME: '/student/game', // ?subject=&chapter=
  STUDENT_RESULT: '/student/result', // ?subject=
  STUDENT_DAILY_QUIZ: '/student/daily-quiz', // 은퇴(Q 통합 0719) — 문제은행으로 리다이렉트만 남음
  STUDENT_LECTURES: '/student/lectures', // ?subject= — 과목별 강의 카탈로그(개념 설명 톤). 홈 '전체 보기'로 진입
  STUDENT_MY_COURSES: '/student/my-courses', // 내 강의 — 수강 중/완료 + 진도율 + 계속 학습('내 학습' 그룹)
  STUDENT_INQUIRY: '/student/inquiry', // 학생 콘솔 문의하기 — 콘솔 안에서(공개 /contact 와 별개, 학생 유형)
  STUDENT_EXAMS: '/student/exams', // 수료시험 — 응시 가능한 코스 목록에서 응시(수료 현황=나의 기록 탭과 별개)
  STUDENT_CERTIFICATES: '/student/certificates', // 수료증 — 수료한 코스 목록 + 발급·다운로드('수료' 그룹)
  STUDENT_CHECKOUT: '/student/checkout', // ?course= — 코스 수강 결제(주문→승인→수강신청)
  // 결제 결과 착지 페이지 — 카카오페이 QR 승인/취소/실패 후 백엔드가 여기로 리다이렉트한다
  // (?orderId=). 백엔드 PAYMENT_{SUCCESS,FAIL,CANCEL}_URL 기본값과 경로가 같아야 한다.
  STUDENT_ORDERS: '/student/orders', // 결제 내역·환불 — 마이페이지 '계정·개인정보'에서 진입
  STUDENT_PAYMENT_SUCCESS: '/student/payment/success',
  STUDENT_PAYMENT_FAIL: '/student/payment/fail',
  STUDENT_PAYMENT_CANCEL: '/student/payment/cancel',
  STUDENT_LECTURE: '/student/lecture', // ?id= — 강의실(플레이어 + 시청 검증)
  STUDENT_COURSE_EXAM: '/student/course-exam', // ?course= — 코스 수료 시험(완전학습)
  STUDENT_ALL_LEARNING: '/student/all-learning',
  STUDENT_CONCEPTS: '/student/concepts', // ?tab=
  STUDENT_RECORDS: '/student/records',
  STUDENT_WRONG_NOTES: '/student/wrong-notes',
  STUDENT_RECOMMENDED: '/student/recommended',
  STUDENT_SEARCH: '/student/search',
  STUDENT_NOTIFICATIONS: '/student/notifications',
  STUDENT_SETTINGS: '/student/settings',
  STUDENT_MYPAGE: '/student/mypage', // 통합 마이페이지 — 프로필+학습요약+수강코스+계정
  STUDENT_PROFILE_EDIT: '/student/profile/edit', // 프로필(이름·나이) 수정

  // 학부모 콘솔 — 제품 전환(2026-07-18)으로 은퇴. 미성년 동의는 학생 가입 게이트가 담당.

  // 학교(교사/기관) 콘솔 — 제품 전환(2026-07-17)으로 전부 제거.
  // 기존 기관·교사 계정이 로그인하면 종료 안내(SCHOOL_SUNSET)로 보낸다.
  SCHOOL_SUNSET: '/school-sunset',

  // 운영자(ops)
  OPS_LOGIN: '/ops/login', // 숨겨진 운영자 전용 로그인 (공개 라우트, 링크 노출 안 함)
  OPS_DASHBOARD: '/ops/dashboard', // 운영 홈 — 운영자 로그인 착지(처리 대기·헬스·감사로그). 강사 홈(/ops/home)과 별개
  OPS_APPROVAL: '/ops/approvals',
  OPS_ORGS: '/ops/orgs',
  OPS_API_KEYS: '/ops/api-keys',
  OPS_INQUIRIES: '/ops/inquiries',
  OPS_BEHAVIOR: '/ops/behavior',
  OPS_BEHAVIOR_EXPORT: '/ops/behavior/export', // 외부 업체 제공용 익명 내보내기
  OPS_LOGS: '/ops/logs',
  OPS_OPERATORS: '/ops/operators', // 운영자 계정 관리
  OPS_MONITORING: '/ops/monitoring', // 서버 자원 모니터링 (CPU/메모리/디스크/GPU + LLM 사용량)
  OPS_AI_MODELS: '/ops/ai-models', // 모델 레지스트리 관리(기관 콘솔 노출 콘텐츠 — 실 LLM 호출과 무관)
  // LLM 설정 — 종전 '설정' 한 페이지에 뭉쳐 있던 것을 전용 메뉴 3개로 분리(찾기 쉽게).
  OPS_LLM_MODELS: '/ops/llm/models', // 실 호출 모델(생성/검증 슬롯) 선택·자동 스왑·사용량
  OPS_LLM_KEYS: '/ops/llm/keys', // API 키(Anthropic·OpenAI) 관리
  OPS_LLM_PROMPTS: '/ops/llm/prompts', // 생성·검증 프롬프트(규칙) 편집
  OPS_SETTINGS: '/ops/settings', // (레거시) → OPS_LLM_KEYS로 리다이렉트(북마크 보호)
  OPS_INSTRUCTOR_HOME: '/ops/home', // 강사 홈 대시보드 (검수 대기·학생 참여·약한 문항) — 강사 착지
  OPS_INQUIRY: '/ops/inquiry', // 강사·운영자 콘솔 문의하기 — 공개 /contact 와 유형이 다르다
  OPS_INSTRUCTOR_PROFILE: '/ops/profile', // 강사 프로필 — 상단바 아바타 클릭 시 착지(비밀번호 변경은 이 안의 액션)
  OPS_LECTURES: '/ops/lectures', // 강의 관리 (영상 업로드·확인 문항·자료실) — 운영자·강사 공용
  OPS_QUESTION_METRICS: '/ops/question-metrics', // 문항 지표 (문제은행 노출수·정답률 — 문제은행 2단계)
  OPS_INSTRUCTORS: '/ops/instructors', // 강사 계정 관리 (운영자 초대 발급)
  // 리뉴얼 상단바(2026-07-24) 신규 콘솔 화면
  OPS_SYSTEM_STATUS: '/ops/system-status', // 시스템 상태 — 구성요소 헬스체크(운영, 상단바 '시스템')
  OPS_COURSES: '/ops/courses', // 코스 관리 — 강의 묶음(코스) 빌더(강사, '강의 관리'에서 진입)
  OPS_QUESTION_REVIEW: '/ops/question-review', // 문항 검수 — 생성 문항 승인/반려 QC(강사, 문항 지표와 별개)
  OPS_LEARNING_ANALYTICS: '/ops/learning-analytics', // 학습 분석 — 주간 시청 완주·참여(강사)
  OPS_ACCOUNT_UNLOCK: '/ops/account-unlock', // 로그인 잠금 해제·학생 임시 비밀번호 (캡차를 풀 수 없는 사용자의 최후 수단)

  // 학생 코드 활성화 가입 (공개) — 학교 발급 코드 흐름 종료 안내만 남음
  ACTIVATE: '/activate',
} as const;

/** handoff 파일명 → route (링크 변환용 레퍼런스) */
export const HANDOFF_ROUTE_MAP: Record<string, string> = {
  'CatChap 메인.dc.html': PATHS.HOME,
  'CatChap 문의하기.dc.html': PATHS.CONTACT,
  // 고객지원 페이지는 접었다(0730) — 문의하기로 합쳐졌고 /support 는 리다이렉트만 남았다.
  'CatChap 고객지원.dc.html': PATHS.CONTACT,
  'CatChap 이용약관.dc.html': PATHS.TERMS,
  'CatChap 개인정보처리방침.dc.html': PATHS.PRIVACY,
  'CatChap 로그인.dc.html': PATHS.LOGIN,
  'CatChap 비밀번호 재설정.dc.html': PATHS.PASSWORD_RESET,
  'CatChap 보안캡챠.dc.html': PATHS.CAPTCHA,
  'CatChap 학습 홈.dc.html': PATHS.STUDENT_HOME,
  'CatChap 게임화면.dc.html': PATHS.STUDENT_GAME,
  'CatChap 학습결과.dc.html': PATHS.STUDENT_RESULT,
  'CatChap 오늘의퀴즈.dc.html': PATHS.STUDENT_ALL_LEARNING, // 퀴즈 은퇴 → 문제은행(오늘의 Q)
  'CatChap 전체학습.dc.html': PATHS.STUDENT_ALL_LEARNING,
  'CatChap 개념설명.dc.html': PATHS.STUDENT_ALL_LEARNING, // 개념 설명 은퇴(성인화) → 문제은행
  'CatChap 나의기록.dc.html': PATHS.STUDENT_RECORDS,
  'CatChap 오답노트.dc.html': PATHS.STUDENT_WRONG_NOTES,
  'CatChap 취약문제추천.dc.html': PATHS.STUDENT_ALL_LEARNING, // 추천 은퇴(성인화) → 문제은행
  'CatChap 검색.dc.html': PATHS.STUDENT_SEARCH,
  'CatChap 알림.dc.html': PATHS.STUDENT_NOTIFICATIONS,
  'CatChap 설정.dc.html': PATHS.STUDENT_SETTINGS,
  // 깨진 링크(파일 없음) → 게임화면으로 통일
  'CatChap 한글낱말.dc.html': `${PATHS.STUDENT_GAME}?subject=국어&bank=1`,
  'CatChap 그림찾기.dc.html': `${PATHS.STUDENT_GAME}?subject=과학&bank=1`,
  // (학교 콘솔 handoff 매핑은 제품 전환으로 제거 — 남은 링크는 종료 안내로 수렴)
};
