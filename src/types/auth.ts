export type Role = 'student' | 'parent' | 'teacher' | 'grade_head' | 'org_admin' | 'ops';

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface MeResponse {
  id: string;
  role: Role;
  name: string;
  email: string | null;
  phone?: string | null;
  organization_id: string | null;
  organization_name: string | null;
  /** 학생 비번 초기화 후 true → 첫 로그인 시 새 비번 설정 강제 */
  must_change_password?: boolean;
  /** 학년부장(grade_head)의 담당 학년 — 그 외 역할은 null */
  managed_grade?: number | null;
  /** 학생일 때만: 학생 코드(CAT-xxxx), 별명, 반 정보 */
  student?: {
    student_login_id: string;
    student_code: string;
    nickname: string;
    class_id: string | null;
    class_name: string | null;
    grade_band: string;
    avatar: Record<string, string | null>;
    coins: number;
    level: number;
    age?: number | null;
  };
}

export interface LoginRequest {
  /** 로그인 탭 구분 — 서버가 계정 역할과 대조해 불일치면 403. 'org'는 기관 그룹(관리자/학년부장/교사). */
  role?: 'parent' | 'org' | 'teacher' | 'org_admin' | 'ops';
  email: string;
  password: string;
  /** 시연용 임시 — 캡차 API 도입 전까지 서버가 사용하지 않음(어떤 값도 통과 안 됨).
   *  도입 시 캡차 통과 토큰을 싣는 자리로 재사용(종전엔 forest 캡차 단일사용 토큰). */
  captcha_token?: string;
}

export interface StudentLoginRequest {
  /** 미지정 시 백엔드가 아이디로 기관 자동 판별 (여러 기관 중복 시 409) */
  organization_id?: string;
  student_login_id: string;
  password: string;
  /** 시연용 임시 — 캡차 API 도입 전까지 서버가 사용하지 않음(LoginRequest와 동일) */
  captcha_token?: string;
}

export type Gender = 'male' | 'female' | 'other';

export interface RegisterParentRequest {
  name: string;
  email: string;
  phone: string;
  password: string;
  email_code: string;
}

export interface RegisterTeacherRequest {
  name: string;
  email: string;
  password: string;
  email_code: string;
  organization_id: string;
  teacher_code: string;
  /** 초대 링크로 가입할 때 전달 — 서버가 이메일 소유를 확인해 인증코드를 생략한다 */
  invite_token?: string;
}

export interface RegisterStudentRequest {
  name: string;
  /** 학생 이메일 가입 전환(2026-07-16): 기관 경유 가입에서만 사용 — 이메일 가입은 생략 */
  organization_id?: string;
  org_code?: string;
  email: string;
  email_code: string;
  /** 생략 시 서버가 이메일(소문자)을 로그인 아이디로 사용 */
  student_login_id?: string;
  password: string;
}

export interface RegisterOrgRequest {
  org_name: string;
  org_type: string;
  business_number: string;
  address: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  password: string;
  email_code: string;
  expected_students: string;
  plan_interest: string;
}
