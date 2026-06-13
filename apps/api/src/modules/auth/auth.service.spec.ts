import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';

describe('AuthService', () => {
  let service: AuthService;
  let authRepo: jest.Mocked<AuthRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: AuthRepository,
          useValue: { findByEmail: jest.fn() },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('token') },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    authRepo = module.get(AuthRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('throws UnauthorizedException when user not found', async () => {
    authRepo.findByEmail.mockResolvedValue(null);
    await expect(
      service.login({ email: 'a@b.com', password: 'pass' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
