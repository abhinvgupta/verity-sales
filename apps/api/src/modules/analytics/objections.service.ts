import { Injectable, Logger } from '@nestjs/common';
import {
  JwtPayload,
  ObjectionList,
  ObjectionResolutionPath,
} from '@verity/shared';
import { safeParseJson } from '../../common/utils/json.util';
import { LlmService } from '../llm/llm.service';
import { PromptBuilderService } from '../llm/prompt-builder.service';
import { AnalyticsRepository } from './analytics.repository';
import { ObjectionCacheService } from './objection-cache.service';
import {
  ObjectionsQueryDto,
  ResolutionOutputSchema,
} from './dto/objections-query.dto';

const DAY_MS = 86_400_000;
const DEFAULT_RANGE_DAYS = 30;

/** Minimum samples per bucket before synthesis is attempted. */
const MIN_SAMPLES = 5;
const SYNTHESIS_MAX_TOKENS = 2000;

export type GenerationStage = 'sampling' | 'analyzing' | 'generating';

export type GenerationResult =
  | { kind: 'path'; path: ObjectionResolutionPath }
  | {
      kind: 'insufficient';
      successfulCount: number;
      unsuccessfulCount: number;
    }
  | { kind: 'invalid' }
  /** Another request is already generating this type's path. */
  | { kind: 'busy' };

@Injectable()
export class ObjectionsService {
  private readonly logger = new Logger(ObjectionsService.name);

  constructor(
    private readonly analyticsRepo: AnalyticsRepository,
    private readonly cache: ObjectionCacheService,
    private readonly llmService: LlmService,
    private readonly promptBuilder: PromptBuilderService,
  ) {}

  /**
   * Objection list for the period (defaults: last 30 days). Reps only see
   * objections from their own calls; managers and admins see the whole team.
   */
  list(user: JwtPayload, query: ObjectionsQueryDto): Promise<ObjectionList> {
    const to = query.endDate ?? new Date();
    const from =
      query.startDate ?? new Date(to.getTime() - DEFAULT_RANGE_DAYS * DAY_MS);
    return this.analyticsRepo.objectionList(
      {
        companyId: user.companyId,
        from,
        to,
        repId: user.role === 'rep' ? user.sub : undefined,
      },
      query.sortBy,
      query.search,
    );
  }

  /** Returns this week's cached resolution path, or null on a miss. */
  async getCachedPath(
    companyId: string,
    type: string,
  ): Promise<ObjectionResolutionPath | null> {
    const cached = await this.cache.get(companyId, type);
    return cached ? { ...cached, cached: true } : null;
  }

  /**
   * Generates a fresh resolution path: pulls sample buckets, streams the LLM
   * synthesis (deltas surface via `onDelta`), validates with Zod, and caches
   * the result for 7 days. Returns `insufficient` when either bucket has
   * fewer than 5 samples, `invalid` when the LLM output fails validation
   * (raw output is preserved in the debug collection — never throws for it),
   * and `busy` when another request already holds the generation lock for
   * this type. Aborting `signal` cancels the in-flight LLM call.
   */
  async generatePath(
    companyId: string,
    type: string,
    options: {
      signal?: AbortSignal;
      onStage?: (stage: GenerationStage) => void;
      onDelta?: (text: string) => void;
    } = {},
  ): Promise<GenerationResult> {
    // One synthesis per type at a time — concurrent cache misses shouldn't
    // each pay for an LLM call.
    if (!(await this.cache.acquireGenerationLock(companyId, type))) {
      return { kind: 'busy' };
    }
    try {
      return await this.generatePathLocked(companyId, type, options);
    } finally {
      await this.cache.releaseGenerationLock(companyId, type);
    }
  }

  private async generatePathLocked(
    companyId: string,
    type: string,
    options: {
      signal?: AbortSignal;
      onStage?: (stage: GenerationStage) => void;
      onDelta?: (text: string) => void;
    },
  ): Promise<GenerationResult> {
    options.onStage?.('sampling');
    const samples = await this.analyticsRepo.objectionSamples(companyId, type);

    if (
      samples.successful.length < MIN_SAMPLES ||
      samples.unsuccessful.length < MIN_SAMPLES
    ) {
      return {
        kind: 'insufficient',
        successfulCount: samples.successful.length,
        unsuccessfulCount: samples.unsuccessful.length,
      };
    }

    options.onStage?.('analyzing');
    const prompt = this.promptBuilder.buildObjectionSynthesis(
      type,
      samples.successful,
      samples.unsuccessful,
    );

    let started = false;
    const raw = await this.llmService.completeStream(prompt, {
      maxTokens: SYNTHESIS_MAX_TOKENS,
      signal: options.signal,
      onDelta: (text) => {
        if (!started) {
          started = true;
          options.onStage?.('generating');
        }
        options.onDelta?.(text);
      },
    });

    const parsed = safeParseJson(raw);
    const result = ResolutionOutputSchema.safeParse(parsed);
    if (!result.success) {
      await this.analyticsRepo.saveLlmDebugLog({
        companyId,
        context: `objection_resolution:${type}`,
        rawLlmOutput: raw,
        validationError: JSON.stringify(result.error.flatten()),
      });
      this.logger.error(
        `Resolution synthesis failed validation for ${companyId}:${type}`,
      );
      return { kind: 'invalid' };
    }

    const path: ObjectionResolutionPath = {
      objectionType: type,
      ...result.data,
      sampleCounts: {
        successful: samples.successful.length,
        unsuccessful: samples.unsuccessful.length,
      },
      lastUpdated: new Date().toISOString(),
      cached: false,
    };
    await this.cache.set(companyId, type, path);
    return { kind: 'path', path };
  }
}
