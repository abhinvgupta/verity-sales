type Tone = {
  /** chip classes on light surfaces */
  light: string;
  /** chip classes on dark (ink) surfaces */
  dark: string;
  dot: string;
  /** machine is actively working — pulse the dot */
  live?: boolean;
};

const NEUTRAL: Tone = {
  light: 'bg-ink-100 text-ink-600',
  dark: 'bg-white/10 text-ink-200',
  dot: 'bg-ink-400',
};

const WORKING: Tone = {
  light: 'bg-verity-100 text-verity-700',
  dark: 'bg-verity-400/15 text-verity-300',
  dot: 'bg-verity-500',
  live: true,
};

const WAITING: Tone = {
  light: 'bg-verdict-partial/10 text-verdict-partial',
  dark: 'bg-verdict-partial/20 text-amber-300',
  dot: 'bg-verdict-partial',
};

const DONE: Tone = {
  light: 'bg-verdict-match/10 text-verdict-match',
  dark: 'bg-verdict-match/20 text-verity-300',
  dot: 'bg-verdict-match',
};

const ERROR: Tone = {
  light: 'bg-verdict-mismatch/10 text-verdict-mismatch',
  dark: 'bg-verdict-mismatch/20 text-rose-300',
  dot: 'bg-verdict-mismatch',
};

const TONES: Record<string, Tone> = {
  // call statuses
  uploaded: NEUTRAL,
  queued: WORKING,
  analyzing: WORKING,
  analyzed: { ...WORKING, live: false },
  form_pending: WAITING,
  comparing: WORKING,
  complete: DONE,
  failed: ERROR,
  // analysis / extraction / comparison statuses
  pending: WAITING,
  success: DONE,
  validation_failed: ERROR,
  llm_error: ERROR,
};

export default function StatusBadge({
  status,
  onDark = false,
}: {
  status: string;
  onDark?: boolean;
}) {
  const tone = TONES[status] ?? NEUTRAL;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
        onDark ? tone.dark : tone.light
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${tone.dot} ${
          tone.live ? 'animate-pulse' : ''
        }`}
      />
      {status.replace(/_/g, ' ')}
    </span>
  );
}
