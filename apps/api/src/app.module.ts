import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { InfraModule } from './infra.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { UsersModule } from './modules/users/users.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { StorageModule } from './modules/storage/storage.module';
import { CallsModule } from './modules/calls/calls.module';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { FormsModule } from './modules/forms/forms.module';
import { ComparisonModule } from './modules/comparison/comparison.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    InfraModule,
    AuthModule,
    CompaniesModule,
    UsersModule,
    TemplatesModule,
    StorageModule,
    CallsModule,
    AnalysisModule,
    FormsModule,
    ComparisonModule,
    AnalyticsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
