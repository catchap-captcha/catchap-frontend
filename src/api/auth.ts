import { client } from './client';
import type {
  LoginRequest,
  MeResponse,
  RegisterOrgRequest,
  RegisterParentRequest,
  RegisterStudentRequest,
  RegisterTeacherRequest,
  StudentLoginRequest,
  TokenPair,
} from '../types/auth';

export const authApi = {
  login: (req: LoginRequest) => client.post<TokenPair>('/auth/login', req).then((r) => r.data),

  /** 운영자 전용 로그인 — 숨겨진 경로(/ops/login)에서만 사용 */
  opsLogin: (email: string, password: string) =>
    client.post<TokenPair>('/auth/ops-login', { email, password }).then((r) => r.data),

  studentLogin: (req: StudentLoginRequest) =>
    client.post<TokenPair>('/auth/student-login', req).then((r) => r.data),

  logout: () => client.post('/auth/logout').then((r) => r.data),

  me: () => client.get<MeResponse>('/auth/me').then((r) => r.data),

  /** 회원가입 — 6자리 이메일 인증코드 방식 (디자인 기준).
   * forAccount: 계정용 이메일(학부모/교사/기관)이면 true — 이미 가입된 이메일이면 409 */
  sendEmailCode: (email: string, purpose: 'signup' | 'reset' = 'signup', forAccount = false) =>
    client
      .post('/auth/email/send', { email, purpose, for_account: forAccount })
      .then((r) => r.data),

  /** 학생 아이디 전역 중복 확인 (회원가입 '중복 확인' 버튼) */
  checkStudentId: (studentLoginId: string) =>
    client
      .post<{ available: boolean }>('/auth/check-student-id', {
        student_login_id: studentLoginId,
      })
      .then((r) => r.data),

  verifyEmailCode: (email: string, code: string, purpose: 'signup' | 'reset' = 'signup') =>
    client
      .post<{ verified: boolean }>('/auth/email/verify', { email, code, purpose })
      .then((r) => r.data),

  registerParent: (req: RegisterParentRequest) =>
    client.post('/auth/register/parent', req).then((r) => r.data),

  registerTeacher: (req: RegisterTeacherRequest) =>
    client.post('/auth/register/teacher', req).then((r) => r.data),

  registerStudent: (req: RegisterStudentRequest) =>
    client.post('/auth/register/student', req).then((r) => r.data),

  /** 학교 발급 가입 코드로 학생 활성화 → 즉시 로그인(토큰) */
  activateStudent: (req: { code: string; nickname: string; password: string }) =>
    client.post<TokenPair>('/auth/activate-student', req).then((r) => r.data),

  registerOrg: (req: RegisterOrgRequest) =>
    client.post('/auth/register/org', req).then((r) => r.data),

  /** 비밀번호 재설정 (이메일 → 6자리 코드 → 새 비밀번호) */
  passwordResetRequest: (email: string) =>
    client.post('/auth/password-reset/request', { email }).then((r) => r.data),

  passwordResetConfirm: (email: string, code: string, newPassword: string) =>
    client
      .post('/auth/password-reset/confirm', { email, code, new_password: newPassword })
      .then((r) => r.data),

  /** 기관 코드(HS-EDU-xxxx)/교사 코드(T-xxxx) 확인 */
  verifyOrgCode: (organizationId: string, code: string) =>
    client
      .post<{ valid: boolean; organization_name?: string }>('/auth/verify-org-code', {
        organization_id: organizationId,
        code,
      })
      .then((r) => r.data),

  verifyTeacherCode: (organizationId: string, code: string) =>
    client
      .post<{ valid: boolean }>('/auth/verify-teacher-code', {
        organization_id: organizationId,
        code,
      })
      .then((r) => r.data),
};
