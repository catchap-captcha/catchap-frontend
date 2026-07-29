import { client } from './client';
import type {
  LoginRequest,
  MeResponse,
  RegisterParentRequest,
  RegisterStudentRequest,
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
   * forAccount: 계정용 이메일(학부모/교사/기관)이면 true — 이미 가입된 이메일이면 409
   * guardian: 만 14세 미만 학생 가입의 보호자(법정대리인) 동의 코드 — 기존 계정 이메일 허용 */
  sendEmailCode: (email: string, purpose: 'signup' | 'reset' | 'guardian' = 'signup', forAccount = false) =>
    client
      .post('/auth/email/send', { email, purpose, for_account: forAccount })
      .then((r) => r.data),

  /** 학생 아이디 전역 중복 확인 — 중복이면 사용 가능한 추천 아이디(suggestions) 동반 */
  checkStudentId: (studentLoginId: string) =>
    client
      .post<{ available: boolean; suggestions: string[] }>('/auth/check-student-id', {
        student_login_id: studentLoginId,
      })
      .then((r) => r.data),

  verifyEmailCode: (email: string, code: string, purpose: 'signup' | 'reset' | 'guardian' = 'signup') =>
    client
      .post<{ verified: boolean }>('/auth/email/verify', { email, code, purpose })
      .then((r) => r.data),

  registerParent: (req: RegisterParentRequest) =>
    client.post('/auth/register/parent', req).then((r) => r.data),

  registerStudent: (req: RegisterStudentRequest) =>
    client.post('/auth/register/student', req).then((r) => r.data),

  /** 비밀번호 재설정 (이메일 → 6자리 코드 → 새 비밀번호) */
  passwordResetRequest: (email: string) =>
    client.post('/auth/password-reset/request', { email }).then((r) => r.data),

  passwordResetConfirm: (email: string, code: string, newPassword: string) =>
    client
      .post('/auth/password-reset/confirm', { email, code, new_password: newPassword })
      .then((r) => r.data),

  /**
   * 아이디 찾기 — 이메일로 받은 6자리 코드로 본인 확인 후, 그 이메일에 연결된 로그인 아이디를 받는다.
   *
   * ⚠ 백엔드에 아직 이 엔드포인트가 없다(2026-07-28 확인 — `/auth/*` 에 find-id 라우트 없음).
   * 서버가 404/405/501로 답하면 화면(FindIdPage)이 '아직 준비되지 않았어요' 안내로 분기한다.
   * 서버가 생기면 화면 수정 없이 그대로 동작한다.
   */
  findId: (email: string, code: string) =>
    client
      .post<{ accounts: FoundAccount[] }>('/auth/find-id', { email, code })
      .then((r) => r.data),
};

/** 아이디 찾기 결과 한 건 — 한 이메일에 학생·보호자 계정이 함께 걸릴 수 있어 목록으로 받는다. */
export interface FoundAccount {
  /** 로그인에 쓰는 아이디. 이메일 계정(운영자·강사·학부모)이면 이메일 그 자체 */
  login_id: string;
  role: string;
  /** 가입일(있으면 표시) — 같은 이메일에 계정이 여럿일 때 구분에 쓴다 */
  created_at?: string | null;
}
