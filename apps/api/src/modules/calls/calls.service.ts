import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { JobsOptions, Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { CallStatus, PaginationMeta, QUEUES } from '@verity/shared';
import { CallDocument } from '../../database/schemas';
import { StorageService } from '../storage/storage.service';
import { CallsRepository, CallListItem } from './calls.repository';
import { CreateCallDto } from './dto/create-call.dto';
import { ListCallsDto } from './dto/list-calls.dto';

/** Standard retry policy for analyze-call jobs (see CLAUDE.md Queue Rules). */
const ANALYZE_JOB_OPTS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
};

/** Statuses for which an analysis job is already in flight — retry is rejected. */
const IN_FLIGHT_STATUSES: CallStatus[] = ['queued', 'analyzing', 'comparing'];

@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);

  constructor(
    private readonly callsRepo: CallsRepository,
    private readonly storageService: StorageService,
    @InjectQueue(QUEUES.ANALYZE_CALL) private readonly analyzeQueue: Queue,
  ) {}

  /**
   * Saves the pasted transcript to S3 as a file, persists the Call, and
   * enqueues the analysis job. Never calls the LLM synchronously.
   */
  async create(companyId: string, dto: CreateCallDto): Promise<CallDocument> {
    const callId = randomUUID();
    const key = this.storageService.getTranscriptKey(
      companyId,
      callId,
      'transcript.txt',
    );

    await this.storageService.uploadTranscript(key, dto.transcriptText);

    const call = await this.callsRepo.create({
      _id: callId,
      companyId,
      repId: dto.repId,
      transcriptUrl: key,
      status: 'queued',
    });

    await this.analyzeQueue.add(
      QUEUES.ANALYZE_CALL,
      { callId, companyId },
      ANALYZE_JOB_OPTS,
    );

    this.logger.log(`Call ${callId} created and queued for analysis`);
    return call;
  }

  /**
   * Re-enqueues analysis for an existing call (e.g. after a failed run). Resets
   * the call to `queued` and adds a fresh analyze job. Rejects if a job is
   * already in flight to avoid duplicate processing. Never calls the LLM
   * synchronously.
   */
  async retryAnalysis(companyId: string, callId: string): Promise<CallDocument> {
    const call = await this.findById(callId, companyId);

    if (IN_FLIGHT_STATUSES.includes(call.status)) {
      throw new ConflictException(
        `Call ${callId} already has analysis in progress (${call.status})`,
      );
    }

    const updated = await this.updateStatus(callId, companyId, 'queued');

    await this.analyzeQueue.add(
      QUEUES.ANALYZE_CALL,
      { callId, companyId },
      ANALYZE_JOB_OPTS,
    );

    this.logger.log(`Call ${callId} re-queued for analysis`);
    return updated;
  }

  /**
   * Returns a paginated, filterable list of calls scoped to the company,
   * enriched with each call's analysis score and rep name.
   */
  findAll(
    companyId: string,
    query: ListCallsDto,
  ): Promise<{ data: CallListItem[]; meta: PaginationMeta }> {
    return this.callsRepo.findAll(companyId, query);
  }

  /** Returns a single call scoped to the company. Throws if not found. */
  async findById(id: string, companyId: string): Promise<CallDocument> {
    const call = await this.callsRepo.findById(id, companyId);
    if (!call) throw new NotFoundException(`Call ${id} not found`);
    return call;
  }

  /** Updates a call's lifecycle status. Used by job processors. */
  async updateStatus(
    id: string,
    companyId: string,
    status: CallStatus,
    failureReason?: string,
  ): Promise<CallDocument> {
    const call = await this.callsRepo.updateStatus(
      id,
      companyId,
      status,
      failureReason,
    );
    if (!call) throw new NotFoundException(`Call ${id} not found`);
    return call;
  }
}
