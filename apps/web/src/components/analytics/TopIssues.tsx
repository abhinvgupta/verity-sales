import { useQuery } from '@tanstack/react-query';
import type { IssueCount } from '@verity/shared';
import { getTopIssues, type AnalyticsQuery } from '../../api/analytics';
import ChartCard from './ChartCard';

/**
 * Issue values are free-form sentences, so each bar gets a full-width label
 * with a proportional meter underneath — long text stays readable where a
 * conventional y-axis would clip it.
 */
function IssueBars({
  items,
  color,
}: {
  items: IssueCount[];
  color: string;
}) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.value}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[13px] leading-snug text-ink-800">
              {item.value}
            </span>
            <span className="shrink-0 font-mono text-xs font-semibold text-ink-500">
              {item.count}
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-ink-50">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(item.count / max) * 100}%`,
                backgroundColor: color,
              }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

const PANELS = [
  {
    key: 'goodPoints' as const,
    eyebrow: 'Keep doing this',
    title: 'What went well',
    color: '#188F69',
  },
  {
    key: 'improvementPoints' as const,
    eyebrow: 'Coach on this',
    title: 'Improvement areas',
    color: '#A8650B',
  },
  {
    key: 'redFlags' as const,
    eyebrow: 'Deal & relationship risk',
    title: 'Red flags',
    color: '#C12F49',
  },
];

export default function TopIssues({ query }: { query: AnalyticsQuery }) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'top-issues', query],
    queryFn: () => getTopIssues(query),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {PANELS.map((panel) => (
        <ChartCard
          key={panel.key}
          eyebrow={panel.eyebrow}
          title={panel.title}
          isLoading={isLoading}
          isEmpty={!data || data[panel.key].length === 0}
          emptyHint="Nothing recurring found in this period."
        >
          <IssueBars items={data?.[panel.key] ?? []} color={panel.color} />
        </ChartCard>
      ))}
    </div>
  );
}
