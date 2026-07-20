import type { Role } from '../types/auth';
import { PATHS } from './paths';

/** 역할별 로그인 후 랜딩 화면 */
export const ROLE_HOME: Record<Role, string> = {
  student: PATHS.STUDENT_HOME,
  // 은퇴한 역할(학교 콘솔 0717·학부모 콘솔 0718)의 기존 계정은 종료 안내로.
  parent: PATHS.SCHOOL_SUNSET,
  teacher: PATHS.SCHOOL_SUNSET,
  grade_head: PATHS.SCHOOL_SUNSET,
  org_admin: PATHS.SCHOOL_SUNSET,
  ops: PATHS.OPS_APPROVAL, // 운영자: 기관 가입 승인 콘솔
  instructor: PATHS.OPS_INSTRUCTOR_HOME, // 강사: 홈 대시보드(검수 대기·학생 참여·약한 문항)로 착지
};

/** 경로 prefix → 접근 허용 role */
export const ROLE_PREFIX: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: '/student', roles: ['student'] },
  // 강사도 /ops 콘솔에 진입(강의 관리만) — 페이지별 허용은 라우트 정의가 담당
  { prefix: '/ops', roles: ['ops', 'instructor'] },
];
