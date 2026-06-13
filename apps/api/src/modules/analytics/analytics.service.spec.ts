import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsRepository } from './analytics.repository';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let repo: jest.Mocked<AnalyticsRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: AnalyticsRepository,
          useValue: {
            overview: jest.fn(),
            scoreTrend: jest.fn(),
            leaderboard: jest.fn(),
            topIssues: jest.fn(),
            scoreDistribution: jest.fn(),
            compliance: jest.fn(),
            alignmentScatter: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AnalyticsService);
    repo = module.get(AnalyticsRepository);
  });

  describe('overview', () => {
    it('computes complianceRate and scoreDelta vs the previous period', async () => {
      repo.overview
        .mockResolvedValueOnce({
          totalCalls: 10,
          analyzedCalls: 8,
          avgScore: 72.46,
          compliancePassed: 6,
          avgAlignment: 64.2,
        })
        .mockResolvedValueOnce({
          totalCalls: 9,
          analyzedCalls: 7,
          avgScore: 68.2,
          compliancePassed: 5,
          avgAlignment: 61,
        });

      const result = await service.overview('company1', {});

      expect(result.complianceRate).toBe(75);
      expect(result.avgScore).toBe(72.5);
      expect(result.scoreDelta).toBe(4.3);
    });

    it('returns null delta when either period has no scores', async () => {
      repo.overview
        .mockResolvedValueOnce({
          totalCalls: 3,
          analyzedCalls: 2,
          avgScore: 70,
          compliancePassed: 2,
          avgAlignment: null,
        })
        .mockResolvedValueOnce({
          totalCalls: 0,
          analyzedCalls: 0,
          avgScore: null,
          compliancePassed: 0,
          avgAlignment: null,
        });

      const result = await service.overview('company1', {});
      expect(result.scoreDelta).toBeNull();
    });
  });

  describe('scoreTrend', () => {
    it('buckets by week for ranges under 90 days', async () => {
      repo.scoreTrend.mockResolvedValue([]);
      const to = new Date('2026-06-01');
      const from = new Date('2026-05-01');

      const result = await service.scoreTrend('company1', { from, to });

      expect(result.unit).toBe('week');
      expect(repo.scoreTrend).toHaveBeenCalledWith(
        expect.objectContaining({ from, to }),
        'week',
      );
    });

    it('buckets by month for ranges of 90 days or more', async () => {
      repo.scoreTrend.mockResolvedValue([]);
      const to = new Date('2026-06-01');
      const from = new Date('2026-03-01');

      const result = await service.scoreTrend('company1', { from, to });
      expect(result.unit).toBe('month');
    });
  });

  describe('scoreDistribution', () => {
    it('zero-fills all ten buckets', async () => {
      repo.scoreDistribution.mockResolvedValue([
        { from: 70, count: 4 },
        { from: 80, count: 2 },
      ]);

      const result = await service.scoreDistribution('company1', {});

      expect(result).toHaveLength(10);
      expect(result[7]).toEqual({ from: 70, count: 4 });
      expect(result[0]).toEqual({ from: 0, count: 0 });
    });
  });

  describe('repRadar', () => {
    const row = {
      repId: 'rep1',
      repName: 'Priya',
      calls: 10,
      analyzed: 9,
      avgScore: 81.2,
      avgAlignment: 74,
      complianceRate: 90,
      trendDelta: 6.5,
    };

    it('normalizes volume against the busiest rep and centers trend at 50', async () => {
      repo.leaderboard.mockResolvedValue([
        row,
        { ...row, repId: 'rep2', calls: 20 },
      ]);

      const result = await service.repRadar('company1', 'rep1', {});
      const byLabel = Object.fromEntries(
        result.dimensions.map((d) => [d.label, d.value]),
      );

      expect(byLabel.Volume).toBe(50);
      expect(byLabel.Trend).toBe(57);
      expect(byLabel.Score).toBe(81);
    });

    it('throws when the rep has no calls in the period', async () => {
      repo.leaderboard.mockResolvedValue([]);
      await expect(
        service.repRadar('company1', 'ghost', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
