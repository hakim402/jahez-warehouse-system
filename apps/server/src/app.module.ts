import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { TenancyModule } from './modules/tenancy/tenancy.module';
import { PlatformModule } from './platform/platform.module';

@Module({ imports: [PlatformModule, TenancyModule, AuthModule], controllers: [HealthController] })
export class AppModule {}
