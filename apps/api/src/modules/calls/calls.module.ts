import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from '@verity/shared';
import { Call, CallSchema } from '../../database/schemas';
import { StorageModule } from '../storage/storage.module';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';
import { CallsRepository } from './calls.repository';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Call.name, schema: CallSchema }]),
    BullModule.registerQueue({ name: QUEUES.ANALYZE_CALL }),
    StorageModule,
  ],
  controllers: [CallsController],
  providers: [CallsService, CallsRepository],
  exports: [CallsService],
})
export class CallsModule {}
