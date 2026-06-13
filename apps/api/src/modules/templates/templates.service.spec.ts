import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { TemplatesRepository } from './templates.repository';

describe('TemplatesService', () => {
  let service: TemplatesService;
  let repo: jest.Mocked<TemplatesRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplatesService,
        {
          provide: TemplatesRepository,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findActive: jest.fn(),
            findById: jest.fn(),
            deactivateAll: jest.fn(),
            activate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TemplatesService>(TemplatesService);
    repo = module.get(TemplatesRepository);
  });

  it('should be defined', () => expect(service).toBeDefined());

  it('throws NotFoundException when no active template', async () => {
    repo.findActive.mockResolvedValue(null);
    await expect(service.findActive('company1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws NotFoundException when activating non-existent template', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.activate('abc', 'company1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
