/**
 * Shared frame for dashboard charts: mono eyebrow + display title, its own
 * skeleton while loading, and a consistent empty state. `dark` renders the
 * "record" treatment (used by the signature alignment chart).
 */
export default function ChartCard({
  eyebrow,
  title,
  meta,
  isLoading,
  isEmpty,
  emptyHint = 'No analyzed calls in this period.',
  dark = false,
  className = '',
  children,
}: {
  eyebrow: string;
  title: string;
  meta?: React.ReactNode;
  isLoading: boolean;
  isEmpty: boolean;
  emptyHint?: string;
  dark?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl p-6 ${
        dark
          ? 'bg-ink-950 text-white'
          : 'border border-ink-100 bg-white'
      } ${className}`}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className={`font-mono text-[11px] uppercase tracking-[0.16em] ${
              dark ? 'text-ink-400' : 'text-ink-400'
            }`}
          >
            {eyebrow}
          </p>
          <h2
            className={`mt-0.5 font-display text-lg font-bold tracking-tight ${
              dark ? 'text-white' : 'text-ink-900'
            }`}
          >
            {title}
          </h2>
        </div>
        {meta}
      </div>

      {isLoading && (
        <div
          className={`h-64 animate-pulse rounded-xl ${
            dark ? 'bg-white/5' : 'bg-ink-50'
          }`}
        />
      )}

      {!isLoading && isEmpty && (
        <div
          className={`flex h-64 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-center ${
            dark ? 'border-ink-800' : 'border-ink-100'
          }`}
        >
          <p
            className={`text-sm font-semibold ${
              dark ? 'text-ink-300' : 'text-ink-600'
            }`}
          >
            Nothing to chart yet
          </p>
          <p className={`text-xs ${dark ? 'text-ink-500' : 'text-ink-400'}`}>
            {emptyHint}
          </p>
        </div>
      )}

      {!isLoading && !isEmpty && children}
    </section>
  );
}
