import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listUsers } from '../api/users';
import { createCall } from '../api/calls';
import Waveform from '../components/Waveform';

export default function NewCallPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [repId, setRepId] = useState('');
  const [transcriptText, setTranscriptText] = useState('');

  const { data: users } = useQuery({ queryKey: ['users'], queryFn: listUsers });

  const mutation = useMutation({
    mutationFn: () => createCall(repId, transcriptText),
    onSuccess: (call) => {
      queryClient.invalidateQueries({ queryKey: ['calls'] });
      navigate(`/calls/${call._id}`);
    },
  });

  const wordCount = transcriptText.trim()
    ? transcriptText.trim().split(/\s+/).length
    : 0;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to="/calls"
        className="rounded-md text-sm font-medium text-ink-500 hover:text-ink-900"
      >
        ← All calls
      </Link>

      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink-900">
        Log a call
      </h1>
      <p className="mt-1 text-sm text-ink-500">
        Paste the transcript and Verity starts the analysis as soon as you
        save.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="mt-8 space-y-6 rounded-2xl border border-ink-100 bg-white p-6 sm:p-8"
      >
        <div>
          <label htmlFor="rep" className="label mb-1.5">
            Sales rep
          </label>
          <select
            id="rep"
            required
            value={repId}
            onChange={(e) => setRepId(e.target.value)}
            className="field"
          >
            <option value="" disabled>
              Select the rep on this call…
            </option>
            {users?.map((u) => (
              <option key={u._id} value={u._id}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
          {users && users.length === 0 && (
            <p className="mt-1.5 text-xs text-verdict-partial">
              No users yet — add reps on the Team page first.
            </p>
          )}
        </div>

        <div>
          <span className="label mb-1.5">Transcript</span>
          {/* The transcript is the record — it gets the dark surface. */}
          <div className="overflow-hidden rounded-xl bg-ink-950 focus-within:ring-2 focus-within:ring-verity-500 focus-within:ring-offset-2">
            <div className="flex items-center justify-between gap-4 border-b border-ink-800 px-4 py-2.5">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">
                The record
              </span>
              <Waveform
                seed={transcriptText || 'silence'}
                bars={16}
                className="h-3.5 text-verity-400/80"
              />
            </div>
            <textarea
              required
              rows={14}
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              placeholder="Paste the call transcript here…"
              aria-label="Transcript"
              className="block w-full resize-y bg-transparent px-4 py-3 font-mono text-[13px] leading-relaxed text-ink-100 placeholder:text-ink-500 focus:outline-none"
            />
          </div>
          <p className="mt-1.5 text-xs text-ink-400">
            {wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'}
          </p>
        </div>

        {mutation.isError && (
          <p className="error-note">{(mutation.error as Error).message}</p>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="btn-primary"
        >
          {mutation.isPending ? 'Saving…' : 'Save & analyze'}
        </button>
      </form>
    </div>
  );
}
