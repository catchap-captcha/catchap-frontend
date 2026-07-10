import { client } from './client';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const studentApi = {
  /** 학습 홈 blob (진행/과목/성장/랭킹/배지 요약) */
  dashboard: () => client.get<any>('/students/me/dashboard').then((r) => r.data),

  /** 챕터지도·전체학습 진도 */
  progress: (subject?: string) =>
    client.get<any>('/students/me/progress', { params: { subject } }).then((r) => r.data),

  /** 전체학습 주간 챕터 — 과목별 챕터/5단계 진행/달력 잠금(월요일 해제). 오늘의퀴즈와 분리된 학습 축 */
  chapters: (subject?: string) =>
    client.get<any>('/students/me/chapters', { params: { subject } }).then((r) => r.data),
  /** 챕터 한 단계(2문항) 발급 — stage 미지정 시 이어하기(다음 미완료 단계) */
  chapterSession: (subject: string, chapter: number, stage?: number) =>
    client
      .get<any>('/students/me/chapter-session', { params: { subject, chapter, stage } })
      .then((r) => r.data),
  /** 문항 1개 서버 채점 — 챕터 플레이는 chapter_no/stage 실어 오늘의퀴즈 미오염 + 단계 커서 전진 */
  gameAnswer: (body: any) =>
    client.post<any>('/students/me/game-answer', body).then((r) => r.data),
  /** 위젯 세션(챕터 한 단계=2문항) 완료 → 단계 커서 전진 */
  chapterStageComplete: (body: { subject: string; chapter: number; stage: number }) =>
    client.post<any>('/students/me/chapter-stage-complete', body).then((r) => r.data),
  /** 챕터 지난 기록(정답률) — 결과 화면 '지난 기록 vs 이번' 비교. before=이번 세션 시작(ISO) */
  chapterHistory: (subject: string, chapter: number, before?: string) =>
    client
      .get<any>('/students/me/chapter-history', { params: { subject, chapter, before } })
      .then((r) => r.data),

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

  /** 학년 랭킹 (폴링) */
  classRanking: () => client.get<any>('/students/me/class-ranking').then((r) => r.data),
  /** 상장 목록 (학년 랭킹 상위 3위 + 개근상) — 개근 뱃지 자동 지급 포함 */
  awards: () => client.get<any>('/students/me/awards').then((r) => r.data),

  /** 게임 세션: 결과 저장 + 결과 화면 blob */
  saveAttempt: (body: any) => client.post('/learning/attempts', body).then((r) => r.data),
  result: (subject: string) =>
    client.get<any>('/students/me/result', { params: { subject } }).then((r) => r.data),

  /** 게임화면 상태 blob (문제 진행/점수/보상 — CAPTCHA 챌린지 자체는 stub) */
  gameState: (subject: string) =>
    client.get<any>('/students/me/game-state', { params: { subject } }).then((r) => r.data),

  /** 일일 교육과정 — 지난날(복습)·오늘(과제)·다음날(잠금·주제만) */
  curriculum: (subject: string, back = 7, forward = 5) =>
    client.get<any>('/students/me/curriculum', { params: { subject, back, forward } }).then((r) => r.data),
  /** 특정 일차 상세 (미래는 잠금·주제만) */
  curriculumDay: (subject: string, day: number) =>
    client.get<any>('/students/me/curriculum/day', { params: { subject, day } }).then((r) => r.data),
  /* (실전 모드 폐지) gameSession/gameAnswer 제거 — 문항 발급·채점·적립은
     교육형 위젯(/captcha/v1/*)이 담당. 백엔드 엔드포인트는 잔존. */

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
