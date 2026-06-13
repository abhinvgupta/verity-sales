import type { FormField, FormFieldType } from '../lib/formSchema';

const TYPES: FormFieldType[] = ['string', 'number', 'boolean', 'array'];

export default function FormFieldsBuilder({
  fields,
  onChange,
}: {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
}) {
  const update = (index: number, patch: Partial<FormField>) =>
    onChange(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));

  const remove = (index: number) =>
    onChange(fields.filter((_, i) => i !== index));

  const add = () =>
    onChange([...fields, { key: '', type: 'string', required: false }]);

  return (
    <div className="space-y-3">
      {fields.length === 0 && (
        <p className="text-sm text-ink-400">No fields yet.</p>
      )}

      {fields.map((field, i) => (
        <div key={i} className="flex items-center gap-3">
          <input
            placeholder="field_key"
            value={field.key}
            onChange={(e) => update(i, { key: e.target.value })}
            className="field flex-1 font-mono"
          />
          <select
            value={field.type}
            onChange={(e) =>
              update(i, { type: e.target.value as FormFieldType })
            }
            className="field w-32"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-ink-600">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => update(i, { required: e.target.checked })}
            />
            required
          </label>
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-sm text-verdict-mismatch hover:underline"
          >
            Remove
          </button>
        </div>
      ))}

      <button type="button" onClick={add} className="btn-ghost">
        + Add field
      </button>
    </div>
  );
}
