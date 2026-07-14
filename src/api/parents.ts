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

  /** 자녀 전체학습(숙련 축) 과목×챕터별 정답률 — 학생 화면과 동일 집계 */
  childChapterStats: (childId: string) =>
    client.get<any>(`/parents/me/children/${childId}/chapter-stats`).then((r) => r.data),
  /** 자녀 오늘의 퀴즈(습관 축) 일별 완료·정답률 + 연속일 */
  childHabitStats: (childId: string, weeks = 4) =>
    client
      .get<any>(`/parents/me/children/${childId}/habit-stats`, { params: { weeks } })
      .then((r) => r.data),

  /** 자녀 연결: 학교 발급 초대코드(LINK-xxxx) — 보호자(법정대리인) 개인정보 처리 동의 필수(#58) */
  linkInvite: (inviteCode: string, consent: boolean) =>
    client.post<any>('/parents/me/children/link-invite', { invite_code: inviteCode, consent })
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
