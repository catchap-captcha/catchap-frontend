/** 감사 action 코드 → 사람이 읽는 라벨/아이콘 — 운영·기관 감사 화면 공용.
 * 백엔드가 실제로 기록하는 코드 전부를 매핑한다 (grep 'action="' 기준).
 * 매핑에 없는 코드는 화면 fallback으로 원문(영문)이 노출되므로 누락 없이 유지할 것. */
export const AUDIT_ACTION_META: Record<string, { label: string; icon: string; cls: string }> = {
  // 운영자 — 기관 가입 승인 콘솔
  org_registration_approved: { label: '기관 가입 승인', icon: 'ph-check-circle', cls: 'ok' },
  org_registration_rejected: { label: '기관 가입 거절', icon: 'ph-x-circle', cls: 'no' },
  // 기관 관리자
  'org.update': { label: '기관 정보 수정', icon: 'ph-pencil-simple', cls: 'neutral' },
  'org.teacher_add': { label: '선생님 추가', icon: 'ph-user-plus', cls: 'ok' },
  'org.teacher_update': { label: '선생님 정보 수정', icon: 'ph-pencil-simple', cls: 'neutral' },
  'org.teacher_delete': { label: '선생님 삭제', icon: 'ph-user-minus', cls: 'no' },
  'org.teacher_invite': { label: '선생님 초대', icon: 'ph-envelope-simple', cls: 'ok' },
  'org.captcha_settings_update': { label: '캡차 설정 변경', icon: 'ph-shield-check', cls: 'neutral' },
  'org.student_code_reissue': { label: '학생 가입코드 재발급', icon: 'ph-arrows-clockwise', cls: 'neutral' },
  'student.password_reset': { label: '학생 비밀번호 초기화', icon: 'ph-key', cls: 'warn' },
  'student.parent_invite': { label: '학부모 초대코드 발급', icon: 'ph-user-circle-plus', cls: 'ok' },
  'parent_link.revoke': { label: '학부모 연결 해제(기관)', icon: 'ph-link-break', cls: 'warn' },
  'student.assign_class': { label: '학생 학급 배정', icon: 'ph-users-three', cls: 'neutral' },
  // 학부모
  'parent.profile_update': { label: '학부모 프로필 수정', icon: 'ph-pencil-simple', cls: 'neutral' },
  'parent.child_link': { label: '자녀 연결', icon: 'ph-link', cls: 'ok' },
  'parent.child_unlink': { label: '자녀 연결 해제', icon: 'ph-link-break', cls: 'warn' },
  'parent.child_settings_update': { label: '자녀 설정 변경', icon: 'ph-sliders-horizontal', cls: 'neutral' },
  // 선생님
  'teacher.profile_update': { label: '선생님 프로필 수정', icon: 'ph-pencil-simple', cls: 'neutral' },
  'teacher.class_student_add': { label: '학급 학생 추가', icon: 'ph-user-plus', cls: 'ok' },
  'teacher.class_student_update': { label: '학급 학생 수정', icon: 'ph-pencil-simple', cls: 'neutral' },
  'teacher.class_student_remove': { label: '학급 학생 제외', icon: 'ph-user-minus', cls: 'no' },
  // 공용 설정/계정
  'settings.update': { label: '설정 변경', icon: 'ph-gear', cls: 'neutral' },
  'settings.change_password': { label: '비밀번호 변경', icon: 'ph-key', cls: 'warn' },
  'settings.account_delete': { label: '계정 삭제(탈퇴)', icon: 'ph-user-minus', cls: 'no' },
  // 운영자 — 문의 처리
  'inquiry.answer': { label: '문의 답변 발송', icon: 'ph-paper-plane-tilt', cls: 'ok' },
  'inquiry.resolve': { label: '문의 처리 완료', icon: 'ph-check-circle', cls: 'ok' },
  // 운영자 — 행동 데이터 학습셋 관리
  'behavior.dataset_mark': { label: '행동 데이터 학습셋 상태 변경', icon: 'ph-fingerprint', cls: 'neutral' },
  'behavior.export': { label: '행동 데이터 내보내기', icon: 'ph-download-simple', cls: 'neutral' },
  // 운영자 — 기관 관리
  'org.create': { label: '기관 추가', icon: 'ph-buildings', cls: 'ok' },
  'org.delete': { label: '기관 삭제', icon: 'ph-trash', cls: 'no' },
  'org.code_rotate': { label: '기관 코드 재발급', icon: 'ph-arrows-clockwise', cls: 'warn' },
  'org.admin_credentials_sent': { label: '기관 관리자 임시비번 발송', icon: 'ph-envelope-simple', cls: 'warn' },
  'org.entitlements_set': { label: '기관 요금제/권한 변경', icon: 'ph-credit-card', cls: 'neutral' },
  // 운영자 — API 키
  'captcha.api_key_issue': { label: 'API 키 발급', icon: 'ph-key', cls: 'ok' },
  'captcha.api_key_revoke': { label: 'API 키 폐기', icon: 'ph-key', cls: 'no' },
  'captcha.api_key_rotate': { label: 'API 키 시크릿 재발급', icon: 'ph-arrows-clockwise', cls: 'warn' },
  // 운영자 — 운영자 계정 관리 (최고 민감)
  'ops.operator_create': { label: '운영자 계정 생성', icon: 'ph-user-circle-plus', cls: 'warn' },
  'ops.operator_update': { label: '운영자 권한 변경', icon: 'ph-user-circle-gear', cls: 'warn' },
  'ops.operator_password_reset': { label: '운영자 비밀번호 재설정', icon: 'ph-key', cls: 'warn' },
  'ops.operator_delete': { label: '운영자 계정 삭제', icon: 'ph-user-minus', cls: 'no' },
  'ops.ai_model_create': { label: 'AI 모델 등록', icon: 'ph-cpu', cls: 'ok' },
  'ops.ai_model_update': { label: 'AI 모델 수정', icon: 'ph-cpu', cls: 'neutral' },
  // 과목별로 다른 AI 문항 생성 규칙(프롬프트). 전역 설정과 구분해서 '과목별'을 밝힌다.
  'system.settings.ai_prompt_scoped': { label: 'AI 생성 규칙 변경(과목별)', icon: 'ph-sparkle', cls: 'warn' },
  // 기관 관리자 — 학년부장/학급
  'org.grade_head_appoint': { label: '학년부장 임명', icon: 'ph-user-circle-gear', cls: 'ok' },
  'org.grade_head_dismiss': { label: '학년부장 해임', icon: 'ph-user-circle-minus', cls: 'warn' },
  'org.class_create': { label: '학급 생성', icon: 'ph-plus-circle', cls: 'ok' },
  'org.class_dissolve': { label: '학급 해산', icon: 'ph-minus-circle', cls: 'no' },
  // 강사·운영자 — 코스
  'course.create': { label: '코스 생성', icon: 'ph-plus-circle', cls: 'ok' },
  'course.update': { label: '코스 수정', icon: 'ph-pencil-simple', cls: 'neutral' },
  'course.delete': { label: '코스 삭제', icon: 'ph-trash', cls: 'no' },
  'course.pricing.update': { label: '코스 수강료 설정', icon: 'ph-tag', cls: 'neutral' },
  'course.thumbnail': { label: '코스 커버 등록', icon: 'ph-image', cls: 'neutral' },
  'course.thumbnail_delete': { label: '코스 커버 삭제', icon: 'ph-image', cls: 'warn' },
  // 강사 — 강의
  'lecture.create': { label: '강의 업로드', icon: 'ph-upload-simple', cls: 'ok' },
  'lecture.update': { label: '강의 수정', icon: 'ph-pencil-simple', cls: 'neutral' },
  'lecture.reorder': { label: '강의 순서 변경', icon: 'ph-arrows-down-up', cls: 'neutral' },
  'lecture.trash': { label: '강의 삭제(휴지통)', icon: 'ph-trash', cls: 'no' },
  'lecture.restore': { label: '강의 복구', icon: 'ph-arrow-counter-clockwise', cls: 'ok' },
  'lecture.purge': { label: '강의 완전 삭제', icon: 'ph-trash', cls: 'no' },
  'lecture.thumbnail': { label: '강의 썸네일 등록', icon: 'ph-image', cls: 'neutral' },
  'lecture.thumbnail_delete': { label: '강의 썸네일 삭제', icon: 'ph-image', cls: 'warn' },
  'lecture.bot_check.passed': { label: '시청 봇 검증 통과', icon: 'ph-shield-check', cls: 'neutral' },
  'lecture.review.upsert': { label: '수강 후기 작성', icon: 'ph-star', cls: 'neutral' },
  // 강사 — 확인문항
  'lecture.question.create': { label: '확인문항 추가', icon: 'ph-plus-circle', cls: 'ok' },
  'lecture.question.bulk_publish': { label: '확인문항 일괄 공개', icon: 'ph-eye', cls: 'ok' },
  // ★아래 둘은 ★코드에는 없고 DB 에만 남은 옛 기록이다.
  //   그래서 "백엔드 코드의 audit() 호출"과 대조하는 방법으로는 ★찾을 수 없었다.
  //   0815 에 감사 로그 화면의 ★필터 목록(=DB 의 distinct action)을 보고 찾았다.
  //   이름을 안 붙이면 운영자 화면에 "lecture.delete" 가 그대로 뜬다.
  'lecture.delete': { label: '강의 삭제(옛 기록)', icon: 'ph-trash', cls: 'no' },
  'student.scratch_view': { label: '학생 연습장 열람(옛 기능)', icon: 'ph-eye', cls: 'neutral' },
  'lecture.question.update': { label: '확인문항 수정', icon: 'ph-pencil-simple', cls: 'neutral' },
  'lecture.question.delete': { label: '확인문항 삭제', icon: 'ph-trash', cls: 'no' },
  'lecture.question.generate': { label: '확인문항 AI 생성', icon: 'ph-sparkle', cls: 'ok' },
  'lecture.question.to_bank': { label: '확인문항 문제은행 배치', icon: 'ph-archive', cls: 'neutral' },
  'lecture.question.bulk_to_bank': { label: '확인문항 문제은행 일괄 배치', icon: 'ph-archive', cls: 'neutral' },
  'lecture.question.image.create': { label: '확인문항 이미지 첨부', icon: 'ph-image', cls: 'neutral' },
  'lecture.question.image.delete': { label: '확인문항 이미지 삭제', icon: 'ph-image', cls: 'warn' },
  'lecture.question.report': { label: '문항 신고', icon: 'ph-flag', cls: 'warn' },
  'lecture.question.report.resolve': { label: '문항 신고 처리', icon: 'ph-flag-checkered', cls: 'ok' },
  // 강사 — 수료시험 문항
  'course.exam_question.create': { label: '수료시험 문항 추가', icon: 'ph-plus-circle', cls: 'ok' },
  'course.exam_question.update': { label: '수료시험 문항 수정', icon: 'ph-pencil-simple', cls: 'neutral' },
  'course.exam_question.delete': { label: '수료시험 문항 삭제', icon: 'ph-trash', cls: 'no' },
  'course.exam_question.import_lectures': { label: '수료시험 문항 강의에서 가져오기', icon: 'ph-download-simple', cls: 'neutral' },
  'course.exam_question.import_bank': { label: '수료시험 문항 문제은행에서 가져오기', icon: 'ph-download-simple', cls: 'neutral' },
  'course.exam_question.generate': { label: '수료시험 문항 AI 생성', icon: 'ph-sparkle', cls: 'ok' },
  'course.exam_question.image.create': { label: '수료시험 문항 이미지 첨부', icon: 'ph-image', cls: 'neutral' },
  'course.exam_question.image.delete': { label: '수료시험 문항 이미지 삭제', icon: 'ph-image', cls: 'warn' },
  // 강사 — 자막/자료
  'lecture.transcript.set': { label: '강의 자막 저장', icon: 'ph-text-t', cls: 'neutral' },
  'lecture.transcript.upload': { label: '강의 자막 업로드', icon: 'ph-upload-simple', cls: 'neutral' },
  'lecture.transcript.delete': { label: '강의 자막 삭제', icon: 'ph-text-t', cls: 'warn' },
  'lecture.material.create': { label: '강의 자료 추가', icon: 'ph-paperclip', cls: 'ok' },
  'lecture.material.update': { label: '강의 자료 수정', icon: 'ph-pencil-simple', cls: 'neutral' },
  'lecture.material.delete': { label: '강의 자료 삭제', icon: 'ph-trash', cls: 'no' },
  // 운영자 — 강사/학생 계정
  'ops.instructor_create': { label: '강사 계정 생성', icon: 'ph-user-circle-plus', cls: 'warn' },
  'ops.instructor_update': { label: '강사 정보 수정', icon: 'ph-user-circle-gear', cls: 'neutral' },
  'ops.instructor_password_reset': { label: '강사 비밀번호 재설정', icon: 'ph-key', cls: 'warn' },
  'ops.instructor_delete': { label: '강사 계정 삭제', icon: 'ph-user-minus', cls: 'no' },
  // 가입되지 않은 아이디로 쌓인 로그인 실패 기록만 지운다(실제 계정·최근 24시간은 남긴다).
  'ops.login_throttle_purge_orphans': { label: '없는 계정 잠금기록 정리', icon: 'ph-trash', cls: 'neutral' },
  'ops.student_password_reset': { label: '학생 비밀번호 재설정', icon: 'ph-key', cls: 'warn' },
  'ops.login_throttle_unlock': { label: '로그인 잠금 해제', icon: 'ph-lock-open', cls: 'warn' },
  // 운영자 — AI 런타임/시스템 설정
  'ops.ai_runtime.model_create': { label: 'AI 런타임 모델 등록', icon: 'ph-cpu', cls: 'ok' },
  'ops.ai_runtime.model_update': { label: 'AI 런타임 모델 수정', icon: 'ph-cpu', cls: 'neutral' },
  'ops.ai_runtime.model_delete': { label: 'AI 런타임 모델 삭제', icon: 'ph-cpu', cls: 'no' },
  'ops.ai_runtime.config': { label: 'AI 런타임 설정 변경', icon: 'ph-sliders-horizontal', cls: 'neutral' },
  'system.settings.ai_keys': { label: 'AI API 키 설정', icon: 'ph-key', cls: 'warn' },
  'system.settings.ai_prompt': { label: 'AI 생성 프롬프트 변경', icon: 'ph-text-aa', cls: 'neutral' },
  'system.settings.ai_verify_prompt': { label: 'AI 검증 프롬프트 변경', icon: 'ph-text-aa', cls: 'neutral' },
  // 운영자 — 행동 데이터
  'behavior.label_mark': { label: '행동 데이터 라벨 변경', icon: 'ph-tag', cls: 'neutral' },
  'behavior.redteam_generate': { label: '레드팀 데이터 생성', icon: 'ph-sparkle', cls: 'neutral' },
};

