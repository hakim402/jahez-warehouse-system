import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { JobsService } from './modules/jobs/jobs.service';
import { DatabaseService } from './platform/database.service';

async function bootstrap() {
  const worker = await NestFactory.createApplicationContext(AppModule);
  try {
    worker.enableShutdownHooks();
    const readiness = await worker.get(DatabaseService).checkReadiness();
    if (readiness.status === 'down') {
      throw new Error('PostgreSQL readiness check failed');
    }
    // Begin consuming registered job queues (Excel exports now; invoice ingestion in a later step).
    await worker.get(JobsService).startConsuming();
  } catch (error) {
    await worker.close();
    throw error;
  }
}

void bootstrap().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
