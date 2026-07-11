import { client } from './client';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const teacherApi = {
  /** 교사 대시보드 blob (KPI/요일별/놀이별/주의학생/할일) */
  dashboard: () => client.get<any>('/teacher/dashboard').then((r) => r.data),

  /** 우리반 학생 */
  myClassStudents: () => client.get<any>('/teacher/class/students').then((r) => r.data),
  addStudentByCode: (studentCode: string) =>
    client.post('/teacher/class/students', { student_code: studentCode }).then((r) => r.data),
  updateStudent: (studentId: string, body: any) =>
    client.patch(`/teacher/class/students/${studentId}`, body).then((r) => r.data),
  removeStudent: (studentId: string) =>
    client.delete(`/teacher/class/students/${studentId}`).then((r) => r.data),
  studentDetail: (studentId: string) =>
    client.get<any>(`/teacher/class/students/${studentId}`).then((r) => r.data),
  /** 자기 반 학생 비밀번호 초기화 (담임만) → 임시 비번 1회 반환 */
  resetStudentPassword: (studentId: string) =>
    client
      .post<{ ok: boolean; temp_password: string }>(
        `/teacher/class/students/${studentId}/reset-password`,
      )
      .then((r) => r.data),

  /** 자기 반 학생의 학부모 초대 코드 발급 (담임만) → 초대 코드 1회 반환 */
  issueParentInvite: (studentId: string) =>
    client
      .post<{ ok: boolean; invite_code: string }>(
        `/teacher/class/students/${studentId}/invite-code`,
      )
      .then((r) => r.data),

  /** 전체 학생 조회(전교) */
  allStudents: (params?: any) =>
    client.get<any>('/teacher/students', { params }).then((r) => r.data),

  /** 학습 분석 (기간/과목) */
  analytics: (period: string, subject?: string) =>
    client.get<any>('/teacher/analytics', { params: { period, subject } }).then((r) => r.data),

  /** 가정안내: 보호자 메시지 */
  familyMessages: () => client.get<any>('/teacher/family-messages').then((r) => r.data),
  sendFamilyMessage: (studentIds: string[], message: string) =>
    client
      .post('/teacher/family-messages', { student_ids: studentIds, message })
      .then((r) => r.data),

  /** 마이페이지 */
  profile: () => client.get<any>('/teacher/profile').then((r) => r.data),
  saveProfile: (body: any) => client.patch('/teacher/profile', body).then((r) => r.data),
  myClasses: () => client.get<any>('/teacher/classes').then((r) => r.data),
};
