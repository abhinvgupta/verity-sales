import { useEffect, useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { ObjectionListItem } from '@verity/shared';
import { getObjections, type ObjectionsQuery } from '../api/objections';
import DashboardTabs from '../components/analytics/DashboardTabs';
import ObjectionsFilterBar, {
  type ObjectionFilterState,
} from '../components/objections/ObjectionsFilterBar';
import ObjectionStatusBadge from '../components/objections/ObjectionStatusBadge';
import HandlingBar from '../components/objections/HandlingBar';
import ResolutionPanel from '../components/objections/ResolutionPanel';
import { humanizeObjection } from '../lib/text';

const DAY_MS = 86_400_000;
const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 } as const;
const MIN_CALLS_FOR_DATA = 10;

const ROW_GRID = 'sm:grid-cols-[1.8fr_5rem_7rem_7rem_6.5rem]';

/** Search input debounce, so typing doesn't fire a query per keystroke. */
function useDebounced(value: string, delayMs = 300): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function ObjectionRow({
  item,
  selected,
  onAnalyze,
}: {
  item: ObjectionListItem;
  selected: boolean;
  onAnalyze: () => void;
}) {
  return (
    <li
      className={`grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 transition-colors ${ROW_GRID} ${
        selected ? 'bg-verity-100/40' : 'hover:bg-ink-50/50'
      }`}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-ink-900">
          {humanizeObjection(item.type)}
        </span>
        <span className="mt-1.5 flex items-center gap-2.5">
          <HandlingBar item={item} />
          <span className="text-[11px] text-ink-400">
            in {item.frequencyPct}% of calls
          </span>
        </span>
      </span>
      <span className="hidden font-mono text-sm font-semibold tabular-nums text-ink-900 sm:block">
        {item.totalOccurrences}
      </span>
      <span className="hidden font-mono text-sm font-semibold tabular-nums text-ink-900 sm:block">
        {item.successRate}%
      </span>
      <span className="row-start-1 justify-self-end sm:row-auto sm:justify-self-start">
        <ObjectionStatusBadge status={item.status} />
      </span>
      <span className="col-span-2 sm:col-span-1">
        <button
          type="button"
          onClick={onAnalyze}
          aria-pressed={selected}
          className={`inline-flex items-center rounded-full px-3.5 py-1 text-xs font-semibold transition-colors ${
            selected
              ? 'bg-ink-950 text-white'
              : 'border border-ink-200 bg-white text-ink-700 hover:border-verity-400 hover:text-verity-700'
          }`}
        >
          Analyze
        </button>
      </span>
    </li>
  );
}

export default function ObjectionsPage() {
  const [filters, setFilters] = useState<ObjectionFilterState>({
    range: '30d',
    customFrom: '',
    customTo: '',
    sortBy: 'count',
    search: '',
  });
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const search = useDebounced(filters.search.trim());

  const query: ObjectionsQuery | null = useMemo(() => {
    const base = { sortBy: filters.sortBy, search: search || undefined };
    if (filters.range === 'custom') {
      if (!filters.customFrom || !filters.customTo) return null;
      return {
        ...base,
        startDate: new Date(filters.customFrom).toISOString(),
        endDate: new Date(`${filters.customTo}T23:59:59`).toISOString(),
      };
    }
    const to = new Date();
    const from = new Date(to.getTime() - RANGE_DAYS[filters.range] * DAY_MS);
    return { ...base, startDate: from.toISOString(), endDate: to.toISOString() };
  }, [filters.range, filters.customFrom, filters.customTo, filters.sortBy, search]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['objections', query],
    queryFn: () => getObjections(query!),
    enabled: query !== null,
    placeholderData: keepPreviousData,
  });

  const items = data?.items ?? [];

  return (
    <div className={selectedType ? 'xl:pr-[450px]' : ''}>
      <DashboardTabs />

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">
            Objection Intelligence
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {data
              ? `What prospects push back on, across ${data.totalCallsAnalyzed} analyzed ${
                  data.totalCallsAnalyzed === 1 ? 'call' : 'calls'
                }.`
              : 'What prospects push back on, and what actually overcomes it.'}
          </p>
        </div>
        <ObjectionsFilterBar value={filters} onChange={setFilters} />
      </div>

      {query === null && (
        <p className="rounded-2xl border-2 border-dashed border-ink-200 bg-white/60 px-6 py-12 text-center text-sm text-ink-500">
          Pick both custom dates to load objections.
        </p>
      )}

      {isLoading && (
        <div className="space-y-px overflow-hidden rounded-2xl border border-ink-100 bg-white">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse px-5 py-5">
              <div className="h-4 w-2/3 rounded bg-ink-100" />
            </div>
          ))}
        </div>
      )}

      {isError && <p className="error-note">{(error as Error).message}</p>}

      {data && items.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-ink-200 bg-white/60 px-6 py-16 text-center">
          <p className="font-display text-lg font-semibold text-ink-900">
            {search
              ? `No objections match “${search}”`
              : 'No objection data yet'}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500">
            {search
              ? 'Try a different term, or clear the search.'
              : data.totalCallsAnalyzed < MIN_CALLS_FOR_DATA
                ? "Objections will appear once you've analyzed 10+ calls."
                : 'No objections were detected in calls from this period.'}
          </p>
        </div>
      )}

      {items.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white">
          <div
            className={`hidden gap-x-4 border-b border-ink-100 bg-ink-50/60 px-5 py-2.5 sm:grid ${ROW_GRID}`}
          >
            <span className="label">Objection</span>
            <span className="label">Count</span>
            <span className="label">Success rate</span>
            <span className="label">Status</span>
            <span />
          </div>
          <ul className="divide-y divide-ink-100">
            {items.map((item) => (
              <ObjectionRow
                key={item.type}
                item={item}
                selected={selectedType === item.type}
                onAnalyze={() => setSelectedType(item.type)}
              />
            ))}
          </ul>
        </div>
      )}

      <ResolutionPanel
        type={selectedType}
        onClose={() => setSelectedType(null)}
      />
    </div>
  );
}
