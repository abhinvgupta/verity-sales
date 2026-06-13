/**
 * Renders an arbitrary key/value object (LLM parsedOutput or form datapoints)
 * in a readable, schema-agnostic way: scalars as text, arrays of objects as
 * cards, primitive arrays as comma lists.
 */
function humanize(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

function Value({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-ink-300">—</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-ink-300">none</span>;
    const allObjects = value.every(
      (v) => typeof v === 'object' && v !== null && !Array.isArray(v),
    );
    if (allObjects) {
      return (
        <ul className="space-y-2">
          {value.map((item, i) => (
            <li
              key={i}
              className="rounded-lg border border-ink-100 bg-porcelain/70 p-3"
            >
              <RecordView data={item as Record<string, unknown>} compact />
            </li>
          ))}
        </ul>
      );
    }
    return <span>{value.map((v) => String(v)).join(', ')}</span>;
  }
  if (typeof value === 'object') {
    return <RecordView data={value as Record<string, unknown>} compact />;
  }
  return <span>{String(value)}</span>;
}

export default function RecordView({
  data,
  compact = false,
}: {
  data: Record<string, unknown>;
  compact?: boolean;
}) {
  const entries = Object.entries(data);
  if (entries.length === 0) {
    return <p className="text-sm text-ink-300">No data.</p>;
  }
  return (
    <dl className={compact ? 'space-y-1.5' : 'space-y-4'}>
      {entries.map(([key, value]) => (
        <div key={key}>
          <dt
            className={
              compact
                ? 'label'
                : 'block text-[13px] font-bold uppercase tracking-[0.12em] text-ink-700'
            }
          >
            {humanize(key)}
          </dt>
          <dd className="mt-1 text-sm leading-relaxed text-ink-800">
            <Value value={value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
