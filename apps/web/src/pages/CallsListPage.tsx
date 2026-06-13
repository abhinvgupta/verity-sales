import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listCalls, retryAnalysis } from '../api/calls';
import StatusBadge from '../components/StatusBadge';
import Waveform from '../components/Waveform';

const shortId = (id: string) => `REC-${id.slice(-6).toUpperCase()}`;

/** Re-runs analysis for a failed call. Sits outside the row's link so the
 *  click triggers the retry rather than navigation. */
function RetryAnalysisButton({ callId }: { callId: string }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => retryAnalysis(callId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calls'] });
    },
  });

  return (
    <button
      type="button"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      title={
        mutation.isError ? (mutation.error as Error).message : 'Re-run analysis'
      }
      className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-semibold text-ink-700 transition-colors hover:border-verity-400 hover:text-verity-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {mutation.isPending ? 'Retrying…' : 'Retry analysis'}
    </button>
  );
}

const formatDateTime = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const formatDate = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });

/** Relative time for calls under a week old, plain date beyond that. */
function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate.format(new Date(iso));
}

const SEGMENTS = 10;

/** Rising segment meter for the call score. Thresholds match ScoreMeter on
 *  the call detail page (>=80 good, >=50 partial, <50 poor). */
function ScoreGauge({ score }: { score?: number | null }) {
  const hasScore = typeof score === 'number';
  const clamped = hasScore ? Math.max(0, Math.min(100, score)) : 0;
  const filled = hasScore
    ? Math.max(1, Math.round((clamped / 100) * SEGMENTS))
    : 0;
  const tone =
    clamped >= 80
      ? 'bg-verdict-match'
      : clamped >= 50
        ? 'bg-verdict-partial'
        : 'bg-verdict-mismatch';
  const numeral = !hasScore
    ? 'text-ink-300'
    : clamped >= 80
      ? 'text-verdict-match'
      : clamped >= 50
        ? 'text-verdict-partial'
        : 'text-verdict-mismatch';

  return (
    <span
      role="meter"
      aria-label="Call score"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={hasScore ? Math.round(clamped) : undefined}
      aria-valuetext={hasScore ? `${Math.round(clamped)} out of 100` : 'pending'}
      className="flex items-center gap-2"
    >
      <span className="flex items-end gap-[3px]" aria-hidden>
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span
            key={i}
            className={`w-[3px] rounded-full ${i < filled ? tone : 'bg-ink-100'}`}
            style={{ height: `${7 + i}px` }}
          />
        ))}
      </span>
      <span
        className={`w-7 text-right font-mono text-sm font-semibold tabular-nums ${numeral}`}
      >
        {hasScore ? Math.round(clamped) : '—'}
      </span>
    </span>
  );
}

const ROW_GRID = 'sm:grid-cols-[1.6fr_1fr_1fr_8rem_2.5rem]';

export default function CallsListPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['calls'],
    queryFn: () => listCalls(),
  });

  const calls = data?.data ?? [];

  return (
    <div className="relative isolate">
      {/* Soft malachite fade under the header so the top of the page isn't flat white. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-8 left-1/2 -z-10 h-48 w-screen -translate-x-1/2 bg-gradient-to-b from-verity-100/70 to-transparent sm:-top-10"
      />

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">
            Calls
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {data
              ? `${calls.length} ${calls.length === 1 ? 'call' : 'calls'} on record`
              : 'Every transcript, analyzed and checked.'}
          </p>
        </div>
        <Link to="/calls/new" className="btn-primary">
          New call
        </Link>
      </div>

      {isLoading && (
        <div className="space-y-px overflow-hidden rounded-2xl border border-ink-100 bg-white">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse px-5 py-5">
              <div className="h-4 w-2/3 rounded bg-ink-100" />
            </div>
          ))}
        </div>
      )}

      {isError && (
        <p className="error-note">{(error as Error).message}</p>
      )}

      {data && calls.length === 0 && (
        <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-ink-200 bg-white px-6 py-16 text-center">
          <Waveform seed="first-call" bars={20} className="h-8 text-ink-200" />
          <p className="mt-5 font-display text-lg font-semibold text-ink-900">
            No calls on record yet
          </p>
          <p className="mt-1 max-w-xs text-sm text-ink-500">
            Paste a transcript and Verity will start the first analysis.
          </p>
          <Link to="/calls/new" className="btn-primary mt-6">
            Log the first call
          </Link>
        </div>
      )}

      {calls.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white">
          <div
            className={`hidden gap-x-4 border-b border-ink-100 bg-ink-50/60 px-5 py-2.5 sm:grid ${ROW_GRID}`}
          >
            <span className="label">Call</span>
            <span className="label">Status</span>
            <span className="label">Logged</span>
            <span className="label">Score</span>
            <span />
          </div>
          <ul className="divide-y divide-ink-100">
            {calls.map((call) => (
              <li key={call._id} className="relative">
                {call.status === 'failed' && (
                  <div className="absolute right-4 top-1/2 z-10 -translate-y-1/2 sm:right-14">
                    <RetryAnalysisButton callId={call._id} />
                  </div>
                )}
                <Link
                  to={`/calls/${call._id}`}
                  className={`group relative grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 px-5 py-3.5 transition-colors hover:bg-verity-100/30 ${ROW_GRID}`}
                >
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-0.5 scale-y-0 bg-verity-500 transition-transform group-hover:scale-y-100 motion-reduce:transition-none"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink-900">
                      {call.repName ?? 'Unassigned rep'}
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] tracking-wide text-ink-400">
                      {shortId(call._id)}
                    </span>
                    {call.status === 'failed' && call.failureReason && (
                      <span className="mt-1 block truncate text-xs text-verdict-mismatch">
                        {call.failureReason}
                      </span>
                    )}
                  </span>
                  <span className="row-start-1 justify-self-end sm:row-auto sm:col-start-4 sm:justify-self-start">
                    {call.status === 'failed' ? (
                      // The retry button overlays this slot on failed rows.
                      <span className="hidden sm:block" />
                    ) : (
                      <ScoreGauge score={call.score} />
                    )}
                  </span>
                  <span className="col-start-1 sm:col-start-2 sm:row-start-1">
                    <StatusBadge status={call.status} />
                  </span>
                  <time
                    dateTime={call.createdAt}
                    title={formatDateTime.format(new Date(call.createdAt))}
                    className="justify-self-end text-xs text-ink-500 sm:col-start-3 sm:row-start-1 sm:justify-self-start sm:text-sm"
                  >
                    {timeAgo(call.createdAt)}
                  </time>
                  <span
                    aria-hidden
                    className="hidden text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-verity-600 sm:col-start-5 sm:row-start-1 sm:block"
                  >
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
