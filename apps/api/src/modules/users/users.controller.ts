import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PaginationSchema, PaginationDto } from '../../common/dto/pagination.dto';
import { JwtPayload } from '@verity/shared';
import { UsersService } from './users.service';
import { CreateUserSchema, CreateUserDto } from './dto/create-user.dto';
import { UpdateUserSchema, UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles('company_admin')
  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(CreateUserSchema)) dto: CreateUserDto,
  ) {
    return this.usersService.create(user.companyId, dto);
  }

  @Roles('company_admin', 'manager')
  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(PaginationSchema)) query: PaginationDto,
  ) {
    return this.usersService.findAll(user.companyId, query.page, query.limit);
  }

  @Roles('company_admin', 'manager')
  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.usersService.findById(id, user.companyId);
  }

  @Roles('company_admin')
  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateUserSchema)) dto: UpdateUserDto,
  ) {
    return this.usersService.update(id, user.companyId, dto);
  }

  @Roles('company_admin')
  @Delete(':id')
  deactivate(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.usersService.deactivate(id, user.companyId);
  }
}
