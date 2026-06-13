import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { getCompliance, type AnalyticsQuery } from '../../api/analytics';
import ChartCard from './ChartCard';
import { CHART, ChartTooltip } from './chartTheme';

export default function ComplianceDonut({ query }: { query: AnalyticsQuery }) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'compliance', query],
    queryFn: () => getCompliance(query),
  });

  const total = (data?.passed ?? 0) + (data?.failed ?? 0);
  const passRate = total > 0 ? Math.round(((data?.passed ?? 0) / total) * 100) : 0;
  const slices = [
    { name: 'Passed', value: data?.passed ?? 0, color: CHART.verity },
    { name: 'Flagged', value: data?.failed ?? 0, color: CHART.mismatch },
  ];

  return (
    <ChartCard
      eyebrow="Regulatory & policy"
      title="Compliance"
      isLoading={isLoading}
      isEmpty={total === 0}
    >
      <div className="relative mx-auto h-44 w-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0];
                return (
                  <ChartTooltip
                    rows={[{ label: String(p.name), value: `${p.value} calls` }]}
                  />
                );
              }}
            />
            <Pie
              data={slices}
              dataKey="value"
              innerRadius="72%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              strokeWidth={0}
              paddingAngle={2}
            >
              {slices.map((s) => (
                <Cell key={s.name} fill={s.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-3xl font-bold text-ink-900">
            {passRate}%
          </span>
          <span className="label">pass</span>
        </div>
      </div>

      {data && data.topIssues.length > 0 && (
        <ul className="mt-5 space-y-2 border-t border-ink-100 pt-4">
          {data.topIssues.map((issue) => (
            <li
              key={issue.value}
              className="flex items-baseline justify-between gap-3 text-sm"
            >
              <span className="text-ink-700">{issue.value}</span>
              <span className="shrink-0 font-mono text-xs font-semibold text-verdict-mismatch">
                ×{issue.count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  );
}
