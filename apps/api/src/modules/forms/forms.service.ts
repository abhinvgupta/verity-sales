import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUES } from '@verity/shared';
import { RepFormDocument } from '../../database/schemas';
import { safeParseJson } from '../../common/utils/json.util';
import { CallsService } from '../calls/calls.service';
import { TemplatesService } from '../templates/templates.service';
import { StorageService } from '../storage/storage.service';
import { LlmService } from '../llm/llm.service';
import { PromptBuilderService } from '../llm/prompt-builder.service';
import { FormsRepository } from './forms.repository';

const EXTRACTION_MAX_TOKENS = 1500;

@Injectable()
export class FormsService {
  private readonly logger = new Logger(FormsService.name);

  constructor(
    private readonly formsRepo: FormsRepository,
    private readonly callsService: CallsService,
    private readonly templatesService: TemplatesService,
    private readonly storageService: StorageService,
    private readonly llmService: LlmService,
    private readonly promptBuilder: PromptBuilderService,
    @InjectQueue(QUEUES.EXTRACT_FORM) private readonly extractQueue: Queue,
    @InjectQueue(QUEUES.COMPARE_CALL) private readonly compareQueue: Queue,
  ) {}

  /**
   * Uploads the scanned form image to S3, creates the RepForm, and enqueues the
   * extraction job. Never calls the LLM synchronously.
   */
  async createFromUpload(
    callId: string,
    companyId: string,
    file: Express.Multer.File,
  ): Promise<RepFormDocument> {
    const call = await this.callsService.findById(callId, companyId);

    const key = this.storageService.getFormKey(
      companyId,
      callId,
      file.originalname,
    );
    await this.storageService.uploadForm(key, file.buffer, file.mimetype);

    const repForm = await this.formsRepo.create({
      callId,
      companyId,
      repId: call.repId,
      formImageUrl: key,
      submittedAt: new Date(),
    });

    await this.extractQueue.add(
      QUEUES.EXTRACT_FORM,
      { callId, companyId },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );
    await this.callsService.updateStatus(callId, companyId, 'form_pending');

    this.logger.log(`Form uploaded for call ${callId}, queued for extraction`);
    return repForm;
  }

  /** Returns the rep form for a call. Throws if none exists. */
  async getByCallId(
    callId: string,
    companyId: string,
  ): Promise<RepFormDocument> {
    const form = await this.formsRepo.findByCallId(callId, companyId);
    if (!form) throw new NotFoundException(`No form found for call ${callId}`);
    return form;
  }

  /**
   * Extracts the form image into structured datapoints via gpt-4o vision,
   * validates against the template's formSchema, and on success auto-enqueues
   * the comparison job. Throws on LLM/transport errors so BullMQ can retry;
   * returns (without throwing) on non-transient failures.
   */
  async runExtraction(callId: string, companyId: string): Promise<void> {
    const form = await this.formsRepo.findByCallId(callId, companyId);
    if (!form) throw new NotFoundException(`No form found for call ${callId}`);

    const template = await this.templatesService.findActive(companyId);
    if (!template.formSchema) {
      await this.formsRepo.updateExtraction(callId, companyId, {
        extractionStatus: 'validation_failed',
      });
      await this.callsService.updateStatus(
        callId,
        companyId,
        'failed',
        'Active template has no formSchema configured',
      );
      this.logger.error(`No formSchema on active template for company ${companyId}`);
      return; // non-transient — retrying won't help
    }

    const imageUrl = await this.storageService.getDownloadPresignedUrl(
      form.formImageUrl,
    );
    const prompt = this.promptBuilder.buildExtraction(template.formSchema);

    let raw: string;
    try {
      raw = await this.llmService.completeWithImage(
        prompt,
        imageUrl,
        EXTRACTION_MAX_TOKENS,
      );
    } catch (err) {
      await this.formsRepo.updateExtraction(callId, companyId, {
        extractionStatus: 'llm_error',
      });
      this.logger.error(`Form extraction LLM failed for call ${callId}`, err as Error);
      throw err; // let BullMQ retry
    }

    const parsed = safeParseJson(raw);
    if (!this.isValid(parsed, template.formSchema)) {
      await this.formsRepo.updateExtraction(callId, companyId, {
        extractionStatus: 'validation_failed',
        rawLlmOutput: raw,
      });
      await this.callsService.updateStatus(
        callId,
        companyId,
        'failed',
        'Form extraction failed schema validation',
      );
      this.logger.error(`Form extraction validation failed for call ${callId}`);
      return; // do not throw
    }

    await this.formsRepo.updateExtraction(callId, companyId, {
      extractionStatus: 'success',
      datapoints: parsed as Record<string, unknown>,
    });

    // Auto-chain: kick off the comparison job.
    await this.compareQueue.add(
      QUEUES.COMPARE_CALL,
      { callId, companyId },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );
    await this.callsService.updateStatus(callId, companyId, 'comparing');

    this.logger.log(`Form extracted for call ${callId}, queued for comparison`);
  }

  /** Marks the form's extraction as failed — after BullMQ exhausts all retries. */
  async markFormFailed(callId: string, companyId: string): Promise<void> {
    await this.formsRepo.updateExtraction(callId, companyId, {
      extractionStatus: 'llm_error',
    });
    await this.callsService.updateStatus(
      callId,
      companyId,
      'failed',
      'Form extraction failed after all retries',
    );
  }

  /** Parsed output must be an object containing the schema's required keys. */
  private isValid(parsed: unknown, formSchema: Record<string, unknown>): boolean {
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return false;
    }
    const obj = parsed as Record<string, unknown>;
    const required = Array.isArray(formSchema.required)
      ? (formSchema.required as string[])
      : [];
    return required.every((key) => key in obj);
  }
}
