import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { z } from 'zod';
import { ObjectionEntry } from '@verity/shared';
import { CallAnalysisDocument } from '../../database/schemas';
import { safeParseJson } from '../../common/utils/json.util';
import { CallsService } from '../calls/calls.service';
import { TemplatesService } from '../templates/templates.service';
import { StorageService } from '../storage/storage.service';
import { ObjectionCacheService } from '../analytics/objection-cache.service';
import { AnalysisRepository } from './analysis.repository';
import { LlmService } from '../llm/llm.service';
import { PromptBuilderService } from '../llm/prompt-builder.service';

/**
 * Objection entries are additive intelligence: malformed entries are dropped
 * (never fail an otherwise valid analysis over them). The type label is
 * normalized to snake_case so aggregation groups cleanly.
 */
const LlmObjectionSchema = z.object({
  type: z
    .string()
    .min(1)
    .transform((t) =>
      t
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, ''),
    )
    .pipe(z.string().min(1).max(64)),
  repHandling: z.enum(['successful', 'partial', 'unsuccessful', 'ignored']),
  repResponseSummary: z.string().min(1),
  transcriptExcerpt: z.string().min(1),
});

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    private readonly analysisRepo: AnalysisRepository,
    private readonly callsService: CallsService,
    private readonly templatesService: TemplatesService,
    private readonly storageService: StorageService,
    private readonly llmService: LlmService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly objectionCache: ObjectionCacheService,
  ) {}

  /** Returns the analysis for a call. Throws if none exists. */
  async getByCallId(
    callId: string,
    companyId: string,
  ): Promise<CallAnalysisDocument> {
    const analysis = await this.analysisRepo.findByCallId(callId, companyId);
    if (!analysis) {
      throw new NotFoundException(`No analysis found for call ${callId}`);
    }
    return analysis;
  }

  /**
   * Runs LLM analysis for a call: fetches transcript + active template, calls
   * Claude, validates output, persists results. Throws on LLM/transport errors
   * so BullMQ can retry; returns (without throwing) on validation failure.
   */
  async runAnalysis(callId: string, companyId: string): Promise<void> {
    await this.callsService.updateStatus(callId, companyId, 'analyzing');

    const call = await this.callsService.findById(callId, companyId);
    const template = await this.templatesService.findActive(companyId);
    const transcript = await this.storageService.getTranscriptText(
      call.transcriptUrl,
    );
    const prompt = this.promptBuilder.build(
      template.callAnalysisPrompt,
      transcript,
      template.outputSchema,
    );

    let raw: string;
    try {
      raw = await this.llmService.complete(prompt);
    } catch (err) {
      await this.analysisRepo.upsert({
        callId,
        companyId,
        analysisStatus: 'llm_error',
      });
      this.logger.error(`LLM request failed for call ${callId}`, err as Error);
      throw err; // let BullMQ retry
    }

    const parsed = safeParseJson(raw);
    const validation = this.validateOutput(parsed, template.outputSchema);

    if (!validation.valid) {
      await this.analysisRepo.upsert({
        callId,
        companyId,
        rawLlmOutput: raw,
        analysisStatus: 'validation_failed',
      });
      await this.callsService.updateStatus(
        callId,
        companyId,
        'failed',
        'LLM output failed schema validation',
      );
      this.logger.error(`LLM validation failed for call ${callId}`);
      return; // do not throw — validation won't improve on retry
    }

    const objections = this.extractObjections(
      parsed as Record<string, unknown>,
    );

    await this.analysisRepo.upsert({
      callId,
      companyId,
      parsedOutput: parsed as Record<string, unknown>,
      score: validation.score,
      objections,
      analysisStatus: 'success',
    });
    await this.callsService.updateStatus(callId, companyId, 'analyzed');
    this.logger.log(`Analysis succeeded for call ${callId}`);

    if (objections.length > 0) {
      // Age out cached resolution paths as new objection data accumulates.
      await this.objectionCache.recordAnalyzedObjections(
        companyId,
        objections.map((o) => o.type),
      );
    }
  }

  /**
   * Pulls the objections array out of the LLM output, keeping only entries
   * that pass validation. Tolerates templates whose schema doesn't include
   * objections at all (returns an empty array).
   */
  private extractObjections(
    parsed: Record<string, unknown>,
  ): ObjectionEntry[] {
    if (!Array.isArray(parsed.objections)) return [];
    return parsed.objections.flatMap((entry) => {
      const result = LlmObjectionSchema.safeParse(entry);
      return result.success ? [result.data] : [];
    });
  }

  /** Marks a call as failed — invoked after BullMQ exhausts all retries. */
  async markCallFailed(callId: string, companyId: string): Promise<void> {
    await this.callsService.updateStatus(
      callId,
      companyId,
      'failed',
      'Analysis failed after all retries',
    );
  }

  /**
   * Lightweight validation of the parsed LLM output against the template's
   * JSON Schema: must be an object and contain any declared required keys.
   */
  private validateOutput(
    parsed: unknown,
    outputSchema: Record<string, unknown>,
  ): { valid: boolean; score?: number } {
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { valid: false };
    }
    const obj = parsed as Record<string, unknown>;

    const required = Array.isArray(outputSchema.required)
      ? (outputSchema.required as string[])
      : [];
    for (const key of required) {
      if (!(key in obj)) return { valid: false };
    }

    const score =
      typeof obj.score === 'number' && obj.score >= 0 && obj.score <= 100
        ? obj.score
        : undefined;
    return { valid: true, score };
  }
}
