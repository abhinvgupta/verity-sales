import type { ObjectionListItem } from '@verity/shared';

const SEGMENTS: {
  key: keyof Pick<
    ObjectionListItem,
    'successfulCount' | 'partialCount' | 'unsuccessfulCount' | 'ignoredCount'
  >;
  label: string;
  className: string;
}[] = [
  { key: 'successfulCount', label: 'successful', className: 'bg-verdict-match' },
  { key: 'partialCount', label: 'partial', className: 'bg-verdict-partial' },
  {
    key: 'unsuccessfulCount',
    label: 'unsuccessful',
    className: 'bg-verdict-mismatch',
  },
  { key: 'ignoredCount', label: 'ignored', className: 'bg-ink-200' },
];

/**
 * Stacked distribution of how an objection was handled across calls, in the
 * dashboard's verdict colors. Reads left to right from won to ignored.
 */
export default function HandlingBar({ item }: { item: ObjectionListItem }) {
  const total = item.totalOccurrences || 1;
  const title = SEGMENTS.map((s) => `${item[s.key]} ${s.label}`).join(' · ');
  return (
    <div
      role="img"
      aria-label={`Handling: ${title}`}
      title={title}
      className="flex h-1.5 w-full max-w-[9rem] overflow-hidden rounded-full bg-ink-50"
    >
      {SEGMENTS.map((s) =>
        item[s.key] > 0 ? (
          <span
            key={s.key}
            className={s.className}
            style={{ width: `${(item[s.key] / total) * 100}%` }}
          />
        ) : null,
      )}
    </div>
  );
}
