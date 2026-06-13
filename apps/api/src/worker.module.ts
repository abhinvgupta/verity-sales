import { Module } from '@nestjs/common';
import { InfraModule } from './infra.module';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { ComparisonModule } from './modules/comparison/comparison.module';
import { FormsModule } from './modules/forms/forms.module';
import { AnalysisProcessor } from './modules/analysis/analysis.processor';
import { ComparisonProcessor } from './modules/comparison/comparison.processor';
import { FormsProcessor } from './modules/forms/forms.processor';

/**
 * Root module for the queue-worker process. Imports the feature modules that
 * own the job logic (for their exported services + queue registrations) and
 * declares the BullMQ processors here — the processors live ONLY in this
 * process, so the HTTP API never spins up workers. No controllers or HTTP
 * guards are mounted; the entrypoint runs this as an application context.
 */
@Module({
  imports: [InfraModule, AnalysisModule, ComparisonModule, FormsModule],
  providers: [AnalysisProcessor, ComparisonProcessor, FormsProcessor],
})
export class WorkerModule {}
