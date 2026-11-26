import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RealtimeService } from './modules/realtime/realtime.service';
import { SERVER_CONFIG, ServerConfig } from './platform/server-config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ServerConfig>(SERVER_CONFIG);
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();
  app.get(RealtimeService).attach(app.getHttpServer());
  await app.listen(config.port);
}

void bootstrap().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
