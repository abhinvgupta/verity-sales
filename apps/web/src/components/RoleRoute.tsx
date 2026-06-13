import { Navigate, Outlet } from 'react-router-dom';
import type { UserRole } from '@verity/shared';
import { useAuthStore } from '../store/auth';

/** Restricts nested routes to the given roles; others are sent to /calls. */
export default function RoleRoute({ allow }: { allow: UserRole[] }) {
  const user = useAuthStore((s) => s.user);
  if (!user || !allow.includes(user.role)) {
    return <Navigate to="/calls" replace />;
  }
  return <Outlet />;
}
