import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getActiveTemplate,
  createTemplate,
  activateTemplate,
} from '../api/templates';
import FormFieldsBuilder from '../components/FormFieldsBuilder';
import {
  fieldsToFormSchema,
  formSchemaToFields,
  type FormField,
} from '../lib/formSchema';

const DEFAULT_OUTPUT_SCHEMA = `{
  "type": "object",
  "required": ["summary", "score"],
  "properties": {
    "summary": { "type": "string" },
    "score": { "type": "number" }
  }
}`;

export default function TemplatePage() {
  const queryClient = useQueryClient();
  const { data: active, isLoading } = useQuery({
    queryKey: ['template', 'active'],
    queryFn: getActiveTemplate,
  });

  const [prompt, setPrompt] = useState('');
  const [outputSchemaText, setOutputSchemaText] = useState(DEFAULT_OUTPUT_SCHEMA);
  const [fields, setFields] = useState<FormField[]>([]);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Seed the editors from the active template once it loads.
  useEffect(() => {
    if (initialized) return;
    if (active) {
      setPrompt(active.callAnalysisPrompt);
      setOutputSchemaText(JSON.stringify(active.outputSchema, null, 2));
      setFields(formSchemaToFields(active.formSchema));
    }
    setInitialized(true);
  }, [active, initialized]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      let outputSchema: Record<string, unknown>;
      try {
        outputSchema = JSON.parse(outputSchemaText);
      } catch {
        throw new Error('Output schema is not valid JSON');
      }
      const created = await createTemplate({
        callAnalysisPrompt: prompt,
        outputSchema,
        formSchema: fieldsToFormSchema(fields),
      });
      await activateTemplate(created._id);
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template', 'active'] });
    },
  });

  const handleSave = () => {
    setJsonError(null);
    try {
      JSON.parse(outputSchemaText);
    } catch {
      setJsonError('Output schema is not valid JSON');
      return;
    }
    saveMutation.mutate();
  };

  if (isLoading) return <p className="text-ink-500">Loading…</p>;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink-900">
          Evaluation template
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {active
            ? 'Editing creates a new version and activates it.'
            : 'No active template yet — configure one below.'}
        </p>
      </div>

      {/* Prompt */}
      <section className="rounded-xl border border-ink-100 bg-white p-6">
        <h2 className="mb-1 font-display text-lg font-semibold text-ink-900">
          Analysis prompt
        </h2>
        <p className="mb-4 text-sm text-ink-500">
          Use <code className="font-mono">{'{{transcript}}'}</code> and{' '}
          <code className="font-mono">{'{{schema}}'}</code> placeholders.
        </p>
        <textarea
          rows={10}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="field font-mono"
        />
      </section>

      {/* Output schema */}
      <section className="rounded-xl border border-ink-100 bg-white p-6">
        <h2 className="mb-1 font-display text-lg font-semibold text-ink-900">
          Analysis output (JSON schema)
        </h2>
        <p className="mb-4 text-sm text-ink-500">
          The structured shape the model must return.
        </p>
        <textarea
          rows={12}
          value={outputSchemaText}
          onChange={(e) => setOutputSchemaText(e.target.value)}
          className="field font-mono"
        />
        {jsonError && <p className="error-note mt-3">{jsonError}</p>}
      </section>

      {/* Form fields */}
      <section className="rounded-xl border border-ink-100 bg-white p-6">
        <h2 className="mb-1 font-display text-lg font-semibold text-ink-900">
          Rep form fields
        </h2>
        <p className="mb-4 text-sm text-ink-500">
          Factual fields extracted from the uploaded form and reconciled against
          the transcript.
        </p>
        <FormFieldsBuilder fields={fields} onChange={setFields} />
      </section>

      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="btn-primary"
        >
          {saveMutation.isPending ? 'Saving…' : 'Save & activate'}
        </button>
        {saveMutation.isSuccess && (
          <span className="text-sm text-verdict-match">Saved.</span>
        )}
        {saveMutation.isError && (
          <span className="text-sm text-verdict-mismatch">
            {(saveMutation.error as Error).message}
          </span>
        )}
      </div>
    </div>
  );
}
