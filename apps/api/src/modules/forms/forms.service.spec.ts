import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { NotFoundException } from '@nestjs/common';
import { QUEUES } from '@verity/shared';
import { FormsService } from './forms.service';
import { FormsRepository } from './forms.repository';
import { CallsService } from '../calls/calls.service';
import { TemplatesService } from '../templates/templates.service';
import { StorageService } from '../storage/storage.service';
import { LlmService } from '../llm/llm.service';
import { PromptBuilderService } from '../llm/prompt-builder.service';

describe('FormsService', () => {
  let service: FormsService;
  let formsRepo: jest.Mocked<FormsRepository>;
  let callsService: jest.Mocked<CallsService>;
  let llmService: jest.Mocked<LlmService>;
  let compareAdd: jest.Mock;

  beforeEach(async () => {
    compareAdd = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FormsService,
        {
          provide: FormsRepository,
          useValue: {
            create: jest.fn(),
            findByCallId: jest.fn().mockResolvedValue({ formImageUrl: 'key' }),
            updateExtraction: jest.fn(),
          },
        },
        {
          provide: CallsService,
          useValue: {
            findById: jest.fn().mockResolvedValue({ repId: 'rep1' }),
            updateStatus: jest.fn(),
          },
        },
        {
          provide: TemplatesService,
          useValue: {
            findActive: jest.fn().mockResolvedValue({
              formSchema: { required: ['dealSize'] },
            }),
          },
        },
        {
          provide: StorageService,
          useValue: {
            getFormKey: jest.fn().mockReturnValue('forms/key'),
            uploadForm: jest.fn(),
            getDownloadPresignedUrl: jest.fn().mockResolvedValue('https://signed'),
          },
        },
        { provide: LlmService, useValue: { completeWithImage: jest.fn() } },
        {
          provide: PromptBuilderService,
          useValue: { buildExtraction: jest.fn().mockReturnValue('prompt') },
        },
        { provide: getQueueToken(QUEUES.EXTRACT_FORM), useValue: { add: jest.fn() } },
        { provide: getQueueToken(QUEUES.COMPARE_CALL), useValue: { add: compareAdd } },
      ],
    }).compile();

    service = module.get<FormsService>(FormsService);
    formsRepo = module.get(FormsRepository);
    callsService = module.get(CallsService);
    llmService = module.get(LlmService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  it('on valid extraction, saves datapoints and auto-enqueues comparison', async () => {
    llmService.completeWithImage.mockResolvedValue('{"dealSize":5000}');
    await service.runExtraction('call1', 'company1');

    expect(formsRepo.updateExtraction).toHaveBeenCalledWith(
      'call1',
      'company1',
      expect.objectContaining({ extractionStatus: 'success' }),
    );
    expect(compareAdd).toHaveBeenCalled();
    expect(callsService.updateStatus).toHaveBeenCalledWith(
      'call1',
      'company1',
      'comparing',
    );
  });

  it('on missing required key, marks validation_failed and does not enqueue comparison', async () => {
    llmService.completeWithImage.mockResolvedValue('{"other":1}');
    await service.runExtraction('call1', 'company1');

    expect(formsRepo.updateExtraction).toHaveBeenCalledWith(
      'call1',
      'company1',
      expect.objectContaining({ extractionStatus: 'validation_failed' }),
    );
    expect(compareAdd).not.toHaveBeenCalled();
  });

  it('rethrows and records llm_error on vision failure', async () => {
    llmService.completeWithImage.mockRejectedValue(new Error('boom'));
    await expect(service.runExtraction('call1', 'company1')).rejects.toThrow('boom');
    expect(formsRepo.updateExtraction).toHaveBeenCalledWith(
      'call1',
      'company1',
      expect.objectContaining({ extractionStatus: 'llm_error' }),
    );
  });

  it('throws NotFoundException when form missing', async () => {
    formsRepo.findByCallId.mockResolvedValue(null);
    await expect(service.getByCallId('x', 'company1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
