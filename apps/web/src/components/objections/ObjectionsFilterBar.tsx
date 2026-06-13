import type { ObjectionSortBy } from '@verity/shared';

export type ObjectionRangeKey = '7d' | '30d' | '90d' | 'custom';

export interface ObjectionFilterState {
  range: ObjectionRangeKey;
  customFrom: string;
  customTo: string;
  sortBy: ObjectionSortBy;
  search: string;
}

const RANGES: { key: ObjectionRangeKey; label: string }[] = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: 'custom', label: 'Custom' },
];

const SORTS: { key: ObjectionSortBy; label: string }[] = [
  { key: 'count', label: 'By count' },
  { key: 'successRate', label: 'By success rate (low first)' },
  { key: 'priority', label: 'By priority' },
];

export default function ObjectionsFilterBar({
  value,
  onChange,
}: {
  value: ObjectionFilterState;
  onChange: (next: ObjectionFilterState) => void;
}) {
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
          <label className="sr-only" htmlFor="objections-from">
            From date
          </label>
          <input
            id="objections-from"
            type="date"
            value={value.customFrom}
            onChange={(e) => onChange({ ...value, customFrom: e.target.value })}
            className="field w-auto py-1.5 text-xs"
          />
          <span className="text-xs text-ink-400">to</span>
          <label className="sr-only" htmlFor="objections-to">
            To date
          </label>
          <input
            id="objections-to"
            type="date"
            value={value.customTo}
            onChange={(e) => onChange({ ...value, customTo: e.target.value })}
            className="field w-auto py-1.5 text-xs"
          />
        </div>
      )}

      <label className="sr-only" htmlFor="objections-sort">
        Sort objections
      </label>
      <select
        id="objections-sort"
        value={value.sortBy}
        onChange={(e) =>
          onChange({ ...value, sortBy: e.target.value as ObjectionSortBy })
        }
        className="field w-auto py-1.5 text-xs"
      >
        {SORTS.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="objections-search">
        Search objections
      </label>
      <input
        id="objections-search"
        type="search"
        placeholder="Search objections"
        value={value.search}
        onChange={(e) => onChange({ ...value, search: e.target.value })}
        className="field w-44 py-1.5 text-xs"
      />
    </div>
  );
}
