import { useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CallStatus, ComparisonFinding } from '@verity/shared';
import { getCall, getAnalysis, getComparison } from '../api/calls';
import { getForm, uploadForm } from '../api/forms';
import StatusBadge from '../components/StatusBadge';
import RecordView from '../components/RecordView';
import Waveform from '../components/Waveform';
import PipelineRail from '../components/PipelineRail';

const IN_PROGRESS: CallStatus[] = [
  'queued',
  'analyzing',
  'form_pending',
  'comparing',
];

const shortId = (id: string) => `REC-${id.slice(-6).toUpperCase()}`;

const formatDate = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** Drops the given keys from a record before display. */
function omit(
  data: Record<string, unknown>,
  ...keys: string[]
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).filter(([key]) => !keys.includes(key)),
  );
}

type SectionTone = 'done' | 'pending' | 'error';

const MARKER: Record<SectionTone, string> = {
  done: 'bg-verity-500',
  pending: 'bg-ink-200',
  error: 'bg-verdict-mismatch',
};

/** A stage of the pipeline, hung off the vertical spine. */
function Section({
  eyebrow,
  title,
  tone,
  aside,
  children,
}: {
  eyebrow: string;
  title: string;
  tone: SectionTone;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="relative rounded-2xl border border-ink-100 bg-white p-6 sm:p-8">
      <span
        aria-hidden
        className={`absolute -left-[26px] top-9 h-[11px] w-[11px] rounded-full border-2 border-porcelain sm:-left-[34px] ${MARKER[tone]}`}
      />
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">
            {eyebrow}
          </p>
          <h2 className="mt-0.5 font-display text-xl font-bold tracking-tight text-ink-900">
            {title}
          </h2>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function ScoreMeter({ label, value }: { label: string; value: number }) {
  const color =
    value >= 80 ? '#188F4E' : value >= 50 ? '#A8650B' : '#C12F49';
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between">
        <span className="label">{label}</span>
        <span className="font-display text-2xl font-bold text-ink-900">
          {value}
          <span className="text-sm font-semibold text-ink-400">/100</span>
        </span>
      </div>
      <div
        role="meter"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100"
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${clamped}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function CallDetailPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const callQuery = useQuery({
    queryKey: ['call', id],
    queryFn: () => getCall(id),
    refetchInterval: (query) =>
      query.state.data && IN_PROGRESS.includes(query.state.data.status)
        ? 3000
        : false,
  });

  const status = callQuery.data?.status;
  const polling = status ? IN_PROGRESS.includes(status) : false;
  const refetchInterval = polling ? 3000 : false;

  const analysisQuery = useQuery({
    queryKey: ['analysis', id],
    queryFn: () => getAnalysis(id),
    refetchInterval,
  });

  const formQuery = useQuery({
    queryKey: ['form', id],
    queryFn: () => getForm(id),
    refetchInterval,
  });

  const comparisonQuery = useQuery({
    queryKey: ['comparison', id],
    queryFn: () => getComparison(id),
    refetchInterval,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadForm(id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form', id] });
      queryClient.invalidateQueries({ queryKey: ['call', id] });
    },
  });

  if (callQuery.isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-44 rounded-2xl bg-ink-100" />
        <div className="h-32 rounded-2xl bg-ink-100/60" />
      </div>
    );
  }
  if (callQuery.isError) {
    return <p className="error-note">{(callQuery.error as Error).message}</p>;
  }

  const call = callQuery.data!;
  const analysis = analysisQuery.data;
  const form = formQuery.data;
  const comparison = comparisonQuery.data;

  const analysisTone: SectionTone =
    analysis?.analysisStatus === 'success'
      ? 'done'
      : analysis
        ? 'error'
        : 'pending';
  const formTone: SectionTone =
    form?.extractionStatus === 'success'
      ? 'done'
      : form && form.extractionStatus !== 'pending'
        ? 'error'
        : 'pending';
  const comparisonTone: SectionTone =
    comparison?.comparisonStatus === 'success'
      ? 'done'
      : comparison
        ? 'error'
        : 'pending';

  return (
    <div>
      <Link
        to="/calls"
        className="rounded-md text-sm font-medium text-ink-500 hover:text-ink-900"
      >
        ← All calls
      </Link>

      {/* The record band */}
      <section className="mt-3 overflow-hidden rounded-2xl bg-ink-950 text-white">
        <div className="px-6 pt-6 sm:px-8 sm:pt-7">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">
            Call record
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-xl font-medium text-white">
              {shortId(call._id)}
            </h1>
            <StatusBadge status={call.status} onDark />
            {polling && (
              <span className="flex items-center gap-1.5 text-xs text-verity-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-verity-400" />
                listening for updates
              </span>
            )}
          </div>
          <time
            dateTime={call.createdAt}
            className="mt-1 block text-xs text-ink-400"
          >
            Logged {formatDate.format(new Date(call.createdAt))}
          </time>
          <Waveform
            seed={call._id}
            bars={56}
            animate={polling}
            className="mt-6 h-10 text-verity-400/70"
          />
        </div>
        <PipelineRail
          status={call.status}
          className="border-t border-ink-800 px-6 py-4 sm:px-8"
        />
      </section>

      {call.failureReason && (
        <p className="error-note mt-4">{call.failureReason}</p>
      )}

      {/* Pipeline spine */}
      <div className="relative mt-8 space-y-6 pl-5 sm:pl-7">
        <span
          aria-hidden
          className="absolute bottom-10 left-[4px] top-4 w-px bg-ink-200 sm:left-[6px]"
        />

        <Section
          eyebrow="What Verity heard"
          title="Analysis"
          tone={analysisTone}
          aside={
            analysis && <StatusBadge status={analysis.analysisStatus} />
          }
        >
          {!analysis && (
            <p className="text-sm text-ink-500">
              {polling
                ? 'Verity is reading the transcript…'
                : 'No analysis available.'}
            </p>
          )}
          {analysis && analysis.analysisStatus !== 'success' && (
            <p className="text-sm text-verdict-mismatch">
              Analysis {analysis.analysisStatus.replace(/_/g, ' ')}. The raw
              output was kept for review.
            </p>
          )}
          {analysis?.analysisStatus === 'success' && analysis.parsedOutput && (
            <>
              {typeof analysis.score === 'number' && (
                <ScoreMeter label="Call score" value={analysis.score} />
              )}
              <RecordView data={omit(analysis.parsedOutput, 'whatWasDone')} />
            </>
          )}
        </Section>

        <Section
          eyebrow="What the rep filed"
          title="Rep form"
          tone={formTone}
          aside={form && <StatusBadge status={form.extractionStatus} />}
        >
          {!form && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const file = fileRef.current?.files?.[0];
                if (file) uploadMutation.mutate(file);
              }}
              className="space-y-4"
            >
              <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-ink-200 bg-porcelain/60 px-6 py-8 text-center transition-colors hover:border-verity-400 focus-within:border-verity-400">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  required
                  className="sr-only"
                  onChange={(e) =>
                    setFileName(e.target.files?.[0]?.name ?? null)
                  }
                />
                <span className="text-sm font-semibold text-ink-700">
                  {fileName ?? "Choose the scanned form image"}
                </span>
                <span className="text-xs text-ink-400">
                  A photo or scan of the rep&apos;s filled form — Verity reads
                  it for you
                </span>
              </label>
              {uploadMutation.isError && (
                <p className="error-note">
                  {(uploadMutation.error as Error).message}
                </p>
              )}
              <button
                type="submit"
                disabled={uploadMutation.isPending}
                className="btn-primary"
              >
                {uploadMutation.isPending ? 'Uploading…' : 'Upload form'}
              </button>
            </form>
          )}
          {form &&
            (form.datapoints ? (
              <RecordView data={form.datapoints} />
            ) : (
              <p className="text-sm text-ink-500">
                {polling
                  ? 'Reading the form…'
                  : 'No data could be read from the form.'}
              </p>
            ))}
        </Section>

        <Section
          eyebrow="Where the stories meet"
          title="Comparison"
          tone={comparisonTone}
          aside={
            comparison && <StatusBadge status={comparison.comparisonStatus} />
          }
        >
          {!comparison && (
            <p className="text-sm text-ink-500">
              {polling
                ? 'Checking the form against the transcript…'
                : 'No comparison yet — upload the rep form first.'}
            </p>
          )}
          {comparison && comparison.comparisonStatus !== 'success' && (
            <p className="text-sm text-verdict-mismatch">
              Comparison {comparison.comparisonStatus.replace(/_/g, ' ')}. The
              raw output was kept for review.
            </p>
          )}
          {comparison?.comparisonStatus === 'success' && (
            <>
              {typeof comparison.alignmentScore === 'number' && (
                <ScoreMeter
                  label="Alignment"
                  value={comparison.alignmentScore}
                />
              )}
              <VerdictLedger findings={comparison.findings} />
            </>
          )}
        </Section>
      </div>
    </div>
  );
}

