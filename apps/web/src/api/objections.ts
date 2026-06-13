import type {
  ObjectionList,
  ObjectionResolutionInsufficient,
  ObjectionResolutionPath,
  ObjectionSortBy,
} from '@verity/shared';
import { apiClient } from './client';
import { useAuthStore } from '../store/auth';

export interface ObjectionsQuery {
  startDate: string;
  endDate: string;
  sortBy: ObjectionSortBy;
  search?: string;
}

export async function getObjections(
  query: ObjectionsQuery,
): Promise<ObjectionList> {
  const params = new URLSearchParams({
    startDate: query.startDate,
    endDate: query.endDate,
    sortBy: query.sortBy,
  });
  if (query.search) params.set('search', query.search);
  const res = await apiClient.get<{ data: ObjectionList }>(
    `/analytics/objections?${params.toString()}`,
  );
  return res.data.data;
}

export type ResolutionStage = 'sampling' | 'analyzing' | 'generating';

/** Sections of the path that may be ready before the stream finishes. */
export type PartialResolutionPath = Partial<
  Pick<ObjectionResolutionPath, 'winningPatterns' | 'losingPatterns' | 'playbook'>
>;

export interface ResolutionStreamHandlers {
  onStage: (stage: ResolutionStage) => void;
  /** Called as streamed JSON becomes parseable — sections fill in over time. */
  onPartial: (partial: PartialResolutionPath) => void;
  onComplete: (path: ObjectionResolutionPath) => void;
  onInsufficient: (info: ObjectionResolutionInsufficient) => void;
  onError: (message: string) => void;
}

/**
 * Best-effort parse of an incomplete JSON document: closes any open string
 * and brackets, then trims back to the last comma/bracket until it parses.
 * Returns null when nothing parseable exists yet.
 */
export function tryParsePartialJson(text: string): unknown {
  const start = text.indexOf('{');
  if (start === -1) return null;

  const repair = (input: string): unknown => {
    const stack: string[] = [];
    let inString = false;
    let escaped = false;
    for (const ch of input) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = inString;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === '{' || ch === '[') stack.push(ch === '{' ? '}' : ']');
      else if (ch === '}' || ch === ']') stack.pop();
    }
    const closed =
      input + (inString ? '"' : '') + stack.reverse().join('');
    try {
      return JSON.parse(closed);
    } catch {
      return null;
    }
  };

  let candidate = text.slice(start);
  for (let i = 0; i < 8; i++) {
    const parsed = repair(candidate);
    if (parsed !== null) return parsed;
    // Drop the trailing incomplete token (dangling key, half a number…).
    const cut = Math.max(
      candidate.lastIndexOf(','),
      candidate.lastIndexOf('{'),
      candidate.lastIndexOf('['),
    );
    if (cut <= 0) return null;
    candidate = candidate.slice(0, cut);
  }
  return null;
}

function extractPartial(accumulated: string): PartialResolutionPath | null {
  const parsed = tryParsePartialJson(accumulated);
  if (parsed === null || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  const partial: PartialResolutionPath = {};
  if (Array.isArray(obj.winningPatterns)) {
    partial.winningPatterns =
      obj.winningPatterns as ObjectionResolutionPath['winningPatterns'];
  }
  if (Array.isArray(obj.losingPatterns)) {
    partial.losingPatterns =
      obj.losingPatterns as ObjectionResolutionPath['losingPatterns'];
  }
  if (obj.playbook && typeof obj.playbook === 'object') {
    partial.playbook = obj.playbook as ObjectionResolutionPath['playbook'];
  }
  return partial;
}

const GENERIC_ERROR =
  "Couldn't generate the playbook right now. Try again or contact support.";

/**
 * Fetches the resolution path for an objection type. Cached paths come back
 * as one JSON response (handled via onComplete); cache misses stream over
 * SSE with stage + partial updates. Abort `signal` to cancel — the backend
 * cancels its LLM call when the connection drops.
 */
export async function streamResolutionPath(
  type: string,
  handlers: ResolutionStreamHandlers,
  options: { regenerate?: boolean; signal: AbortSignal },
): Promise<void> {
  const { token } = useAuthStore.getState();
  const search = options.regenerate ? '?regenerate=true' : '';
  let response: Response;
  try {
    response = await fetch(
      `/api/analytics/objections/${encodeURIComponent(type)}/resolution-path${search}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: options.signal,
      },
    );
  } catch {
    if (!options.signal.aborted) handlers.onError(GENERIC_ERROR);
    return;
  }

  if (!response.ok) {
    handlers.onError(GENERIC_ERROR);
    return;
  }

  // Cache hit — a plain JSON envelope, no stream.
  if (response.headers.get('content-type')?.includes('application/json')) {
    const body = (await response.json()) as {
      data: ObjectionResolutionPath;
    };
    handlers.onComplete(body.data);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    handlers.onError(GENERIC_ERROR);
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';
  // Tracks whether a terminal event arrived, so a dropped connection
  // doesn't leave the caller waiting forever.
  let finished = false;

  const handleEvent = (block: string) => {
    let event = 'message';
    let data = '';
    for (const line of block.split('\n')) {
      if (line.startsWith('event: ')) event = line.slice(7).trim();
      else if (line.startsWith('data: ')) data += line.slice(6);
    }
    if (!data) return;
    const payload = JSON.parse(data) as Record<string, unknown>;

    switch (event) {
      case 'status':
        handlers.onStage(payload.stage as ResolutionStage);
        break;
      case 'delta': {
        accumulated += payload.text as string;
        const partial = extractPartial(accumulated);
        if (partial) handlers.onPartial(partial);
        break;
      }
      case 'complete':
        finished = true;
        handlers.onComplete(payload as unknown as ObjectionResolutionPath);
        break;
      case 'insufficient_data':
        finished = true;
        handlers.onInsufficient(
          payload as unknown as ObjectionResolutionInsufficient,
        );
        break;
      case 'error':
        finished = true;
        handlers.onError((payload.message as string) ?? GENERIC_ERROR);
        break;
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        if (block.trim()) handleEvent(block);
      }
    }
    // Stream ended without complete/insufficient/error — connection dropped.
    if (!finished && !options.signal.aborted) handlers.onError(GENERIC_ERROR);
  } catch {
    if (!options.signal.aborted) handlers.onError(GENERIC_ERROR);
  }
}
