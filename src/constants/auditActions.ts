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
  'ops.ai_model_create': { label: 'AI 모델 등록', icon: 'ph-cpu', cls: 'ok' },
  'ops.ai_model_update': { label: 'AI 모델 수정', icon: 'ph-cpu', cls: 'neutral' },
  // 기관 관리자 — 학년부장/학급
  'org.grade_head_appoint': { label: '학년부장 임명', icon: 'ph-user-circle-gear', cls: 'ok' },
  'org.grade_head_dismiss': { label: '학년부장 해임', icon: 'ph-user-circle-minus', cls: 'warn' },
  'org.class_create': { label: '학급 생성', icon: 'ph-plus-circle', cls: 'ok' },
  'org.class_dissolve': { label: '학급 해산', icon: 'ph-minus-circle', cls: 'no' },
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
};
