import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtPayload } from '@verity/shared';
import { CallsService } from './calls.service';
import { CreateCallSchema, CreateCallDto } from './dto/create-call.dto';
import { ListCallsSchema, ListCallsDto } from './dto/list-calls.dto';

@Controller('calls')
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @Roles('company_admin', 'manager', 'rep')
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(CreateCallSchema)) dto: CreateCallDto,
  ) {
    return this.callsService.create(user.companyId, dto);
  }

  @Roles('company_admin', 'manager', 'rep')
  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(ListCallsSchema)) query: ListCallsDto,
  ) {
    return this.callsService.findAll(user.companyId, query);
  }

  @Roles('company_admin', 'manager', 'rep')
  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.callsService.findById(id, user.companyId);
  }

  @Roles('company_admin', 'manager')
  @Post(':id/analysis/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  retryAnalysis(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.callsService.retryAnalysis(user.companyId, id);
  }
}
