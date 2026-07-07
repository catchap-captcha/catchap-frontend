import type { Role } from '../types/auth';
import { PATHS } from './paths';

/** 역할별 로그인 후 랜딩 화면 */
export const ROLE_HOME: Record<Role, string> = {
  student: PATHS.STUDENT_HOME,
  parent: PATHS.PARENT_HOME,
  teacher: PATHS.TEACHER_HOME,
  grade_head: PATHS.ORG_CLASSES, // 학년부장: 담당 학년 학급·학생 화면(전교 대시보드 접근 불가)
  org_admin: PATHS.ORG_HOME,
  ops: PATHS.OPS_APPROVAL, // 운영자: 기관 가입 승인 콘솔
};

/** 경로 prefix → 접근 허용 role */
export const ROLE_PREFIX: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: '/student', roles: ['student'] },
  { prefix: '/parent', roles: ['parent'] },
  { prefix: '/teacher', roles: ['teacher', 'grade_head', 'org_admin'] },
  // 학년부장도 기관 콘솔 진입 — 관리 동작은 백엔드가 담당 학년으로 스코프
  { prefix: '/org', roles: ['grade_head', 'org_admin', 'ops'] },
  { prefix: '/ops', roles: ['ops'] },
];
