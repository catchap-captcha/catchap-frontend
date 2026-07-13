import { client } from './client';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const parentApi = {
  children: () => client.get<any[]>('/parents/me/children').then((r) => r.data),

  /** 학부모 홈(주간 요약) blob — childId 미지정 시 첫 자녀 */
  childSummary: (childId: string) =>
    client.get<any>(`/parents/me/children/${childId}/summary`).then((r) => r.data),

  /** 상세 리포트 (기간 week|month|year, 과목) */
  childReport: (childId: string, period: string, subject?: string) =>
    client
      .get<any>(`/parents/me/children/${childId}/report`, { params: { period, subject } })
      .then((r) => r.data),

  /** 자녀 연결: 학교 발급 초대코드(LINK-xxxx) 입력 — 1회용·만료, 자녀 수 제한 없음 (학생코드 자동승인 폐지, B1) */
  linkInvite: (inviteCode: string) =>
    client.post<any>('/parents/me/children/link-invite', { invite_code: inviteCode })
      .then((r) => r.data),

  unlink: (childId: string) =>
    client.delete(`/parents/me/children/${childId}/link`).then((r) => r.data),

  /** 자녀별 목표/시간제한 설정 */
  childSettings: (childId: string) =>
    client.get<any>(`/parents/me/children/${childId}/settings`).then((r) => r.data),
  saveChildSettings: (childId: string, body: any) =>
    client.put(`/parents/me/children/${childId}/settings`, body).then((r) => r.data),

  /** 학부모 프로필(이름/연락처) — users 실테이블 UPDATE */
  updateProfile: (body: { name?: string; phone?: string }) =>
    client.patch<any>('/parents/me/profile', body).then((r) => r.data),
};
