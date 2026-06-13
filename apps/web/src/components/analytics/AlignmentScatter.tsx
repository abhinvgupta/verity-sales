import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ReferenceLine,
  ReferenceArea,
  Tooltip,
  Cell,
} from 'recharts';
import type { ScatterPoint } from '@verity/shared';
import { getAlignmentScatter, type AnalyticsQuery } from '../../api/analytics';
import ChartCard from './ChartCard';
import { CHART, tickDark, ChartTooltip } from './chartTheme';

const fmtDate = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
});

/**
 * Quadrants (x = call quality, y = reporting honesty):
 *   top-right    — good calls, honest reporting (where you want everyone)
 *   bottom-right — good calls but the form doesn't match the transcript
 *   top-left     — honest about weak calls: coachable
 *   bottom-left  — weak calls and unreliable reporting
 */
function pointColor(p: ScatterPoint): string {
  if (p.score >= 50 && p.alignment >= 50) return CHART.verityLight;
  if (p.score >= 50) return CHART.mismatch;
  if (p.alignment >= 50) return '#D9A036';
  return '#6E9287';
}

const QUADRANT_LABELS = [
  { text: 'honest · needs coaching', pos: 'left-14 top-3' },
  { text: 'strong · honest', pos: 'right-4 top-3' },
  { text: 'needs attention', pos: 'left-14 bottom-12' },
  { text: 'strong call · misreported', pos: 'right-4 bottom-12' },
];

export default function AlignmentScatter({
  query,
}: {
  query: AnalyticsQuery;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'alignment-scatter', query],
    queryFn: () => getAlignmentScatter(query),
  });

  return (
    <ChartCard
      dark
      eyebrow="Call quality × reporting honesty"
      title="The truth grid"
      meta={
        data && (
          <span className="rounded-full bg-white/10 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide text-ink-300">
            {data.length} calls{data.length === 200 ? ' (latest)' : ''}
          </span>
        )
      }
      isLoading={isLoading}
      isEmpty={!data || data.length === 0}
      emptyHint="Calls need both an analysis and a compared rep form to land here."
    >
      <div className="relative">
        {QUADRANT_LABELS.map((q) => (
          <span
            key={q.text}
            aria-hidden
            className={`pointer-events-none absolute z-10 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500 ${q.pos}`}
          >
            {q.text}
          </span>
        ))}
        <ResponsiveContainer width="100%" height={340}>
          <ScatterChart margin={{ top: 12, right: 12, bottom: 4, left: -16 }}>
            <ReferenceArea
              x1={50}
              x2={100}
              y1={50}
              y2={100}
              fill={CHART.verity}
              fillOpacity={0.07}
            />
            <XAxis
              type="number"
              dataKey="score"
              name="Call score"
              domain={[0, 100]}
              tick={tickDark}
              axisLine={{ stroke: CHART.gridDark }}
              tickLine={false}
            />
            <YAxis
              type="number"
              dataKey="alignment"
              name="Alignment"
              domain={[0, 100]}
              tick={tickDark}
              axisLine={{ stroke: CHART.gridDark }}
              tickLine={false}
            />
            <ReferenceLine
              x={50}
              stroke={CHART.verityLight}
              strokeOpacity={0.3}
              strokeDasharray="4 4"
            />
            <ReferenceLine
              y={50}
              stroke={CHART.verityLight}
              strokeOpacity={0.3}
              strokeDasharray="4 4"
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3', stroke: '#4B6F65' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as ScatterPoint;
                return (
                  <ChartTooltip
                    title={p.repName}
                    rows={[
                      { label: 'score', value: `${p.score}` },
                      { label: 'alignment', value: `${p.alignment}` },
                      { label: 'date', value: fmtDate.format(new Date(p.date)) },
                    ]}
                  />
                );
              }}
            />
            <Scatter data={data ?? []} fillOpacity={0.85}>
              {(data ?? []).map((p) => (
                <Cell key={p.callId} fill={pointColor(p)} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
