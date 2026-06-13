import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from 'recharts';
import { getRepRadar, type AnalyticsQuery } from '../../api/analytics';
import { CHART } from './chartTheme';

/** Slide-over rep profile, opened from the leaderboard. */
export default function RepRadarPanel({
  repId,
  query,
  onClose,
}: {
  repId: string | null;
  query: AnalyticsQuery;
  onClose: () => void;
}) {
  const open = repId !== null;

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'rep-radar', repId, query],
    queryFn: () => getRepRadar(repId!, query),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-ink-950/40 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Rep profile"
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-2xl transition-transform duration-300 motion-reduce:transition-none ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-start justify-between border-b border-ink-100 px-6 py-5">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">
              Rep profile
            </p>
            <h2 className="mt-0.5 font-display text-xl font-bold tracking-tight text-ink-900">
              {data?.repName ?? '…'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close rep profile"
            className="rounded-lg border border-ink-200 px-2.5 py-1 text-sm text-ink-500 hover:border-ink-300 hover:text-ink-900"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {isLoading && (
            <div className="h-72 animate-pulse rounded-xl bg-ink-50" />
          )}

          {data && (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart
                  data={data.dimensions}
                  outerRadius="65%"
                  margin={{ top: 4, right: 36, bottom: 4, left: 36 }}
                >
                  <PolarGrid stroke={CHART.grid} />
                  <PolarAngleAxis
                    dataKey="label"
                    tick={{
                      fontSize: 11,
                      fontFamily: '"Spline Sans Mono", monospace',
                      fill: CHART.inkMuted,
                    }}
                  />
                  <Radar
                    dataKey="value"
                    stroke={CHART.verity}
                    fill={CHART.verity}
                    fillOpacity={0.22}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>

              <dl className="mt-4 space-y-2.5 border-t border-ink-100 pt-5">
                {data.dimensions.map((d) => (
                  <div
                    key={d.label}
                    className="flex items-center justify-between gap-4"
                  >
                    <dt className="label">{d.label}</dt>
                    <dd className="flex flex-1 items-center justify-end gap-3">
                      <div className="h-1.5 w-28 rounded-full bg-ink-50">
                        <div
                          className="h-full rounded-full bg-verity-500"
                          style={{ width: `${d.value}%` }}
                        />
                      </div>
                      <span className="w-8 text-right font-mono text-xs font-semibold text-ink-900">
                        {d.value}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>

              <p className="mt-5 text-xs leading-relaxed text-ink-400">
                All dimensions are normalized to 0–100. Volume is relative to
                the busiest rep in this period; trend centers at 50, above
                means improving.
              </p>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
