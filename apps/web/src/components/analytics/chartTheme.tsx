/** Shared visual language for all dashboard charts. */

export const CHART = {
  verity: '#188F69',
  verityLight: '#79C9AC',
  match: '#188F4E',
  partial: '#A8650B',
  mismatch: '#C12F49',
  inkMuted: '#4B6F65',
  grid: '#DCE6E2',
  gridDark: '#24423A',
} as const;

export const tick = {
  fontSize: 10,
  fontFamily: '"Spline Sans Mono", monospace',
  fill: CHART.inkMuted,
} as const;

export const tickDark = { ...tick, fill: '#6E9287' } as const;

/** Dark "record" tooltip used across all charts. */
export function ChartTooltip({
  title,
  rows,
}: {
  title?: string;
  rows: { label: string; value: string }[];
}) {
  return (
    <div className="rounded-lg bg-ink-950 px-3 py-2 shadow-lg ring-1 ring-white/10">
      {title && (
        <p className="mb-1 text-xs font-semibold text-white">{title}</p>
      )}
      {rows.map((r) => (
        <p key={r.label} className="font-mono text-[11px] text-ink-300">
          {r.label} <span className="text-verity-300">{r.value}</span>
        </p>
      ))}
    </div>
  );
}
