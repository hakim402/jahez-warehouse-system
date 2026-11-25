import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { TenancyModule } from './modules/tenancy/tenancy.module';
import { PlatformModule } from './platform/platform.module';

@Module({ imports: [PlatformModule, TenancyModule], controllers: [HealthController] })
export class AppModule {}
