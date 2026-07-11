import { client } from './client';

export interface Institution {
  id: string;
  name: string;
  type: string; // 초등학교 | 유치원 | 어린이집
  sido: string;
  sigungu: string;
  dong: string;
  road_address: string;
  organization_id: string | null; // CatChap에 실제 등록된 기관이면 그 org id, 아니면 null
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
  /** 새 학급 생성 (교장=전 학년, 학년부장=담당 학년만) */
  createClass: (orgId: string, name: string) =>
    client.post<any>(`/orgs/${orgId}/classes`, { name }).then((r) => r.data),
  /** 학급 해체 (학년말) — 배정 학생 있으면 409 */
  dissolveClass: (orgId: string, classId: string) =>
    client.delete<any>(`/orgs/${orgId}/classes/${classId}`).then((r) => r.data),
  /** 기관 코드 재발급 (교장 전용) — 새 코드 + 만료 1년 연장 */
  rotateCode: (orgId: string) =>
    client.post<any>(`/orgs/${orgId}/rotate-code`).then((r) => r.data),
  /** 기관 활동 기록 — 자기 기관 스코프 (운영자 행위 제외, 학생은 익명코드) */
  auditLogs: (
    orgId: string,
    params: { action?: string; date_from?: string; date_to?: string; page?: number; page_size?: number },
  ) => client.get<any>(`/orgs/${orgId}/audit-logs`, { params }).then((r) => r.data),
  roster: (orgId: string, params?: any) =>
    client.get<any>(`/orgs/${orgId}/roster`, { params }).then((r) => r.data),

  /** 선생님관리 CRUD */
  teachers: (orgId: string) => client.get<any>(`/orgs/${orgId}/teachers`).then((r) => r.data),
  addTeacher: (orgId: string, body: any) =>
    client.post(`/orgs/${orgId}/teachers`, body).then((r) => r.data),
  /** 교사 초대링크 발송 — 이메일로 초대, 링크 클릭 시 기관·교사코드 자동입력 (교장/학년부장만) */
  inviteTeacher: (
    orgId: string,
    body: { email: string; name?: string; role?: string; class_name?: string },
  ) => client.post(`/orgs/${orgId}/teacher-invites`, body).then((r) => r.data),
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

  /** 학생 슬롯 N개 생성 + 1회용 가입코드 발급 (온보딩). names=실명 목록(교사·기관 전용) */
  registerStudents: (
    orgId: string,
    body: {
      count: number;
      class_label?: string;
      class_id?: string;
      names?: string[];
      // 성별(선생님 입력) — 이름/슬롯 순서대로. male|female|other|null(미정)
      genders?: (string | null)[];
    },
  ) => client.post<any>(`/orgs/${orgId}/students/register`, body).then((r) => r.data),

  /** 미가입 학생의 가입 코드 재발급 (학생이 코드를 잊었을 때) — 옛 코드는 무효, 새 코드 1회 노출 */
  reissueJoinCode: (orgId: string, codeId: string) =>
    client
      .post<any>(`/orgs/${orgId}/students/join-codes/${codeId}/reissue`)
      .then((r) => r.data),

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

  /** 학년부장 관리 (교장 전용) — 임명/해임/목록 */
  gradeHeads: (orgId: string) =>
    client.get<any>(`/orgs/${orgId}/grade-heads`).then((r) => r.data),
  appointGradeHead: (orgId: string, teacherId: string, grade: number) =>
    client.post<any>(`/orgs/${orgId}/teachers/${teacherId}/grade-head`, { grade }).then((r) => r.data),
  dismissGradeHead: (orgId: string, teacherId: string) =>
    client.delete<any>(`/orgs/${orgId}/teachers/${teacherId}/grade-head`).then((r) => r.data),

  /** API 키 관리 (교장 전용) — 자기 기관만. 발급은 구매 범위로 제한됨. */
  apiEntitlements: (orgId: string) =>
    client.get<OrgApiEntitlements>(`/orgs/${orgId}/api-entitlements`).then((r) => r.data),
  apiKeys: (orgId: string) =>
    client.get<OrgApiKey[]>(`/orgs/${orgId}/api-keys`).then((r) => r.data),
  issueApiKey: (orgId: string, body: OrgIssueKeyBody) =>
    client.post<OrgIssuedKey>(`/orgs/${orgId}/api-keys`, body).then((r) => r.data),
  revokeApiKey: (orgId: string, keyId: string) =>
    client.delete<{ ok: boolean }>(`/orgs/${orgId}/api-keys/${keyId}`).then((r) => r.data),
  rotateSecret: (orgId: string, keyId: string) =>
    client
      .post<{ ok: boolean; site_key: string; secret_key: string }>(
        `/orgs/${orgId}/api-keys/${keyId}/rotate-secret`,
      )
      .then((r) => r.data),
};

export interface OrgApiEntitlements {
  products: string[];
  edu_subjects: string[];
  plan: string;
  usage: { used: number; quota: number };
  subject_usage: Record<string, number>;
  product_names: Record<string, string>;
}
export interface OrgApiKey {
  id: string;
  product: string;
  product_name: string;
  subject: string | null;
  label: string | null;
  first_party: boolean;
  site_key: string;
  status: string;
  usage_month: number;
  last_used_at: string | null;
  created_at: string | null;
}
export interface OrgIssueKeyBody {
  product: string;
  subject?: string;
  label?: string;
  domain?: string;
}
export interface OrgIssuedKey extends OrgApiKey {
  ok: boolean;
  secret_key: string;
}
