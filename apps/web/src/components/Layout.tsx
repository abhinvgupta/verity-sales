import { Outlet, Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import Waveform from './Waveform';

export default function Layout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const isAdmin = user?.role === 'company_admin' || user?.role === 'super_admin';

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-md text-sm font-medium transition-colors ${
      isActive ? 'text-white' : 'text-ink-300 hover:text-white'
    }`;

  return (
    <div className="min-h-screen bg-porcelain">
      <header className="bg-ink-950 text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5 rounded-md">
              <Waveform seed="verity" bars={5} className="h-4 text-verity-400" />
              <span className="font-display text-lg font-bold tracking-tight">
                Verity
              </span>
            </Link>
            <nav className="flex items-center gap-5">
              <NavLink to="/calls" className={navClass}>
                Calls
              </NavLink>
              {(isAdmin || user?.role === 'manager') && (
                <NavLink to="/dashboard" className={navClass}>
                  Dashboard
                </NavLink>
              )}
              {user?.role === 'rep' && (
                <NavLink to="/dashboard/objections" className={navClass}>
                  Objections
                </NavLink>
              )}
              {isAdmin && (
                <>
                  <NavLink to="/team" className={navClass}>
                    Team
                  </NavLink>
                  <NavLink to="/template" className={navClass}>
                    Template
                  </NavLink>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 text-sm text-ink-200 sm:flex">
              {user?.email}
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-200">
                {user?.role?.replace(/_/g, ' ')}
              </span>
            </span>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-ink-700 px-3 py-1.5 text-sm font-medium text-ink-200 transition-colors hover:border-ink-500 hover:text-white"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <Outlet />
      </main>
    </div>
  );
}