/** 대상(target_type) 내부 코드 → 사람이 읽는 라벨 */
export const AUDIT_TARGET_LABEL: Record<string, string> = {
  organization: '기관',
  org_registration_request: '기관 가입신청',
  membership: '구성원',
  user: '사용자',
  user_setting: '계정 설정',
  student: '학생',
  student_profile: '학생',
  parent_student_link: '학부모 연결',
  invitation: '초대',
  join_code: '가입코드',
  class: '학급',
  api_key: 'API 키',
  captcha_setting: '캡차 설정',
  behavior_summary: '행동 데이터',
  model_version: 'AI 모델',
  inquiry: '문의',
  course: '코스',
  lecture: '강의',
  lecture_question: '확인문항',
  course_exam_question: '수료시험 문항',
  lecture_material: '강의 자료',
  lecture_transcript: '강의 자막',
  lecture_question_report: '문항 신고',
  ai_model_config: 'AI 모델 설정',
  login_throttle: '로그인 잠금',
  system_setting: '시스템 설정',
};

/**
 * 감사 로그의 「무엇이 바뀌었나」에 나오는 칸 이름.
 *
 * ★0816 지적 — "감사로그에는 자세하게 나와야 하는거 아니야? 말 그대로 로그인데".
 *   그전에는 「누가·언제·무슨 종류」까지만 보여 줬다. before/after 는 DB 에 있는데
 *   ★응답에 안 실려 있었다(backend#80 에서 실었다).
 *
 * ⚠️여기 없는 칸은 ★원문 그대로 보여 준다. 감사 로그의 칸은 종류가 많고(실측 69종)
 *   값이 함께 보여서 뜻이 통한다 — 「미등록 (…)」로 도배하면 오히려 읽기 어렵다.
 */
