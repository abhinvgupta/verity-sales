import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { QUEUES } from '@verity/shared';
import { CallsService } from './calls.service';
import { CallsRepository } from './calls.repository';
import { StorageService } from '../storage/storage.service';

describe('CallsService', () => {
  let service: CallsService;
  let callsRepo: jest.Mocked<CallsRepository>;
  let storage: jest.Mocked<StorageService>;
  let queueAdd: jest.Mock;

  beforeEach(async () => {
    queueAdd = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CallsService,
        {
          provide: CallsRepository,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn(),
            updateStatus: jest.fn(),
          },
        },
        {
          provide: StorageService,
          useValue: {
            getTranscriptKey: jest.fn().mockReturnValue('key'),
            uploadTranscript: jest.fn(),
          },
        },
        { provide: getQueueToken(QUEUES.ANALYZE_CALL), useValue: { add: queueAdd } },
      ],
    }).compile();

    service = module.get<CallsService>(CallsService);
    callsRepo = module.get(CallsRepository);
    storage = module.get(StorageService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  it('uploads transcript, creates call, and enqueues analysis', async () => {
    callsRepo.create.mockResolvedValue({ _id: 'c1' } as never);
    await service.create('company1', {
      repId: 'rep1',
      transcriptText: 'hello',
    });
    expect(storage.uploadTranscript).toHaveBeenCalled();
    expect(callsRepo.create).toHaveBeenCalled();
    expect(queueAdd).toHaveBeenCalledWith(
      QUEUES.ANALYZE_CALL,
      expect.objectContaining({ companyId: 'company1' }),
      expect.objectContaining({ attempts: 3 }),
    );
  });

  it('throws NotFoundException when call not found', async () => {
    callsRepo.findById.mockResolvedValue(null);
    await expect(service.findById('x', 'company1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('re-queues analysis for a failed call', async () => {
    callsRepo.findById.mockResolvedValue({ _id: 'c1', status: 'failed' } as never);
    callsRepo.updateStatus.mockResolvedValue({
      _id: 'c1',
      status: 'queued',
    } as never);

    await service.retryAnalysis('company1', 'c1');

    expect(callsRepo.updateStatus).toHaveBeenCalledWith(
      'c1',
      'company1',
      'queued',
      undefined,
    );
    expect(queueAdd).toHaveBeenCalledWith(
      QUEUES.ANALYZE_CALL,
      { callId: 'c1', companyId: 'company1' },
      expect.objectContaining({ attempts: 3 }),
    );
  });

  it('rejects retry while analysis is already in flight', async () => {
    callsRepo.findById.mockResolvedValue({
      _id: 'c1',
      status: 'analyzing',
    } as never);

    await expect(service.retryAnalysis('company1', 'c1')).rejects.toThrow(
      ConflictException,
    );
    expect(queueAdd).not.toHaveBeenCalled();
  });
});
