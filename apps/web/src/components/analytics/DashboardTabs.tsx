import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';

/**
 * Tab strip shared by the dashboard pages. Reps only get Objection
 * Intelligence — the overview dashboard is manager/admin territory.
 */
export default function DashboardTabs() {
  const role = useAuthStore((s) => s.user?.role);
  const tabs = [
    ...(role === 'rep' ? [] : [{ to: '/dashboard', label: 'Overview' }]),
    { to: '/dashboard/objections', label: 'Objection Intelligence' },
  ];

  const tabClass = ({ isActive }: { isActive: boolean }) =>
    `-mb-px border-b-2 px-1 pb-2.5 text-sm font-semibold transition-colors ${
      isActive
        ? 'border-verity-600 text-ink-900'
        : 'border-transparent text-ink-400 hover:text-ink-700'
    }`;

  return (
    <nav
      aria-label="Dashboard sections"
      className="mb-6 flex gap-6 border-b border-ink-100"
    >
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end className={tabClass}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
