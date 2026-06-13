import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from '@verity/shared';
import { RepForm, RepFormSchema } from '../../database/schemas';
import { CallsModule } from '../calls/calls.module';
import { TemplatesModule } from '../templates/templates.module';
import { StorageModule } from '../storage/storage.module';
import { LlmModule } from '../llm/llm.module';
import { FormsController } from './forms.controller';
import { FormsService } from './forms.service';
import { FormsRepository } from './forms.repository';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: RepForm.name, schema: RepFormSchema }]),
    BullModule.registerQueue(
      { name: QUEUES.EXTRACT_FORM },
      { name: QUEUES.COMPARE_CALL },
    ),
    CallsModule,
    TemplatesModule,
    StorageModule,
    LlmModule,
  ],
  controllers: [FormsController],
  providers: [FormsService, FormsRepository],
  exports: [FormsService],
})
export class FormsModule {}
