export const QUEUES = {
  ANALYZE_CALL: 'analyze-call',
  EXTRACT_FORM: 'extract-form',
  COMPARE_CALL: 'compare-call',
} as const;

/**
 * Per-queue BullMQ worker tuning. `concurrency` is per worker *process* (how
 * many jobs one worker runs at once); `limiter` is enforced in Redis and so
 * caps throughput across *all* workers on that queue — this is the guard
 * against OpenAI 429s and runaway spend.
 *
 * NOTE: the limiter is per queue, so the worst-case aggregate OpenAI call rate
 * is the sum across all three queues. Keep the combined `max` under your
 * OpenAI tier's requests-per-`duration` budget, and re-tune when that tier
 * changes. Values here are conservative defaults for a low/mid tier.
 */
export const WORKER_TUNING = {
  ANALYZE_CALL: { concurrency: 5, limiter: { max: 10, duration: 1000 } },
  COMPARE_CALL: { concurrency: 5, limiter: { max: 10, duration: 1000 } },
  EXTRACT_FORM: { concurrency: 5, limiter: { max: 10, duration: 1000 } },
} as const;

export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  COMPANY_ADMIN: 'company_admin',
  MANAGER: 'manager',
  REP: 'rep',
} as const;

export const CALL_STATUS = {
  UPLOADED: 'uploaded',
  QUEUED: 'queued',
  ANALYZING: 'analyzing',
  ANALYZED: 'analyzed',
  FORM_PENDING: 'form_pending',
  COMPARING: 'comparing',
  COMPLETE: 'complete',
  FAILED: 'failed',
} as const;

export const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;
