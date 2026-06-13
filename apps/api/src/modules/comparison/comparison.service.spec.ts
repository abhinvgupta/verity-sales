import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ComparisonService } from './comparison.service';
import { ComparisonRepository } from './comparison.repository';
import { CallsService } from '../calls/calls.service';
import { FormsService } from '../forms/forms.service';
import { StorageService } from '../storage/storage.service';
import { LlmService } from '../llm/llm.service';
import { PromptBuilderService } from '../llm/prompt-builder.service';

describe('ComparisonService', () => {
  let service: ComparisonService;
  let comparisonRepo: jest.Mocked<ComparisonRepository>;
  let callsService: jest.Mocked<CallsService>;
  let formsService: jest.Mocked<FormsService>;
  let llmService: jest.Mocked<LlmService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComparisonService,
        {
          provide: ComparisonRepository,
          useValue: { upsert: jest.fn(), findByCallId: jest.fn() },
        },
        {
          provide: CallsService,
          useValue: {
            findById: jest.fn().mockResolvedValue({ transcriptUrl: 'key' }),
            updateStatus: jest.fn(),
          },
        },
        {
          provide: FormsService,
          useValue: {
            getByCallId: jest.fn().mockResolvedValue({
              extractionStatus: 'success',
              datapoints: { dealSize: 5000 },
            }),
          },
        },
        {
          provide: StorageService,
          useValue: { getTranscriptText: jest.fn().mockResolvedValue('transcript') },
        },
        { provide: LlmService, useValue: { complete: jest.fn() } },
        {
          provide: PromptBuilderService,
          useValue: { buildComparison: jest.fn().mockReturnValue('prompt') },
        },
      ],
    }).compile();

    service = module.get<ComparisonService>(ComparisonService);
    comparisonRepo = module.get(ComparisonRepository);
    callsService = module.get(CallsService);
    formsService = module.get(FormsService);
    llmService = module.get(LlmService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  it('on valid output, saves findings and marks call complete', async () => {
    llmService.complete.mockResolvedValue(
      '{"alignmentScore":82,"findings":[{"field":"dealSize","repValue":5000,"transcriptValue":5000,"status":"match"}]}',
    );
    await service.runComparison('call1', 'company1');

    expect(comparisonRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ comparisonStatus: 'success', alignmentScore: 82 }),
    );
    expect(callsService.updateStatus).toHaveBeenCalledWith(
      'call1',
      'company1',
      'complete',
    );
  });

  it('marks validation_failed and does not throw on malformed output', async () => {
    llmService.complete.mockResolvedValue('{"findings":"not-an-array"}');
    await expect(service.runComparison('call1', 'company1')).resolves.toBeUndefined();
    expect(comparisonRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ comparisonStatus: 'validation_failed' }),
    );
  });

  it('skips comparison when form not extracted', async () => {
    formsService.getByCallId.mockResolvedValue({
      extractionStatus: 'pending',
      datapoints: undefined,
    } as never);
    await service.runComparison('call1', 'company1');
    expect(llmService.complete).not.toHaveBeenCalled();
    expect(callsService.updateStatus).toHaveBeenCalledWith(
      'call1',
      'company1',
      'failed',
      expect.any(String),
    );
  });

  it('rethrows and records llm_error on LLM failure', async () => {
    llmService.complete.mockRejectedValue(new Error('boom'));
    await expect(service.runComparison('call1', 'company1')).rejects.toThrow('boom');
    expect(comparisonRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ comparisonStatus: 'llm_error' }),
    );
  });

  it('throws NotFoundException when comparison missing', async () => {
    comparisonRepo.findByCallId.mockResolvedValue(null);
    await expect(service.getByCallId('x', 'company1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
