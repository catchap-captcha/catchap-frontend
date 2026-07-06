import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { Role } from '../types/auth';
import { PATHS } from './paths';
import { ROLE_HOME } from './roleRoutes';

/**
 * 로그인 + role 검사.
 * 권한 없음 → 해당 역할 홈으로 이동(디자인에 별도 403 화면 없음).
 * 미로그인 → 로그인 화면으로 이동.
 */
export default function ProtectedRoute({ roles }: { roles: Role[] }) {
  const { me, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;

  if (!me) {
    return <Navigate to={PATHS.LOGIN} state={{ from: location.pathname }} replace />;
  }

  if (!roles.includes(me.role)) {
    return <Navigate to={ROLE_HOME[me.role]} replace />;
  }

  return <Outlet />;
}
