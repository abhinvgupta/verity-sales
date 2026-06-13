import { Controller, Get, Param } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '@verity/shared';
import { ComparisonService } from './comparison.service';

@Controller('calls')
export class ComparisonController {
  constructor(private readonly comparisonService: ComparisonService) {}

  @Roles('company_admin', 'manager', 'rep')
  @Get(':id/comparison')
  getComparison(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.comparisonService.getByCallId(id, user.companyId);
  }
}
