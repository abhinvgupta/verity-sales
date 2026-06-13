import { useQuery } from '@tanstack/react-query';
import { listUsers } from '../../api/users';

export type RangeKey = '7d' | '30d' | '90d' | 'custom';

export interface FilterState {
  range: RangeKey;
  customFrom: string;
  customTo: string;
  repId: string;
}

const RANGES: { key: RangeKey; label: string }[] = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: 'custom', label: 'Custom' },
];

export default function FilterBar({
  value,
  onChange,
}: {
  value: FilterState;
  onChange: (next: FilterState) => void;
}) {
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: listUsers });
  const reps = users?.filter((u) => u.role === 'rep') ?? [];

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        role="group"
        aria-label="Date range"
        className="flex rounded-lg border border-ink-200 bg-white p-0.5"
      >
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => onChange({ ...value, range: r.key })}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              value.range === r.key
                ? 'bg-ink-950 text-white'
                : 'text-ink-500 hover:text-ink-900'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {value.range === 'custom' && (
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="filter-from">
            From date
          </label>
          <input
            id="filter-from"
            type="date"
            value={value.customFrom}
            onChange={(e) => onChange({ ...value, customFrom: e.target.value })}
            className="field w-auto py-1.5 text-xs"
          />
          <span className="text-xs text-ink-400">to</span>
          <label className="sr-only" htmlFor="filter-to">
            To date
          </label>
          <input
            id="filter-to"
            type="date"
            value={value.customTo}
            onChange={(e) => onChange({ ...value, customTo: e.target.value })}
            className="field w-auto py-1.5 text-xs"
          />
        </div>
      )}

      <label className="sr-only" htmlFor="filter-rep">
        Sales rep
      </label>
      <select
        id="filter-rep"
        value={value.repId}
        onChange={(e) => onChange({ ...value, repId: e.target.value })}
        className="field w-auto py-1.5 text-xs"
      >
        <option value="">All reps</option>
        {reps.map((r) => (
          <option key={r._id} value={r._id}>
            {r.name}
          </option>
        ))}
      </select>
    </div>
  );
}
