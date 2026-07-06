import type { Role } from '../types/auth';
import { PATHS } from './paths';

/** 역할별 로그인 후 랜딩 화면 */
export const ROLE_HOME: Record<Role, string> = {
  student: PATHS.STUDENT_HOME,
  parent: PATHS.PARENT_HOME,
  teacher: PATHS.TEACHER_HOME,
  org_admin: PATHS.ORG_HOME,
  ops: PATHS.OPS_APPROVAL, // 운영자: 기관 가입 승인 콘솔
};

/** 경로 prefix → 접근 허용 role */
export const ROLE_PREFIX: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: '/student', roles: ['student'] },
  { prefix: '/parent', roles: ['parent'] },
  { prefix: '/teacher', roles: ['teacher', 'org_admin'] },
  { prefix: '/org', roles: ['org_admin', 'ops'] },
  { prefix: '/ops', roles: ['ops'] },
];
