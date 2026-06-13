import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { ObjectionResolutionPath } from '@verity/shared';

const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * A cached resolution path is invalidated once this many new analyses
 * containing the objection type land after the cache write.
 */
const INVALIDATION_THRESHOLD = 50;

/** Generous upper bound on one LLM synthesis, so a crashed generation
 *  can't hold the lock for long. */
const GENERATION_LOCK_TTL_SECONDS = 120;

/**
 * Redis cache for LLM-synthesized objection resolution paths.
 *
 * Every method is best-effort: a Redis outage degrades to cache-miss
 * behavior and must never fail the caller (in particular, never fail a
 * BullMQ analysis job that already succeeded).
 *
 * Keys:
 * - objection_resolution:{companyId}:{type}:{weekKey} — the cached path (7d TTL)
 * - objection_resolution_count:{companyId}:{type}     — countdown to invalidation
 * - objection_resolution_lock:{companyId}:{type}      — in-flight generation lock
 */
@Injectable()
export class ObjectionCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(ObjectionCacheService.name);
  private readonly redis: Redis;

  constructor(configService: ConfigService) {
    this.redis = new Redis({
      host: configService.getOrThrow<string>('REDIS_HOST'),
      port: Number(configService.getOrThrow<string>('REDIS_PORT')),
      // Fail fast while disconnected instead of queueing commands forever —
      // callers treat errors as cache misses, they must not hang on Redis.
      enableOfflineQueue: false,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  /** ISO week key, e.g. "2026-W24" — rotates the cache weekly by design. */
  private weekKey(date = new Date()): string {
    const d = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    // Shift to the Thursday of this week — ISO weeks belong to the year of
    // their Thursday.
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
  }

  private pathKey(companyId: string, type: string): string {
    return `objection_resolution:${companyId}:${type}:${this.weekKey()}`;
  }

  private counterKey(companyId: string, type: string): string {
    return `objection_resolution_count:${companyId}:${type}`;
  }

  private lockKey(companyId: string, type: string): string {
    return `objection_resolution_lock:${companyId}:${type}`;
  }

  /** Returns the cached resolution path for this week, or null. */
  async get(
    companyId: string,
    type: string,
  ): Promise<ObjectionResolutionPath | null> {
    try {
      const raw = await this.redis.get(this.pathKey(companyId, type));
      if (!raw) return null;
      try {
        return JSON.parse(raw) as ObjectionResolutionPath;
      } catch {
        // Corrupt entry — drop it and treat as a miss.
        await this.redis.del(this.pathKey(companyId, type));
        return null;
      }
    } catch (err) {
      this.logger.warn(
        `Redis unavailable reading objection cache — treating as miss: ${
          (err as Error).message
        }`,
      );
      return null;
    }
  }

  /** Caches a freshly generated path (7d TTL) and arms the staleness counter. */
  async set(
    companyId: string,
    type: string,
    path: ObjectionResolutionPath,
  ): Promise<void> {
    try {
      await this.redis.set(
        this.pathKey(companyId, type),
        JSON.stringify(path),
        'EX',
        CACHE_TTL_SECONDS,
      );
      await this.redis.set(
        this.counterKey(companyId, type),
        INVALIDATION_THRESHOLD,
      );
    } catch (err) {
      // The generated path is still returned to the caller — only reuse is lost.
      this.logger.warn(
        `Redis unavailable writing objection cache for ${companyId}:${type}: ${
          (err as Error).message
        }`,
      );
    }
  }

  /**
   * Threshold-based invalidation: called once per new analysis with the
   * distinct objection types it contained. Decrements each type's counter;
   * when one hits zero, every cached path for that type is purged.
   */
  async recordAnalyzedObjections(
    companyId: string,
    types: string[],
  ): Promise<void> {
    try {
      for (const type of new Set(types)) {
        const counterKey = this.counterKey(companyId, type);
        // No counter means nothing is cached for this type — nothing to age out.
        if (!(await this.redis.exists(counterKey))) continue;

        const remaining = await this.redis.decr(counterKey);
        if (remaining > 0) continue;

        await this.purge(companyId, type);
        this.logger.log(
          `Invalidated objection_resolution cache for ${companyId}:${type} after ${INVALIDATION_THRESHOLD} new analyses`,
        );
      }
    } catch (err) {
      // Never bubble up — a cache bookkeeping failure must not fail (and
      // re-run) the analysis job that triggered it.
      this.logger.warn(
        `Redis unavailable updating objection counters for ${companyId}: ${
          (err as Error).message
        }`,
      );
    }
  }

  /**
   * Claims the in-flight generation lock for one objection type, so two
   * concurrent cache misses don't both pay for an LLM synthesis. Returns
   * true when generation may proceed; if Redis is down the lock is waived
   * (cache-disabled mode should not block generation).
   */
  async acquireGenerationLock(
    companyId: string,
    type: string,
  ): Promise<boolean> {
    try {
      const res = await this.redis.set(
        this.lockKey(companyId, type),
        '1',
        'EX',
        GENERATION_LOCK_TTL_SECONDS,
        'NX',
      );
      return res === 'OK';
    } catch {
      return true;
    }
  }

  /** Releases the in-flight generation lock. */
  async releaseGenerationLock(companyId: string, type: string): Promise<void> {
    try {
      await this.redis.del(this.lockKey(companyId, type));
    } catch {
      // TTL will release it.
    }
  }

  /** Deletes all cached paths (any week) and the counter for one type. */
  private async purge(companyId: string, type: string): Promise<void> {
    const pattern = `objection_resolution:${companyId}:${type}:*`;
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = next;
      if (keys.length > 0) await this.redis.del(...keys);
    } while (cursor !== '0');
    await this.redis.del(this.counterKey(companyId, type));
  }
}
