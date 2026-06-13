import { Test } from '@nestjs/testing';
import { JwtPayload } from '@verity/shared';
import { LlmService } from '../llm/llm.service';
import { PromptBuilderService } from '../llm/prompt-builder.service';
import { AnalyticsRepository } from './analytics.repository';
import { ObjectionCacheService } from './objection-cache.service';
import { ObjectionsService } from './objections.service';

const manager: JwtPayload = {
  sub: 'user1',
  companyId: 'company1',
  role: 'manager',
  email: 'manager@example.com',
};

const rep: JwtPayload = { ...manager, sub: 'rep1', role: 'rep' };

const validOutput = {
  winningPatterns: [{ pattern: 'Reframe to ROI', description: 'desc' }],
  losingPatterns: [{ pattern: 'Instant discount', description: 'desc' }],
  playbook: {
    do: ['Acknowledge the concern'],
    dont: ['Jump straight to discounting'],
    suggestedScript: 'I hear you on price…',
  },
};

const sample = (repHandling: string) => ({
  repHandling,
  repResponseSummary: 'summary',
  transcriptExcerpt: 'excerpt',
  score: 80,
});

describe('ObjectionsService', () => {
  let service: ObjectionsService;
  let repo: jest.Mocked<AnalyticsRepository>;
  let cache: jest.Mocked<ObjectionCacheService>;
  let llm: jest.Mocked<LlmService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ObjectionsService,
        {
          provide: AnalyticsRepository,
          useValue: {
            objectionList: jest.fn().mockResolvedValue({
              totalCallsAnalyzed: 0,
              items: [],
            }),
            objectionSamples: jest.fn(),
            saveLlmDebugLog: jest.fn(),
          },
        },
        {
          provide: ObjectionCacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            acquireGenerationLock: jest.fn().mockResolvedValue(true),
            releaseGenerationLock: jest.fn(),
          },
        },
        {
          provide: LlmService,
          useValue: { completeStream: jest.fn() },
        },
        {
          provide: PromptBuilderService,
          useValue: { buildObjectionSynthesis: jest.fn().mockReturnValue('p') },
        },
      ],
    }).compile();

    service = module.get(ObjectionsService);
    repo = module.get(AnalyticsRepository);
    cache = module.get(ObjectionCacheService);
    llm = module.get(LlmService);
  });

  describe('list', () => {
    it('does not scope managers to a rep', async () => {
      await service.list(manager, { sortBy: 'count' });
      expect(repo.objectionList).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: 'company1', repId: undefined }),
        'count',
        undefined,
      );
    });

    it('scopes reps to their own calls', async () => {
      await service.list(rep, { sortBy: 'priority', search: 'pri' });
      expect(repo.objectionList).toHaveBeenCalledWith(
        expect.objectContaining({ repId: 'rep1' }),
        'priority',
        'pri',
      );
    });
  });

  describe('generatePath', () => {
    it('returns insufficient when a bucket has fewer than 5 samples', async () => {
      repo.objectionSamples.mockResolvedValue({
        successful: Array(7).fill(sample('successful')),
        unsuccessful: Array(2).fill(sample('ignored')),
      });

      const result = await service.generatePath('company1', 'pricing');

      expect(result).toEqual({
        kind: 'insufficient',
        successfulCount: 7,
        unsuccessfulCount: 2,
      });
      expect(llm.completeStream).not.toHaveBeenCalled();
    });

    it('validates, caches, and returns the path on success', async () => {
      repo.objectionSamples.mockResolvedValue({
        successful: Array(5).fill(sample('successful')),
        unsuccessful: Array(5).fill(sample('ignored')),
      });
      llm.completeStream.mockResolvedValue(JSON.stringify(validOutput));

      const result = await service.generatePath('company1', 'pricing');

      expect(result.kind).toBe('path');
      if (result.kind === 'path') {
        expect(result.path.objectionType).toBe('pricing');
        expect(result.path.cached).toBe(false);
        expect(result.path.sampleCounts).toEqual({
          successful: 5,
          unsuccessful: 5,
        });
      }
      expect(cache.set).toHaveBeenCalledWith(
        'company1',
        'pricing',
        expect.objectContaining({ objectionType: 'pricing' }),
      );
    });

    it('returns busy without sampling when another generation holds the lock', async () => {
      cache.acquireGenerationLock.mockResolvedValue(false);

      const result = await service.generatePath('company1', 'pricing');

      expect(result).toEqual({ kind: 'busy' });
      expect(repo.objectionSamples).not.toHaveBeenCalled();
      expect(cache.releaseGenerationLock).not.toHaveBeenCalled();
    });

    it('releases the generation lock even when the LLM call throws', async () => {
      repo.objectionSamples.mockResolvedValue({
        successful: Array(5).fill(sample('successful')),
        unsuccessful: Array(5).fill(sample('ignored')),
      });
      llm.completeStream.mockRejectedValue(new Error('boom'));

      await expect(service.generatePath('company1', 'pricing')).rejects.toThrow(
        'boom',
      );
      expect(cache.releaseGenerationLock).toHaveBeenCalledWith(
        'company1',
        'pricing',
      );
    });

    it('saves a debug log and degrades when the LLM output is invalid', async () => {
      repo.objectionSamples.mockResolvedValue({
        successful: Array(5).fill(sample('successful')),
        unsuccessful: Array(5).fill(sample('ignored')),
      });
      llm.completeStream.mockResolvedValue('{"winningPatterns": []}');

      const result = await service.generatePath('company1', 'pricing');

      expect(result).toEqual({ kind: 'invalid' });
      expect(repo.saveLlmDebugLog).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'company1',
          context: 'objection_resolution:pricing',
        }),
      );
      expect(cache.set).not.toHaveBeenCalled();
    });
  });
});
