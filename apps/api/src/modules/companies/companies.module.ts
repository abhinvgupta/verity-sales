import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Company, CompanySchema } from '../../database/schemas';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CompaniesRepository } from './companies.repository';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Company.name, schema: CompanySchema }]),
  ],
  controllers: [CompaniesController],
  providers: [CompaniesService, CompaniesRepository],
  exports: [CompaniesService],
})
export class CompaniesModule {}
