import { useMemo, useState } from 'react';
import FilterBar, {
  type FilterState,
} from '../components/analytics/FilterBar';
import DashboardTabs from '../components/analytics/DashboardTabs';
import OverviewCards from '../components/analytics/OverviewCards';
import ScoreTrendChart from '../components/analytics/ScoreTrendChart';
import ScoreDistribution from '../components/analytics/ScoreDistribution';
import AlignmentScatter from '../components/analytics/AlignmentScatter';
import ComplianceDonut from '../components/analytics/ComplianceDonut';
import TopIssues from '../components/analytics/TopIssues';
import Leaderboard from '../components/analytics/Leaderboard';
import RepRadarPanel from '../components/analytics/RepRadarPanel';
import type { AnalyticsQuery } from '../api/analytics';

const DAY_MS = 86_400_000;
const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 } as const;

export default function DashboardPage() {
  const [filters, setFilters] = useState<FilterState>({
    range: '30d',
    customFrom: '',
    customTo: '',
    repId: '',
  });
  const [selectedRep, setSelectedRep] = useState<string | null>(null);

  const query: AnalyticsQuery | null = useMemo(() => {
    const repId = filters.repId || undefined;
    if (filters.range === 'custom') {
      if (!filters.customFrom || !filters.customTo) return null;
      return {
        from: new Date(filters.customFrom).toISOString(),
        to: new Date(`${filters.customTo}T23:59:59`).toISOString(),
        repId,
      };
    }
    const to = new Date();
    const from = new Date(to.getTime() - RANGE_DAYS[filters.range] * DAY_MS);
    return { from: from.toISOString(), to: to.toISOString(), repId };
  }, [filters]);

  return (
    <div>
      <DashboardTabs />

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            What the calls say, and how honestly they were reported.
          </p>
        </div>
        <FilterBar value={filters} onChange={setFilters} />
      </div>

      {!query && (
        <p className="rounded-2xl border-2 border-dashed border-ink-200 bg-white/60 px-6 py-12 text-center text-sm text-ink-500">
          Pick both custom dates to load the dashboard.
        </p>
      )}

      {query && (
        <div className="space-y-4">
          <OverviewCards query={query} />

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ScoreTrendChart query={query} />
            </div>
            <ScoreDistribution query={query} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <AlignmentScatter query={query} />
            </div>
            <ComplianceDonut query={query} />
          </div>

          <Leaderboard query={query} onSelectRep={setSelectedRep} />

          <TopIssues query={query} />

          <RepRadarPanel
            repId={selectedRep}
            query={query}
            onClose={() => setSelectedRep(null)}
          />
        </div>
      )}
    </div>
  );
}
