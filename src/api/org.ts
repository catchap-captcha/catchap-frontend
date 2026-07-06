import { client } from './client';

export interface Institution {
  id: string;
  name: string;
  type: string; // 초등학교 | 유치원 | 어린이집
  sido: string;
  sigungu: string;
  dong: string;
  road_address: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export const orgApi = {
  /** InstitutionPicker: 기관명/도로명 검색 + 지역 드릴다운 */
  searchInstitutions: (params: { q?: string; sido?: string; sigungu?: string; dong?: string }) =>
    client.get<Institution[]>('/institutions/search', { params }).then((r) => r.data),

  regions: (params: { sido?: string; sigungu?: string }) =>
    client.get<string[]>('/institutions/regions', { params }).then((r) => r.data),

  me: () => client.get<any>('/orgs/me').then((r) => r.data),

  update: (orgId: string, body: any) =>
    client.patch(`/orgs/${orgId}`, body).then((r) => r.data),

  /** 기관 대시보드(기간: week|month|year) — 화면 blob */
  dashboard: (orgId: string, period: string) =>
    client.get<any>(`/orgs/${orgId}/dashboard`, { params: { period } }).then((r) => r.data),

  analytics: (orgId: string, period: string, subject?: string) =>
    client
      .get<any>(`/orgs/${orgId}/analytics`, { params: { period, subject } })
      .then((r) => r.data),

  /** 학급학생관리 화면 */
  classes: (orgId: string) => client.get<any>(`/orgs/${orgId}/classes`).then((r) => r.data),
  roster: (orgId: string, params?: any) =>
    client.get<any>(`/orgs/${orgId}/roster`, { params }).then((r) => r.data),

  /** 선생님관리 CRUD */
  teachers: (orgId: string) => client.get<any>(`/orgs/${orgId}/teachers`).then((r) => r.data),
  addTeacher: (orgId: string, body: any) =>
    client.post(`/orgs/${orgId}/teachers`, body).then((r) => r.data),
  updateTeacher: (orgId: string, teacherId: string, body: any) =>
    client.patch(`/orgs/${orgId}/teachers/${teacherId}`, body).then((r) => r.data),
  deleteTeacher: (orgId: string, teacherId: string) =>
    client.delete(`/orgs/${orgId}/teachers/${teacherId}`).then((r) => r.data),

  /** 캡차설정 (종류 on/off, 라운드당 개수, 셔플) */
  captchaSettings: (orgId: string) =>
    client.get<any>(`/orgs/${orgId}/captcha-settings`).then((r) => r.data),
  saveCaptchaSettings: (orgId: string, body: any) =>
    client.put(`/orgs/${orgId}/captcha-settings`, body).then((r) => r.data),

  /** AI 모델 레지스트리 (읽기전용) */
  aiModels: (orgId: string) => client.get<any>(`/orgs/${orgId}/ai-models`).then((r) => r.data),

  /** 기관 마이페이지: 요금제/사용량/결제(조회 전용, 결제 실행은 mock) */
  billing: (orgId: string) => client.get<any>(`/orgs/${orgId}/billing`).then((r) => r.data),
  admins: (orgId: string) => client.get<any>(`/orgs/${orgId}/admins`).then((r) => r.data),

  /** 기관 대시보드 API·사이트 상태 위젯 (읽기전용 — 키 발급 UI는 디자인에 없음) */
  siteStatus: (orgId: string) =>
    client.get<any>(`/orgs/${orgId}/site-status`).then((r) => r.data),

  /** OrgLayout 사이드바 위젯 (pro/semester/insight — compliance는 정적) */
  sidebar: (orgId: string) => client.get<any>(`/orgs/${orgId}/sidebar`).then((r) => r.data),

  /** 보안·정책 화면 통계 (보호자 동의 완료율) */
  securityStats: (orgId: string) =>
    client.get<any>(`/orgs/${orgId}/security-stats`).then((r) => r.data),

  /** 학생 슬롯 N개 생성 + 1회용 가입코드 발급 (온보딩) */
  registerStudents: (orgId: string, body: { count: number; class_label?: string; class_id?: string }) =>
    client.post<any>(`/orgs/${orgId}/students/register`, body).then((r) => r.data),

  /** 학생 1명 학부모 초대코드 발급 */
  issueInvite: (orgId: string, studentId: string) =>
    client.post<any>(`/orgs/${orgId}/students/${studentId}/invite-code`).then((r) => r.data),

  /** 학생 비밀번호 초기화 (임시 비번 + refresh 폐기 + 감사) */
  resetStudentPassword: (orgId: string, studentId: string) =>
    client.post<any>(`/orgs/${orgId}/students/${studentId}/reset-password`).then((r) => r.data),

  /** 학생에 연결된 학부모 목록 / 연결 해제 */
  parentLinks: (orgId: string, studentId: string) =>
    client.get<any>(`/orgs/${orgId}/students/${studentId}/parent-links`).then((r) => r.data),
  revokeParentLink: (orgId: string, linkId: string) =>
    client.post<any>(`/orgs/${orgId}/parent-links/${linkId}/revoke`).then((r) => r.data),

  /** 학생 반 배정/이동 */
  assignClass: (orgId: string, studentId: string, classLabel: string) =>
    client.patch<any>(`/orgs/${orgId}/students/${studentId}/class`, { class_label: classLabel }).then((r) => r.data),
};
