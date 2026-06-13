import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Call,
  CallSchema,
  CallAnalysis,
  CallAnalysisSchema,
  LlmDebugLog,
  LlmDebugLogSchema,
} from '../../database/schemas';
import { LlmModule } from '../llm/llm.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsRepository } from './analytics.repository';
import { ObjectionsService } from './objections.service';
import { ObjectionCacheService } from './objection-cache.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Call.name, schema: CallSchema },
      { name: CallAnalysis.name, schema: CallAnalysisSchema },
      { name: LlmDebugLog.name, schema: LlmDebugLogSchema },
    ]),
    LlmModule,
  ],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    AnalyticsRepository,
    ObjectionsService,
    ObjectionCacheService,
  ],
  // ObjectionCacheService is exported so the analysis pipeline can age out
  // cached resolution paths as new objection data lands.
  exports: [ObjectionCacheService],
})
export class AnalyticsModule {}
