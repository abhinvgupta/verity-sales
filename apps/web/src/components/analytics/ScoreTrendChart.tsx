import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { getScoreTrend, type AnalyticsQuery } from '../../api/analytics';
import ChartCard from './ChartCard';
import { CHART, tick, ChartTooltip } from './chartTheme';

const monthDay = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
});
const monthOnly = new Intl.DateTimeFormat('en', {
  month: 'short',
  year: '2-digit',
});

export default function ScoreTrendChart({ query }: { query: AnalyticsQuery }) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'score-trend', query],
    queryFn: () => getScoreTrend(query),
  });

  const fmtPeriod = (iso: string) =>
    data?.unit === 'month'
      ? monthOnly.format(new Date(iso))
      : monthDay.format(new Date(iso));

  return (
    <ChartCard
      eyebrow="Is the team improving?"
      title="Score trend"
      meta={
        data && (
          <span className="rounded-full bg-ink-50 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide text-ink-500">
            by {data.unit}
          </span>
        )
      }
      isLoading={isLoading}
      isEmpty={!data || data.points.length === 0}
    >
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart
          data={data?.points ?? []}
          margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
        >
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.verity} stopOpacity={0.18} />
              <stop offset="100%" stopColor={CHART.verity} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke={CHART.grid}
            strokeDasharray="3 6"
            vertical={false}
          />
          <XAxis
            dataKey="period"
            tickFormatter={fmtPeriod}
            tick={tick}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={tick}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload;
              return (
                <ChartTooltip
                  title={fmtPeriod(p.period)}
                  rows={[
                    { label: 'avg score', value: `${p.avgScore}` },
                    { label: 'calls', value: `${p.calls}` },
                  ]}
                />
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="avgScore"
            stroke={CHART.verity}
            strokeWidth={2}
            fill="url(#trendFill)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
