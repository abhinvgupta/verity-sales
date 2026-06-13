import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES, WORKER_TUNING } from '@verity/shared';
import { ComparisonService } from './comparison.service';

interface CompareJobData {
  callId: string;
  companyId: string;
}

@Processor(QUEUES.COMPARE_CALL, WORKER_TUNING.COMPARE_CALL)
export class ComparisonProcessor extends WorkerHost {
  private readonly logger = new Logger(ComparisonProcessor.name);

  constructor(private readonly comparisonService: ComparisonService) {
    super();
  }

  async process(job: Job<CompareJobData>): Promise<void> {
    const { callId, companyId } = job.data;
    this.logger.log(`Processing compare-call job for call ${callId}`);
    await this.comparisonService.runComparison(callId, companyId);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<CompareJobData>, error: Error): Promise<void> {
    const { callId, companyId } = job.data;
    this.logger.error(
      `compare-call attempt ${job.attemptsMade} failed for call ${callId}: ${
        error?.message ?? job.failedReason
      }`,
      error?.stack,
    );

    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade >= maxAttempts) {
      this.logger.error(
        `Comparison permanently failed for call ${callId} after ${job.attemptsMade} attempts`,
      );
      await this.comparisonService.markCallFailed(callId, companyId);
    }
  }
}
