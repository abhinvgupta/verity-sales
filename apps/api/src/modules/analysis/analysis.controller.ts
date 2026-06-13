import { Controller, Get, Param } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '@verity/shared';
import { AnalysisService } from './analysis.service';

@Controller('calls')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Roles('company_admin', 'manager', 'rep')
  @Get(':id/analysis')
  getAnalysis(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.analysisService.getByCallId(id, user.companyId);
  }
}
