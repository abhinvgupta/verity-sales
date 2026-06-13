import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PaginationSchema, PaginationDto } from '../../common/dto/pagination.dto';
import { CompaniesService } from './companies.service';
import { CreateCompanySchema, CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanySchema, UpdateCompanyDto } from './dto/update-company.dto';

@Roles('super_admin')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  create(@Body(new ZodValidationPipe(CreateCompanySchema)) dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  @Get()
  findAll(@Query(new ZodValidationPipe(PaginationSchema)) query: PaginationDto) {
    return this.companiesService.findAll(query.page, query.limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.companiesService.findById(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateCompanySchema)) dto: UpdateCompanyDto,
  ) {
    return this.companiesService.update(id, dto);
  }
}
