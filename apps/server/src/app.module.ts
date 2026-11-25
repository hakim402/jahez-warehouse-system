import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PlatformModule } from './platform/platform.module';

@Module({ imports: [PlatformModule], controllers: [HealthController] })
export class AppModule {}
