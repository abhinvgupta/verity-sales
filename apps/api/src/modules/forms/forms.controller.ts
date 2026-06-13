import {
  Controller,
  Get,
  Post,
  Param,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '@verity/shared';
import { FormsService } from './forms.service';

@Controller('calls/:id/form')
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  @Roles('company_admin', 'manager', 'rep')
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser() user: JwtPayload,
    @Param('id') callId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Form image file is required');
    }
    return this.formsService.createFromUpload(callId, user.companyId, file);
  }

  @Roles('company_admin', 'manager', 'rep')
  @Get()
  get(@CurrentUser() user: JwtPayload, @Param('id') callId: string) {
    return this.formsService.getByCallId(callId, user.companyId);
  }
}
