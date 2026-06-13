import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from '@verity/shared';
import { CallAnalysis, CallAnalysisSchema } from '../../database/schemas';
import { CallsModule } from '../calls/calls.module';
import { TemplatesModule } from '../templates/templates.module';
import { StorageModule } from '../storage/storage.module';
import { LlmModule } from '../llm/llm.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import { AnalysisRepository } from './analysis.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CallAnalysis.name, schema: CallAnalysisSchema },
    ]),
    BullModule.registerQueue({ name: QUEUES.ANALYZE_CALL }),
    CallsModule,
    TemplatesModule,
    StorageModule,
    LlmModule,
    AnalyticsModule,
  ],
  controllers: [AnalysisController],
  providers: [AnalysisService, AnalysisRepository],
  exports: [AnalysisService],
})
export class AnalysisModule {}
