import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LlmService } from './llm.service';
import { PromptBuilderService } from './prompt-builder.service';

@Module({
  imports: [ConfigModule],
  providers: [LlmService, PromptBuilderService],
  exports: [LlmService, PromptBuilderService],
})
export class LlmModule {}
