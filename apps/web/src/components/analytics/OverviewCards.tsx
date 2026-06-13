import { useQuery } from '@tanstack/react-query';
import { getOverview, type AnalyticsQuery } from '../../api/analytics';

function Stat({
  label,
  value,
  suffix,
  delta,
}: {
  label: string;
  value: string;
  suffix?: string;
  delta?: number | null;
}) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5">
      <p className="label">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-3xl font-bold tracking-tight text-ink-900">
          {value}
        </span>
        {suffix && (
          <span className="text-sm font-semibold text-ink-400">{suffix}</span>
        )}
        {delta !== undefined && delta !== null && delta !== 0 && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
              delta > 0
                ? 'bg-verdict-match/10 text-verdict-match'
                : 'bg-verdict-mismatch/10 text-verdict-mismatch'
            }`}
            title="vs the previous equivalent period"
          >
            {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}
          </span>
        )}
      </div>
    </div>
  );
}

export default function OverviewCards({ query }: { query: AnalyticsQuery }) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'overview', query],
    queryFn: () => getOverview(query),
  });

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl border border-ink-100 bg-white"
          />
        ))}
      </div>
    );
  }

  const fmt = (n: number | null, dash = '—') => (n === null ? dash : `${n}`);

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <Stat label="Calls" value={`${data.totalCalls}`} />
      <Stat label="Analyzed" value={`${data.analyzedCalls}`} />
      <Stat
        label="Avg score"
        value={fmt(data.avgScore)}
        suffix="/100"
        delta={data.scoreDelta}
      />
      <Stat
        label="Compliance pass"
        value={fmt(data.complianceRate)}
        suffix={data.complianceRate === null ? undefined : '%'}
      />
      <Stat
        label="Avg alignment"
        value={fmt(data.avgAlignment)}
        suffix="/100"
      />
    </div>
  );
}
