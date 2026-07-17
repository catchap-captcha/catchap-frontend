import type { Role } from '../types/auth';
import { PATHS } from './paths';

/** 역할별 로그인 후 랜딩 화면 */
export const ROLE_HOME: Record<Role, string> = {
  student: PATHS.STUDENT_HOME,
  parent: PATHS.PARENT_HOME,
  // 학교(교사/기관) 콘솔은 제품 전환(2026-07-17)으로 제거 — 기존 계정은 종료 안내로.
  teacher: PATHS.SCHOOL_SUNSET,
  grade_head: PATHS.SCHOOL_SUNSET,
  org_admin: PATHS.SCHOOL_SUNSET,
  ops: PATHS.OPS_APPROVAL, // 운영자: 기관 가입 승인 콘솔
  instructor: PATHS.OPS_LECTURES, // 강사: 자기 강의 관리 콘솔 (운영자 초대로만 생성)
};

/** 경로 prefix → 접근 허용 role */
export const ROLE_PREFIX: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: '/student', roles: ['student'] },
  { prefix: '/parent', roles: ['parent'] },
  // 강사도 /ops 콘솔에 진입(강의 관리만) — 페이지별 허용은 라우트 정의가 담당
  { prefix: '/ops', roles: ['ops', 'instructor'] },
];