export const AUDIT_FIELD_LABEL: Record<string, string> = {
  title: '제목',
  name: '이름',
  status: '상태',
  subject: '과목',
  order_no: '차례',
  email: '이메일',
  email_status: '이메일 인증',
  code: '코드',
  label: '이름표',
  enabled: '켜짐',
  version: '판',
  count: '개수',
  reason: '사유',
  rating: '별점',
  price: '수강료',
  sale_price: '할인가',
  duration_sec: '길이(초)',
  position_sec: '뜨는 시점(초)',
  content_start_sec: '내용 시작(초)',
  answer_index: '정답 번호',
  answer_indexes: '정답 번호들',
  file_bytes: '파일 크기',
  video_bytes: '영상 크기',
  video_ext: '영상 형식',
  file_ext: '파일 형식',
  ext: '형식',
  model_id: '모델',
  provider: '제공사',
  product: '상품',
  first_party: '우리 앱 전용',
  edu_subjects: '열어 준 과목',
  rules: '규칙',
  settings: '설정',
  // ★중첩 설정은 backend#81 에서 "바깥.안쪽" 으로 펴서 온다 — 바뀐 칸 하나만 짚어 준다
  'settings.alerts.email': '알림 메일 받기',
  // ★학생 설정 — 이름은 ★학생 화면(StudentMyPage)의 실제 라벨을 그대로 가져왔다.
  //   추측하지 않는다. auditField() 가 마지막 조각으로도 찾으므로 옛 구조(toggles.*)와
  //   지금 구조(display.*·notify.*·sound.*) 둘 다 잡힌다.
  eye: '눈 보호 모드',
  dark: '어두운 화면',
  color: '색약 친화 표시',
  sfx: '효과음',
  voice: '음성 안내',
  reduce: '움직임 줄이기',
  font: '글자 크기',
  lecture: '강의 알림',
  exam: '수료·시험 알림',
  progress: '학습 진행 알림',
  remind: '학습 알림',
  weekly: '주간 리포트',
  badge: '배지 알림',
  'settings.alerts.push': '알림 받기',
  'settings.theme': '화면 테마',
  'settings.language': '언어',
  fail_count: '실패 횟수',
  locked: '잠김',
  identifiers: '지운 아이디',
  truncated: '목록에서 생략',
  kept_recent: '남긴 최근 기록',
  k_dropped: 'k-익명성으로 뺀 묶음',
  demoted_from_active: '공개에서 내린 문항',
  bank_id: '문제은행',
  lecture_id: '강의',
  course_id: '코스',
  image_id: '이미지',
  slot: '자리',
  origin: '출처',
  admin_email: '관리자 이메일',
  instructor_id: '강사',
  source_type: '출처 종류',
  fmt: '형식',
  mode: '방식',
  n: '개수',
  len: '길이',
  to: '받는 사람',
  from: '보낸 사람',
  changed: '바뀐 것',
  placed: '배치됨',
  bytes: '크기',
  ids: '대상들',
  rules_len: '규칙 길이',
  lectures_unassigned: '미분류로 풀린 강의',
  image_files_removed: '지운 이미지',
  file_removed: '파일 삭제',
  restorable: '되살릴 수 있음',
  published: '공개됨',
  self_verified: '자기검증 통과',
  transcript_used: '자막 사용',
  segments: '자막 구간',
  source: '출처',
  dataset: '학습셋',
  deleted: '지운 기록',
  skipped: '건너뜀',
  imported: '가져옴',
  created: '만듦',
  replaced: '바꿈',
};

