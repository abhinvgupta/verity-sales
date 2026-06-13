import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES, WORKER_TUNING } from '@verity/shared';
import { AnalysisService } from './analysis.service';

interface AnalyzeJobData {
  callId: string;
  companyId: string;
}

@Processor(QUEUES.ANALYZE_CALL, WORKER_TUNING.ANALYZE_CALL)
export class AnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalysisProcessor.name);

  constructor(private readonly analysisService: AnalysisService) {
    super();
  }

  async process(job: Job<AnalyzeJobData>): Promise<void> {
    const { callId, companyId } = job.data;
    this.logger.log(`Processing analyze-call job for call ${callId}`);
    await this.analysisService.runAnalysis(callId, companyId);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<AnalyzeJobData>, error: Error): Promise<void> {
    const { callId, companyId } = job.data;
    // Log the real reason on every failed attempt, not just the last.
    this.logger.error(
      `analyze-call attempt ${job.attemptsMade} failed for call ${callId}: ${
        error?.message ?? job.failedReason
      }`,
      error?.stack,
    );

    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade >= maxAttempts) {
      this.logger.error(
        `Analysis permanently failed for call ${callId} after ${job.attemptsMade} attempts`,
      );
      await this.analysisService.markCallFailed(callId, companyId);
    }
  }
}
