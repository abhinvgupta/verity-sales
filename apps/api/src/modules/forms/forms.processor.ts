import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES, WORKER_TUNING } from '@verity/shared';
import { FormsService } from './forms.service';

interface ExtractJobData {
  callId: string;
  companyId: string;
}

@Processor(QUEUES.EXTRACT_FORM, WORKER_TUNING.EXTRACT_FORM)
export class FormsProcessor extends WorkerHost {
  private readonly logger = new Logger(FormsProcessor.name);

  constructor(private readonly formsService: FormsService) {
    super();
  }

  async process(job: Job<ExtractJobData>): Promise<void> {
    const { callId, companyId } = job.data;
    this.logger.log(`Processing extract-form job for call ${callId}`);
    await this.formsService.runExtraction(callId, companyId);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<ExtractJobData>, error: Error): Promise<void> {
    const { callId, companyId } = job.data;
    this.logger.error(
      `extract-form attempt ${job.attemptsMade} failed for call ${callId}: ${
        error?.message ?? job.failedReason
      }`,
      error?.stack,
    );

    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade >= maxAttempts) {
      this.logger.error(
        `Form extraction permanently failed for call ${callId} after ${job.attemptsMade} attempts`,
      );
      await this.formsService.markFormFailed(callId, companyId);
    }
  }
}
