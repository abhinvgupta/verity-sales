import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EvaluationTemplate, EvaluationTemplateSchema } from '../../database/schemas';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';
import { TemplatesRepository } from './templates.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EvaluationTemplate.name, schema: EvaluationTemplateSchema },
    ]),
  ],
  controllers: [TemplatesController],
  providers: [TemplatesService, TemplatesRepository],
  exports: [TemplatesService],
})
export class TemplatesModule {}
