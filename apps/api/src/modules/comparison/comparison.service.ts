import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ComparisonFinding } from '@verity/shared';
import { ComparisonResultDocument } from '../../database/schemas';
import { safeParseJson } from '../../common/utils/json.util';
import { CallsService } from '../calls/calls.service';
import { FormsService } from '../forms/forms.service';
import { StorageService } from '../storage/storage.service';
import { LlmService } from '../llm/llm.service';
import { PromptBuilderService } from '../llm/prompt-builder.service';
import { ComparisonRepository } from './comparison.repository';

const COMPARISON_MAX_TOKENS = 1000;

@Injectable()
export class ComparisonService {
  private readonly logger = new Logger(ComparisonService.name);

  constructor(
    private readonly comparisonRepo: ComparisonRepository,
    private readonly callsService: CallsService,
    private readonly formsService: FormsService,
    private readonly storageService: StorageService,
    private readonly llmService: LlmService,
    private readonly promptBuilder: PromptBuilderService,
  ) {}

  /** Returns the comparison for a call. Throws if none exists. */
  async getByCallId(
    callId: string,
    companyId: string,
  ): Promise<ComparisonResultDocument> {
    const result = await this.comparisonRepo.findByCallId(callId, companyId);
    if (!result) {
      throw new NotFoundException(`No comparison found for call ${callId}`);
    }
    return result;
  }

  /**
   * Reconciles the rep's extracted form datapoints against the transcript via
   * the LLM, persists findings + alignmentScore. Throws on LLM/transport errors
   * so BullMQ can retry; returns (without throwing) on non-transient failures.
   */
  async runComparison(callId: string, companyId: string): Promise<void> {
    const call = await this.callsService.findById(callId, companyId);
    const form = await this.formsService.getByCallId(callId, companyId);

    if (form.extractionStatus !== 'success' || !form.datapoints) {
      await this.callsService.updateStatus(
        callId,
        companyId,
        'failed',
        'Cannot compare: form has not been successfully extracted',
      );
      this.logger.error(`Form not extracted for call ${callId}; skipping comparison`);
      return; // non-transient
    }

    const transcript = await this.storageService.getTranscriptText(
      call.transcriptUrl,
    );
    const prompt = this.promptBuilder.buildComparison(transcript, form.datapoints);

    let raw: string;
    try {
      raw = await this.llmService.complete(prompt, COMPARISON_MAX_TOKENS);
    } catch (err) {
      await this.comparisonRepo.upsert({
        callId,
        companyId,
        comparisonStatus: 'llm_error',
      });
      this.logger.error(`Comparison LLM failed for call ${callId}`, err as Error);
      throw err; // let BullMQ retry
    }

    const parsed = safeParseJson(raw);
    const validated = this.validate(parsed);

    if (!validated) {
      await this.comparisonRepo.upsert({
        callId,
        companyId,
        comparisonStatus: 'validation_failed',
        rawLlmOutput: raw,
      });
      await this.callsService.updateStatus(
        callId,
        companyId,
        'failed',
        'Comparison output failed validation',
      );
      this.logger.error(`Comparison validation failed for call ${callId}`);
      return; // do not throw
    }

    await this.comparisonRepo.upsert({
      callId,
      companyId,
      comparisonStatus: 'success',
      alignmentScore: validated.alignmentScore,
      findings: validated.findings,
    });
    await this.callsService.updateStatus(callId, companyId, 'complete');
    this.logger.log(`Comparison succeeded for call ${callId}`);
  }

  /** Marks a call failed — invoked after BullMQ exhausts all retries. */
  async markCallFailed(callId: string, companyId: string): Promise<void> {
    await this.callsService.updateStatus(
      callId,
      companyId,
      'failed',
      'Comparison failed after all retries',
    );
  }

  /**
   * Validates the comparison output: must be an object with a numeric
   * alignmentScore (0-100) and a findings array.
   */
  private validate(
    parsed: unknown,
  ): { alignmentScore?: number; findings: ComparisonFinding[] } | null {
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    const obj = parsed as Record<string, unknown>;
    if (!Array.isArray(obj.findings)) return null;

    const alignmentScore =
      typeof obj.alignmentScore === 'number' &&
      obj.alignmentScore >= 0 &&
      obj.alignmentScore <= 100
        ? obj.alignmentScore
        : undefined;

    return {
      alignmentScore,
      findings: obj.findings as ComparisonFinding[],
    };
  }
}
