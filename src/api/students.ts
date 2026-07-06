import { client } from './client';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const studentApi = {
  /** 학습 홈 blob (진행/과목/성장/랭킹/배지 요약) */
  dashboard: () => client.get<any>('/students/me/dashboard').then((r) => r.data),

  /** 챕터지도·전체학습 진도 */
  progress: (subject?: string) =>
    client.get<any>('/students/me/progress', { params: { subject } }).then((r) => r.data),

  /** 나의기록 blob (주간/달력/실력/추이/최근활동) */
  records: () => client.get<any>('/students/me/records').then((r) => r.data),

  wrongNotes: () => client.get<any>('/students/me/wrong-notes').then((r) => r.data),

  badges: () => client.get<any>('/students/me/badges').then((r) => r.data),

  recommendations: () => client.get<any>('/students/me/recommendations').then((r) => r.data),

  dailyQuiz: () => client.get<any>('/students/me/daily-quiz').then((r) => r.data),

  /** 프로필 꾸미기: 지갑(코인/보유)/상점/아바타 */
  wallet: () => client.get<any>('/students/me/wallet').then((r) => r.data),
  shopCatalog: () => client.get<any>('/shop/catalog').then((r) => r.data),
  purchase: (itemId: string) =>
    client.post('/students/me/shop/purchase', { item_id: itemId }).then((r) => r.data),
  saveAvatar: (avatar: Record<string, string | null>) =>
    client.put('/students/me/avatar', { avatar }).then((r) => r.data),
  updateProfile: (body: any) => client.patch('/students/me/profile', body).then((r) => r.data),

  /** 반 랭킹 (폴링) */
  classRanking: () => client.get<any>('/students/me/class-ranking').then((r) => r.data),

  /** 게임 세션: 결과 저장 + 결과 화면 blob */
  saveAttempt: (body: any) => client.post('/learning/attempts', body).then((r) => r.data),
  result: (subject: string) =>
    client.get<any>('/students/me/result', { params: { subject } }).then((r) => r.data),

  /** 게임화면 상태 blob (문제 진행/점수/보상 — CAPTCHA 챌린지 자체는 stub) */
  gameState: (subject: string) =>
    client.get<any>('/students/me/game-state', { params: { subject } }).then((r) => r.data),

  /** 개념 읽음 서버 동기화 */
  markConceptRead: (conceptId: string) =>
    client.post('/students/me/concepts/read', { concept_id: conceptId }).then((r) => r.data),
  conceptReads: () => client.get<string[]>('/students/me/concepts/read').then((r) => r.data),

  /** 검색 콘텐츠 인덱스 */
  searchContent: (q: string) =>
    client.get<any>('/contents/search', { params: { q } }).then((r) => r.data),

  /** 본인 비밀번호 변경 (초기화 후 강제 변경 포함) */
  changePassword: (newPassword: string) =>
    client.patch('/students/me/password', { new_password: newPassword }).then((r) => r.data),
};
