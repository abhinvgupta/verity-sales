import type { ObjectionStatus } from '@verity/shared';

/** Same verdict color tokens as the rest of the dashboard. */
const TONES: Record<ObjectionStatus, { chip: string; dot: string }> = {
  priority: {
    chip: 'bg-verdict-mismatch/10 text-verdict-mismatch',
    dot: 'bg-verdict-mismatch',
  },
  watch: {
    chip: 'bg-verdict-partial/10 text-verdict-partial',
    dot: 'bg-verdict-partial',
  },
  strong: {
    chip: 'bg-verdict-match/10 text-verdict-match',
    dot: 'bg-verdict-match',
  },
};

export default function ObjectionStatusBadge({
  status,
}: {
  status: ObjectionStatus;
}) {
  const tone = TONES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${tone.chip}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {status}
    </span>
  );
}
