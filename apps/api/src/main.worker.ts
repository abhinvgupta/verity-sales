import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkerModule } from './worker.module';

/**
 * Entrypoint for the queue-worker process. Runs WorkerModule as a headless
 * application context — no HTTP server — so the only thing it does is consume
 * BullMQ jobs. The BullMQ workers keep the event loop alive; shutdown hooks
 * let SIGTERM drain and close workers cleanly on deploy.
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  Logger.log('Worker process started — consuming queues', 'Worker');
}

void bootstrap();
