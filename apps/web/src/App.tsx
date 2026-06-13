import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import RoleRoute from './components/RoleRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import CallsListPage from './pages/CallsListPage';
import NewCallPage from './pages/NewCallPage';
import CallDetailPage from './pages/CallDetailPage';
import TeamPage from './pages/TeamPage';
import ObjectionsPage from './pages/ObjectionsPage';

// Code-split: the dashboard pulls in Recharts, which dominates the bundle.
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
import TemplatePage from './pages/TemplatePage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/calls" replace />} />
          <Route path="/calls" element={<CallsListPage />} />
          <Route path="/calls/new" element={<NewCallPage />} />
          <Route path="/calls/:id" element={<CallDetailPage />} />

          <Route
            element={
              <RoleRoute allow={['manager', 'company_admin', 'super_admin']} />
            }
          >
            <Route
              path="/dashboard"
              element={
                <Suspense
                  fallback={
                    <div className="h-64 animate-pulse rounded-2xl bg-ink-100/60" />
                  }
                >
                  <DashboardPage />
                </Suspense>
              }
            />
          </Route>

          {/* Reps get the objection playbooks too — the list is scoped to
              their own calls server-side. */}
          <Route path="/dashboard/objections" element={<ObjectionsPage />} />

          <Route element={<RoleRoute allow={['company_admin', 'super_admin']} />}>
            <Route path="/team" element={<TeamPage />} />
            <Route path="/template" element={<TemplatePage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
