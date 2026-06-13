import { useEffect, useState } from 'react';
import type {
  ObjectionResolutionPath,
  PlaybookContent,
  ResolutionPattern,
} from '@verity/shared';
import { useResolutionStream } from '../../hooks/useResolutionStream';
import type { PartialResolutionPath } from '../../api/objections';
import { humanizeObjection } from '../../lib/text';
import { useAuthStore } from '../../store/auth';

const STAGE_LABELS = {
  sampling: 'Pulling call samples…',
  analyzing: 'Analyzing patterns…',
  generating: 'Generating playbook…',
} as const;

const formatDate = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function PatternColumn({
  title,
  patterns,
  skeleton,
}: {
  title: string;
  patterns?: ResolutionPattern[];
  skeleton: boolean;
}) {
  return (
    <div>
      <h3 className="label">{title}</h3>
      {patterns && patterns.length > 0 ? (
        <ul className="mt-3 space-y-3">
          {patterns.map((p, i) => (
            <li key={i}>
              <p className="text-sm font-semibold text-ink-900">{p.pattern}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-500">
                {p.description}
              </p>
            </li>
          ))}
        </ul>
      ) : skeleton ? (
        <div className="mt-3 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse space-y-1.5">
              <div className="h-3.5 w-3/4 rounded bg-ink-100" />
              <div className="h-3 w-full rounded bg-ink-50" />
              <div className="h-3 w-5/6 rounded bg-ink-50" />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ScriptCard({
  playbook,
  skeleton,
}: {
  playbook?: PlaybookContent;
  skeleton: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const script = playbook?.suggestedScript;

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  if (!script && !skeleton) return null;

  return (
    <section className="mt-6 rounded-2xl bg-ink-950 p-5 text-white">
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">
          Suggested script
        </p>
        {script && (
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(script);
              setCopied(true);
            }}
            className="rounded-md border border-ink-700 px-2.5 py-1 text-xs font-semibold text-ink-200 transition-colors hover:border-ink-500 hover:text-white"
          >
            {copied ? 'Copied' : 'Copy script'}
          </button>
        )}
      </div>
      {script ? (
        <p className="mt-3 text-sm leading-relaxed text-ink-100">“{script}”</p>
      ) : (
        <div className="mt-3 animate-pulse space-y-2">
          <div className="h-3 w-full rounded bg-white/10" />
          <div className="h-3 w-11/12 rounded bg-white/10" />
          <div className="h-3 w-2/3 rounded bg-white/10" />
        </div>
      )}
    </section>
  );
}

function DoDontLists({ playbook }: { playbook?: PlaybookContent }) {
  if (!playbook?.do?.length && !playbook?.dont?.length) return null;
  return (
    <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
      {playbook.do?.length > 0 && (
        <div>
          <h3 className="label">Do</h3>
          <ul className="mt-2.5 space-y-1.5">
            {playbook.do.map((item, i) => (
              <li key={i} className="flex gap-2 text-xs leading-relaxed text-ink-700">
                <span aria-hidden className="mt-px text-verdict-match">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
      {playbook.dont?.length > 0 && (
        <div>
          <h3 className="label">Don't</h3>
          <ul className="mt-2.5 space-y-1.5">
            {playbook.dont.map((item, i) => (
              <li key={i} className="flex gap-2 text-xs leading-relaxed text-ink-700">
                <span aria-hidden className="mt-px text-verdict-mismatch">✕</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PathBody({
  partial,
  skeleton,
}: {
  partial: PartialResolutionPath | ObjectionResolutionPath;
  skeleton: boolean;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <PatternColumn
          title="What works ✅"
          patterns={partial.winningPatterns}
          skeleton={skeleton}
        />
        <PatternColumn
          title="What doesn't ❌"
          patterns={partial.losingPatterns}
          skeleton={skeleton}
        />
      </div>
      <DoDontLists playbook={partial.playbook} />
      <ScriptCard playbook={partial.playbook} skeleton={skeleton} />
    </>
  );
}

/**
 * Resolution-path side panel (~450px). No backdrop — the objection list stays
 * interactive so managers can switch rows without closing it first.
 */
export default function ResolutionPanel({
  type,
  onClose,
}: {
  type: string | null;
  onClose: () => void;
}) {
  const open = type !== null;
  const { state, regenerate, retry } = useResolutionStream(type);
  // Regeneration is a paid LLM call — the server rejects it for reps.
  const canRegenerate = useAuthStore((s) => s.user?.role) !== 'rep';

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const path = state.phase === 'complete' ? state.path : null;

  return (
    <aside
      role="dialog"
      aria-label="Objection resolution path"
      className={`fixed inset-y-0 right-0 z-40 flex w-full max-w-[450px] flex-col border-l border-ink-100 bg-white shadow-2xl transition-transform duration-300 motion-reduce:transition-none ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-ink-100 px-6 py-5">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">
            Resolution path
          </p>
          <h2 className="mt-0.5 truncate font-display text-xl font-bold tracking-tight text-ink-900">
            {type ? humanizeObjection(type) : '…'}
          </h2>
          {path && (
            <p className="mt-1 text-xs text-ink-400">
              {path.sampleCounts.successful + path.sampleCounts.unsuccessful}{' '}
              call samples · Last updated{' '}
              {formatDate.format(new Date(path.lastUpdated))}
              {canRegenerate && (
                <>
                  {' · '}
                  <button
                    type="button"
                    onClick={regenerate}
                    className="font-semibold text-verity-600 hover:text-verity-700"
                  >
                    Regenerate
                  </button>
                </>
              )}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close resolution path"
          className="rounded-lg border border-ink-200 px-2.5 py-1 text-sm text-ink-500 hover:border-ink-300 hover:text-ink-900"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {state.phase === 'streaming' && (
          <>
            <p
              role="status"
              className="mb-5 flex items-center gap-2 text-xs font-semibold text-verity-600"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-verity-500" />
              {STAGE_LABELS[state.stage]}
            </p>
            <PathBody partial={state.partial} skeleton />
          </>
        )}

        {path && <PathBody partial={path} skeleton={false} />}

        {state.phase === 'insufficient' && (
          <div className="rounded-xl border-2 border-dashed border-ink-100 px-5 py-10 text-center">
            <p className="text-sm font-semibold text-ink-700">
              Not enough examples yet
            </p>
            <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-ink-500">
              Need 5+ successful and 5+ unsuccessful examples. Currently:{' '}
              {state.info.successfulCount} successful,{' '}
              {state.info.unsuccessfulCount} unsuccessful.
            </p>
          </div>
        )}

        {state.phase === 'error' && (
          <div className="space-y-3">
            <p className="error-note">{state.message}</p>
            <button type="button" onClick={retry} className="btn-ghost">
              Try again
            </button>
          </div>
        )}
      </div>

      <p className="border-t border-ink-100 px-6 py-3 text-center text-[11px] text-ink-400">
        Generated from your team's call data
      </p>
    </aside>
  );
}
