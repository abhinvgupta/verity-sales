import type { CallStatus } from '@verity/shared';

/**
 * Horizontal stage tracker for the call pipeline, rendered on the dark
 * record band. The pipeline is a real sequence (record → analysis → form →
 * comparison), so position carries information.
 */
const STAGES = ['Recorded', 'Analyzed', 'Form received', 'Compared'] as const;

/** `working` = a job is actually running; the active dot only pulses then.
 *  Statuses waiting on a human (uploaded, analyzed) render settled. */
function progress(status: CallStatus): {
  done: number;
  failed: boolean;
  working: boolean;
} {
  switch (status) {
    case 'uploaded':
      return { done: 1, failed: false, working: false };
    case 'queued':
    case 'analyzing':
      return { done: 1, failed: false, working: true };
    case 'analyzed':
      return { done: 2, failed: false, working: false };
    case 'form_pending':
      return { done: 2, failed: false, working: true };
    case 'comparing':
      return { done: 3, failed: false, working: true };
    case 'complete':
      return { done: 4, failed: false, working: false };
    case 'failed':
      return { done: 1, failed: true, working: false };
  }
}

export default function PipelineRail({
  status,
  className = '',
}: {
  status: CallStatus;
  className?: string;
}) {
  const { done, failed, working } = progress(status);

  return (
    <ol className={`flex items-center gap-2 sm:gap-3 ${className}`}>
      {STAGES.map((stage, i) => {
        const isDone = i < done;
        const isActive = !failed && i === done && done < STAGES.length;
        const isFailedHere = failed && i === done;
        return (
          <li key={stage} className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <span
              aria-hidden
              className={`h-2 w-2 shrink-0 rounded-full ${
                isFailedHere
                  ? 'bg-verdict-mismatch'
                  : isDone
                    ? 'bg-verity-400'
                    : isActive && working
                      ? 'animate-pulse bg-verity-400/70 ring-2 ring-verity-400/30'
                      : isActive
                        ? 'bg-verity-400/40 ring-2 ring-verity-400/20'
                        : 'bg-ink-600'
              }`}
            />
            <span
              className={`truncate text-[11px] font-medium uppercase tracking-wide ${
                isFailedHere
                  ? 'text-rose-300'
                  : isDone
                    ? 'text-ink-100'
                    : isActive
                      ? 'text-verity-300'
                      : 'text-ink-500'
              }`}
            >
              {isFailedHere ? 'Failed' : stage}
            </span>
            {i < STAGES.length - 1 && (
              <span
                aria-hidden
                className={`h-px flex-1 ${isDone && i + 1 < done ? 'bg-verity-400/40' : 'bg-ink-700'}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