/** 값이 참/거짓·빈 값일 때 사람 말로. 그 밖에는 그대로 보여 준다. */
/**
 * 칸 이름을 사람 말로. 매핑에 있으면 그것을, 없으면 ★마지막 조각만 보여 준다.
 *
 * ★중첩 설정은 "settings.alerts.email" 처럼 경로로 온다(backend#81). 경로를 통째로
 *   보여 주면 그것이 곧 개발자 말이다 — 매핑이 없으면 마지막 조각(email)이 그나마 읽힌다.
 */
export function auditField(field: string): string {
  const known = AUDIT_FIELD_LABEL[field];
  if (known) return known;
  const tail = field.split('.').pop() ?? field;
  return AUDIT_FIELD_LABEL[tail] ?? tail;
}

/**
 * ★한쪽 값만 있는 것을 「추가」·「삭제」라고 부르면 안 된다.
 *
 * audit() 을 부르는 곳마다 ★결과를 before 에 넣기도 하고 after 에 넣기도 한다.
 * 실측(0816) — 「없는 계정 잠금기록 정리」는 결과 넷을 이렇게 나눠 담았다.
 *
 *   before  {deleted: 270, identifiers: [...], truncated: 220}
 *   after   {kept_recent: 26}
 *
 * 둘 다 ★결과인데, 한쪽만 있다는 사실로 "만들었다/지웠다"를 추론하면 화면이
 * 「지운 기록 270 ★삭제」·「남긴 최근 기록 26 ★추가」라고 말한다 — 뜻이 틀리고
 * 서로 어긋난다. ★무엇을 한 것인지는 ★행동 이름이 이미 말한다.
 */
