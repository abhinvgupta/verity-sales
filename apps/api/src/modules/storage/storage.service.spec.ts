import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('test-value'),
          },
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  it('builds correct transcript key', () => {
    const key = service.getTranscriptKey('company1', 'call1', 'transcript.txt');
    expect(key).toBe('transcripts/company1/call1/transcript.txt');
  });
});
