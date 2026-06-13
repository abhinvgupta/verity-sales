import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { LeaderboardRow } from '@verity/shared';
import { getLeaderboard, type AnalyticsQuery } from '../../api/analytics';
import ChartCard from './ChartCard';

type SortKey = 'calls' | 'avgScore' | 'avgAlignment' | 'complianceRate';

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'calls', label: 'Calls' },
  { key: 'avgScore', label: 'Avg score' },
  { key: 'avgAlignment', label: 'Alignment' },
  { key: 'complianceRate', label: 'Compliance' },
];

function Trend({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="font-mono text-xs text-ink-300">—</span>;
  }
  const flat = Math.abs(delta) < 0.5;
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-xs font-semibold ${
        flat
          ? 'text-ink-400'
          : delta > 0
            ? 'text-verdict-match'
            : 'text-verdict-mismatch'
      }`}
      title="Avg score, last 7 days vs the 7 before"
    >
      {flat ? '→' : delta > 0 ? '▲' : '▼'} {flat ? '' : Math.abs(delta)}
    </span>
  );
}

export default function Leaderboard({
  query,
  onSelectRep,
}: {
  query: AnalyticsQuery;
  onSelectRep: (repId: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('avgScore');
  const [desc, setDesc] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'leaderboard', query],
    queryFn: () => getLeaderboard(query),
  });

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setDesc((d) => !d);
    else {
      setSortKey(key);
      setDesc(true);
    }
  };

  const rows = [...(data ?? [])].sort((a, b) => {
    const av = a[sortKey] ?? -1;
    const bv = b[sortKey] ?? -1;
    return desc ? bv - av : av - bv;
  });

  const scoreTone = (score: number | null) =>
    score === null
      ? 'text-ink-300'
      : score >= 75
        ? 'text-verdict-match'
        : score >= 50
          ? 'text-ink-900'
          : 'text-verdict-mismatch';

  return (
    <ChartCard
      eyebrow="Who needs coaching?"
      title="Rep leaderboard"
      meta={
        <span className="text-xs text-ink-400">
          Click a rep for their profile
        </span>
      }
      isLoading={isLoading}
      isEmpty={!data || data.length === 0}
      emptyHint="No calls logged for any rep in this period."
    >
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left">
              <th className="label pb-2.5 pr-4 font-semibold">Rep</th>
              {COLUMNS.map((col) => (
                <th key={col.key} className="pb-2.5 pr-4">
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className="label inline-flex items-center gap-1 font-semibold hover:text-ink-900"
                  >
                    {col.label}
                    {sortKey === col.key && (
                      <span aria-hidden>{desc ? '↓' : '↑'}</span>
                    )}
                  </button>
                </th>
              ))}
              <th className="label pb-2.5 font-semibold">7d trend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-50">
            {rows.map((rep: LeaderboardRow, i) => (
              <tr
                key={rep.repId}
                onClick={() => onSelectRep(rep.repId)}
                className="cursor-pointer transition-colors hover:bg-verity-100/30"
              >
                <td className="py-3 pr-4">
                  <span className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-ink-300">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="font-semibold text-ink-900">
                      {rep.repName}
                    </span>
                  </span>
                </td>
                <td className="py-3 pr-4 font-mono text-xs text-ink-600">
                  {rep.calls}
                </td>
                <td
                  className={`py-3 pr-4 font-mono text-xs font-semibold ${scoreTone(rep.avgScore)}`}
                >
                  {rep.avgScore ?? '—'}
                </td>
                <td className="py-3 pr-4 font-mono text-xs text-ink-600">
                  {rep.avgAlignment ?? '—'}
                </td>
                <td className="py-3 pr-4 font-mono text-xs text-ink-600">
                  {rep.complianceRate === null ? '—' : `${rep.complianceRate}%`}
                </td>
                <td className="py-3">
                  <Trend delta={rep.trendDelta} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}
