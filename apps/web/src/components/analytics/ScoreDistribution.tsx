import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { getScoreDistribution, type AnalyticsQuery } from '../../api/analytics';
import ChartCard from './ChartCard';
import { CHART, tick, ChartTooltip } from './chartTheme';

export default function ScoreDistribution({
  query,
}: {
  query: AnalyticsQuery;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'score-distribution', query],
    queryFn: () => getScoreDistribution(query),
  });

  const total = data?.reduce((sum, b) => sum + b.count, 0) ?? 0;
  const rows =
    data?.map((b) => ({
      ...b,
      label: b.from === 90 ? '90+' : `${b.from}`,
    })) ?? [];

  return (
    <ChartCard
      eyebrow="Consistent or scattered?"
      title="Score distribution"
      isLoading={isLoading}
      isEmpty={total === 0}
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
          <CartesianGrid
            stroke={CHART.grid}
            strokeDasharray="3 6"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={tick}
            axisLine={false}
            tickLine={false}
          />
          <YAxis tick={tick} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: 'rgba(24,143,105,0.06)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload;
              return (
                <ChartTooltip
                  title={`Score ${p.from}–${p.from === 90 ? 100 : p.from + 9}`}
                  rows={[{ label: 'calls', value: `${p.count}` }]}
                />
              );
            }}
          />
          <Bar dataKey="count" fill={CHART.verityLight} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
