import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';

describe('UsersService', () => {
  let service: UsersService;
  let repo: jest.Mocked<UsersRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UsersRepository,
          useValue: {
            findByEmail: jest.fn(),
            create: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            deactivate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repo = module.get(UsersRepository);
  });

  it('should be defined', () => expect(service).toBeDefined());

  it('throws ConflictException when email already exists', async () => {
    repo.findByEmail.mockResolvedValue({ email: 'a@b.com' } as never);
    await expect(
      service.create('company1', {
        name: 'Test',
        email: 'a@b.com',
        password: 'pass123',
        role: 'rep',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws NotFoundException when user not found', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.findById('abc', 'company1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
