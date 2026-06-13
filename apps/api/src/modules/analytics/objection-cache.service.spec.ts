import { ConfigService } from '@nestjs/config';
import { ObjectionCacheService } from './objection-cache.service';

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  decr: jest.fn(),
  scan: jest.fn(),
  quit: jest.fn(),
};

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => mockRedis),
}));

describe('ObjectionCacheService', () => {
  let service: ObjectionCacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    const config = {
      getOrThrow: jest.fn((key: string) =>
        key === 'REDIS_HOST' ? 'localhost' : '6379',
      ),
    } as unknown as ConfigService;
    service = new ObjectionCacheService(config);
  });

  it('returns null on a cache miss', async () => {
    mockRedis.get.mockResolvedValue(null);
    expect(await service.get('company1', 'pricing')).toBeNull();
  });

  it('treats a Redis outage as a cache miss', async () => {
    mockRedis.get.mockRejectedValueOnce(new Error('connection refused'));
    expect(await service.get('company1', 'pricing')).toBeNull();
  });

  it('never throws from counter bookkeeping when Redis is down', async () => {
    mockRedis.exists.mockRejectedValueOnce(new Error('connection refused'));
    await expect(
      service.recordAnalyzedObjections('company1', ['pricing']),
    ).resolves.toBeUndefined();
  });

  it('only one caller acquires the generation lock', async () => {
    mockRedis.set.mockResolvedValueOnce('OK').mockResolvedValueOnce(null);
    expect(await service.acquireGenerationLock('company1', 'pricing')).toBe(
      true,
    );
    expect(await service.acquireGenerationLock('company1', 'pricing')).toBe(
      false,
    );
  });

  it('waives the generation lock when Redis is down', async () => {
    mockRedis.set.mockRejectedValueOnce(new Error('connection refused'));
    expect(await service.acquireGenerationLock('company1', 'pricing')).toBe(
      true,
    );
  });

  it('drops corrupt entries and treats them as a miss', async () => {
    mockRedis.get.mockResolvedValue('not-json');
    expect(await service.get('company1', 'pricing')).toBeNull();
    expect(mockRedis.del).toHaveBeenCalled();
  });

  it('arms the invalidation counter when caching a path', async () => {
    await service.set('company1', 'pricing', {
      objectionType: 'pricing',
      winningPatterns: [],
      losingPatterns: [],
      playbook: { do: [], dont: [], suggestedScript: '' },
      sampleCounts: { successful: 5, unsuccessful: 5 },
      lastUpdated: new Date().toISOString(),
      cached: false,
    });

    expect(mockRedis.set).toHaveBeenCalledWith(
      'objection_resolution_count:company1:pricing',
      50,
    );
  });

  it('only decrements counters that exist', async () => {
    mockRedis.exists.mockResolvedValue(0);
    await service.recordAnalyzedObjections('company1', ['pricing']);
    expect(mockRedis.decr).not.toHaveBeenCalled();
  });

  it('purges cached paths once the threshold is hit', async () => {
    mockRedis.exists.mockResolvedValue(1);
    mockRedis.decr.mockResolvedValue(0);
    mockRedis.scan.mockResolvedValue([
      '0',
      ['objection_resolution:company1:pricing:2026-W24'],
    ]);

    await service.recordAnalyzedObjections('company1', [
      'pricing',
      'pricing', // duplicate types in one analysis decrement once
    ]);

    expect(mockRedis.decr).toHaveBeenCalledTimes(1);
    expect(mockRedis.del).toHaveBeenCalledWith(
      'objection_resolution:company1:pricing:2026-W24',
    );
    expect(mockRedis.del).toHaveBeenCalledWith(
      'objection_resolution_count:company1:pricing',
    );
  });
});
