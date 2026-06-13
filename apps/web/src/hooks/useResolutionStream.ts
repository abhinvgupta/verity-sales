import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ObjectionResolutionInsufficient,
  ObjectionResolutionPath,
} from '@verity/shared';
import {
  streamResolutionPath,
  type PartialResolutionPath,
  type ResolutionStage,
} from '../api/objections';

export type ResolutionState =
  | { phase: 'idle' }
  | {
      phase: 'streaming';
      stage: ResolutionStage;
      partial: PartialResolutionPath;
    }
  | { phase: 'complete'; path: ObjectionResolutionPath }
  | { phase: 'insufficient'; info: ObjectionResolutionInsufficient }
  | { phase: 'error'; message: string };

/**
 * Drives the resolution-path panel for one objection type. Starts a request
 * whenever `type` changes, exposes `regenerate` (force a fresh synthesis —
 * manager/admin only server-side) and `retry` (re-request, cache allowed),
 * and aborts any in-flight stream on unmount or type switch (which cancels
 * the backend's LLM call).
 */
export function useResolutionStream(type: string | null): {
  state: ResolutionState;
  regenerate: () => void;
  retry: () => void;
} {
  const [state, setState] = useState<ResolutionState>({ phase: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback((objectionType: string, regenerate: boolean) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ phase: 'streaming', stage: 'sampling', partial: {} });

    void streamResolutionPath(
      objectionType,
      {
        onStage: (stage) =>
          setState((prev) =>
            prev.phase === 'streaming' ? { ...prev, stage } : prev,
          ),
        onPartial: (partial) =>
          setState((prev) =>
            prev.phase === 'streaming'
              ? { ...prev, stage: 'generating', partial }
              : prev,
          ),
        onComplete: (path) => setState({ phase: 'complete', path }),
        onInsufficient: (info) => setState({ phase: 'insufficient', info }),
        onError: (message) => setState({ phase: 'error', message }),
      },
      { regenerate, signal: controller.signal },
    );
  }, []);

  useEffect(() => {
    if (!type) {
      setState({ phase: 'idle' });
      return;
    }
    start(type, false);
    return () => abortRef.current?.abort();
  }, [type, start]);

  const regenerate = useCallback(() => {
    if (type) start(type, true);
  }, [type, start]);

  const retry = useCallback(() => {
    if (type) start(type, false);
  }, [type, start]);

  return { state, regenerate, retry };
}
