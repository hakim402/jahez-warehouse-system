import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SERVER_CONFIG, ServerConfig } from './platform/server-config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ServerConfig>(SERVER_CONFIG);
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();
  await app.listen(config.port);
}

void bootstrap().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
