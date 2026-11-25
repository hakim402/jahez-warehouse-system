import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const worker = await NestFactory.createApplicationContext(AppModule);
  worker.enableShutdownHooks();
}

void bootstrap();
