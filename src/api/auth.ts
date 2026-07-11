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

  /** 학생 가입 코드를 소비하지 않고 상태만 확인 (아이디/비번 입력 전 먼저 막기) */
  verifyJoinCode: (code: string) =>
    client
      .post<{ valid: boolean; reason: 'ok' | 'empty' | 'not_found' | 'used' | 'expired' }>(
        '/auth/verify-join-code',
        { code },
      )
      .then((r) => r.data),

  /** 학생 아이디 전역 중복 확인 — 중복이면 사용 가능한 추천 아이디(suggestions) 동반 */
  checkStudentId: (studentLoginId: string) =>
    client
      .post<{ available: boolean; suggestions: string[] }>('/auth/check-student-id', {
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

  /** 학교 발급 가입 코드로 학생 활성화 → 즉시 로그인(토큰). 아이디는 학생이 직접 정함(중복 확인). */
  activateStudent: (req: {
    code: string;
    student_login_id: string;
    nickname: string;
    password: string;
  }) => client.post<TokenPair>('/auth/activate-student', req).then((r) => r.data),

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

  /** 교사 초대링크 검증 → 가입화면 프리필용 기관·교사코드 반환 (토큰이 곧 인증) */
  getInvite: (token: string) =>
    client
      .get<{
        valid: boolean;
        organization_id: string;
        organization_name: string;
        email: string;
        role: string;
        teacher_code: string;
        name: string | null;
        inst_type: string;
        sido: string;
        sigungu: string;
        dong: string;
        road_address: string;
      }>(`/auth/invite/${encodeURIComponent(token)}`)
      .then((r) => r.data),
};