export function auditValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? '예' : '아니오';
  if (Array.isArray(v)) return v.length ? v.map((x) => String(x)).join(', ') : '(빈 목록)';
  if (typeof v === 'object') return JSON.stringify(v);
  if (v === '') return '(비어 있음)';
  // 상태값은 다른 화면과 같은 말을 쓴다 — 여기만 영문이 새면 안 된다
  const STATUS: Record<string, string> = {
    active: '공개', hidden: '비공개', disabled: '중지', deleted: '삭제됨',
    pending: '대기', approved: '승인', rejected: '거절',
  };
  return STATUS[String(v)] ?? String(v);
}



Object.assign(AUDIT_ACTION_META, {
    'behavior.export.preview': { label: '행동데이터 미리보기', icon: 'ph-eye', cls: 'neutral' },
    'behavior.export.requested': { label: '행동데이터 내보내기 요청', icon: 'ph-clock', cls: 'warn' },
    'behavior.export.completed': { label: '행동데이터 파일 생성 완료', icon: 'ph-check-circle', cls: 'ok' },
    'behavior.export.failed': { label: '행동데이터 파일 생성 실패', icon: 'ph-warning-circle', cls: 'no' },
    'behavior.export.download_issued': { label: '행동데이터 다운로드 링크 발급', icon: 'ph-link-simple', cls: 'warn' },
});
