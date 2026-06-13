import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from '@verity/shared';
import { ComparisonResult, ComparisonResultSchema } from '../../database/schemas';
import { CallsModule } from '../calls/calls.module';
import { FormsModule } from '../forms/forms.module';
import { StorageModule } from '../storage/storage.module';
import { LlmModule } from '../llm/llm.module';
import { ComparisonController } from './comparison.controller';
import { ComparisonService } from './comparison.service';
import { ComparisonRepository } from './comparison.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ComparisonResult.name, schema: ComparisonResultSchema },
    ]),
    BullModule.registerQueue({ name: QUEUES.COMPARE_CALL }),
    CallsModule,
    FormsModule,
    StorageModule,
    LlmModule,
  ],
  controllers: [ComparisonController],
  providers: [ComparisonService, ComparisonRepository],
  exports: [ComparisonService],
})
export class ComparisonModule {}
