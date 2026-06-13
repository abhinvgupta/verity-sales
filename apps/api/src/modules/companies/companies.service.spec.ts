import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CompaniesRepository } from './companies.repository';

describe('CompaniesService', () => {
  let service: CompaniesService;
  let repo: jest.Mocked<CompaniesRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        {
          provide: CompaniesRepository,
          useValue: {
            findBySlug: jest.fn(),
            create: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);
    repo = module.get(CompaniesRepository);
  });

  it('should be defined', () => expect(service).toBeDefined());

  it('throws ConflictException when slug is taken', async () => {
    repo.findBySlug.mockResolvedValue({ slug: 'acme' } as never);
    await expect(
      service.create({ name: 'Acme', slug: 'acme', plan: 'starter' }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws NotFoundException when company not found', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.findById('abc')).rejects.toThrow(NotFoundException);
  });
});