const VERDICT: Record<
  string,
  { glyph: string; label: string; text: string; chip: string }
> = {
  match: {
    glyph: '=',
    label: 'match',
    text: 'text-verdict-match',
    chip: 'bg-verdict-match/10 text-verdict-match',
  },
  partial: {
    glyph: '≈',
    label: 'partial',
    text: 'text-verdict-partial',
    chip: 'bg-verdict-partial/10 text-verdict-partial',
  },
  mismatch: {
    glyph: '≠',
    label: 'mismatch',
    text: 'text-verdict-mismatch',
    chip: 'bg-verdict-mismatch/10 text-verdict-mismatch',
  },
};

function humanize(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

function asText(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * The verdict ledger: each finding confronts the rep's claim (light, the
 * reading) with what the transcript shows (dark, the record), joined by a
 * verdict glyph.
 */
function VerdictLedger({ findings }: { findings: ComparisonFinding[] }) {
  if (findings.length === 0) {
    return <p className="text-sm text-ink-500">No findings to report.</p>;
  }

  return (
    <ul className="space-y-3">
      {findings.map((f, i) => {
        const verdict = VERDICT[f.status] ?? VERDICT.partial;
        return (
          <li
            key={i}
            className="overflow-hidden rounded-xl border border-ink-100"
          >
            <div className="flex items-center justify-between gap-3 border-b border-ink-100 bg-porcelain/70 px-4 py-2">
              <span className="text-xs font-semibold text-ink-700">
                {humanize(f.field)}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${verdict.chip}`}
              >
                <span aria-hidden className="font-display">
                  {verdict.glyph}
                </span>
                {verdict.label}
              </span>
            </div>
            <div className="grid sm:grid-cols-[1fr_3rem_1fr]">
              <div className="px-4 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-400">
                  Rep claimed
                </p>
                <p className="mt-1 text-sm text-ink-800">
                  {asText(f.repValue)}
                </p>
              </div>
              <div
                aria-hidden
                className={`hidden items-center justify-center font-display text-2xl font-bold sm:flex ${verdict.text}`}
              >
                {verdict.glyph}
              </div>
              <div className="bg-ink-950 px-4 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-400">
                  Transcript shows
                </p>
                <p className="mt-1 font-mono text-[13px] leading-relaxed text-ink-100">
                  {asText(f.transcriptValue)}
                </p>
              </div>
            </div>
            {f.note && (
              <p className="border-t border-ink-100 px-4 py-2 text-xs leading-relaxed text-ink-500">
                {f.note}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
