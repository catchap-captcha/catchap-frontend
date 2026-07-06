import { client } from './client';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** 문의하기 접수 */
export const inquiryApi = {
  submit: (body: {
    inquiry_type: string;
    name: string;
    affiliation?: string;
    email: string;
    content: string;
  }) => client.post('/inquiries', body).then((r) => r.data),
};

/** AI 챗봇 stub (AI선생님 / 학부모 상담 AI) — seed 기반 응답, 추후 LLM 연동 */
export const aiChatApi = {
  studentChat: (message: string) =>
    client.post<any>('/ai/student-chat', { message }).then((r) => r.data),
  /** AI 선생님 첫 인사 — 이름/최근 학습 실데이터 반영 */
  studentChatGreeting: () => client.get<any>('/ai/student-chat/greeting').then((r) => r.data),
  parentChat: (childId: string, message: string) =>
    client.post<any>('/ai/parent-chat', { child_id: childId, message }).then((r) => r.data),
  /** 학부모 상담 AI 첫 인사 — 자녀별 intro 문구 */
  parentChatIntro: (childId: string) =>
    client.get<any>('/ai/parent-chat/intro', { params: { child_id: childId } }).then((r) => r.data),
};

/** CAPTCHA 위젯 stub — 메인 CAPTCHA API는 다음 단계 (#captcha-mount 슬롯용) */
export const captchaApi = {
  challenge: () => client.get<any>('/captcha/challenge').then((r) => r.data),
};

/** 리포트 (학부모 PDF/인쇄) */
export const reportApi = {
  list: () => client.get<any>('/parents/me/reports').then((r) => r.data),
  requestDownload: (reportId: string) =>
    client.post<any>(`/reports/${reportId}/download`).then((r) => r.data),
};
