import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { AnalysisRepository } from './analysis.repository';
import { CallsService } from '../calls/calls.service';
import { TemplatesService } from '../templates/templates.service';
import { StorageService } from '../storage/storage.service';
import { LlmService } from '../llm/llm.service';
import { PromptBuilderService } from '../llm/prompt-builder.service';
import { ObjectionCacheService } from '../analytics/objection-cache.service';

describe('AnalysisService', () => {
  let service: AnalysisService;
  let analysisRepo: jest.Mocked<AnalysisRepository>;
  let callsService: jest.Mocked<CallsService>;
  let templatesService: jest.Mocked<TemplatesService>;
  let storageService: jest.Mocked<StorageService>;
  let llmService: jest.Mocked<LlmService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalysisService,
        { provide: AnalysisRepository, useValue: { upsert: jest.fn(), findByCallId: jest.fn() } },
        {
          provide: CallsService,
          useValue: {
            updateStatus: jest.fn(),
            findById: jest.fn().mockResolvedValue({ transcriptUrl: 'key' }),
          },
        },
        {
          provide: TemplatesService,
          useValue: {
            findActive: jest.fn().mockResolvedValue({
              callAnalysisPrompt: 'Analyze {{transcript}}',
              outputSchema: { required: ['sentiment'] },
            }),
          },
        },
        {
          provide: StorageService,
          useValue: { getTranscriptText: jest.fn().mockResolvedValue('transcript') },
        },
        { provide: LlmService, useValue: { complete: jest.fn() } },
        { provide: PromptBuilderService, useValue: { build: jest.fn().mockReturnValue('prompt') } },
        {
          provide: ObjectionCacheService,
          useValue: { recordAnalyzedObjections: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AnalysisService>(AnalysisService);
    analysisRepo = module.get(AnalysisRepository);
    callsService = module.get(CallsService);
    templatesService = module.get(TemplatesService);
    storageService = module.get(StorageService);
    llmService = module.get(LlmService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  it('marks success when LLM returns valid JSON with required keys', async () => {
    llmService.complete.mockResolvedValue('{"sentiment":"positive","score":80}');
    await service.runAnalysis('call1', 'company1');

    expect(analysisRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ analysisStatus: 'success', score: 80 }),
    );
    expect(callsService.updateStatus).toHaveBeenCalledWith(
      'call1',
      'company1',
      'analyzed',
    );
  });

  it('marks validation_failed and does not throw on missing required key', async () => {
    llmService.complete.mockResolvedValue('{"other":"value"}');
    await expect(service.runAnalysis('call1', 'company1')).resolves.toBeUndefined();

    expect(analysisRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ analysisStatus: 'validation_failed' }),
    );
    expect(callsService.updateStatus).toHaveBeenCalledWith(
      'call1',
      'company1',
      'failed',
      expect.any(String),
    );
  });

  it('rethrows and records llm_error on LLM failure', async () => {
    llmService.complete.mockRejectedValue(new Error('boom'));
    await expect(service.runAnalysis('call1', 'company1')).rejects.toThrow('boom');
    expect(analysisRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ analysisStatus: 'llm_error' }),
    );
  });

  it('throws NotFoundException when analysis missing', async () => {
    analysisRepo.findByCallId.mockResolvedValue(null);
    await expect(service.getByCallId('x', 'company1')).rejects.toThrow(
      NotFoundException,
    );
  });

  // touch unused mocks to satisfy strict noUnusedLocals
  it('wires dependencies', () => {
    expect(templatesService).toBeDefined();
    expect(storageService).toBeDefined();
  });
});
