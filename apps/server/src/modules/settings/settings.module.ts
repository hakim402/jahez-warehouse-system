import { OwnerGuard } from './owner.guard';
import { Module } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { SettingsController, UsersController } from './settings.controller';
import { SettingsService } from './settings.service';
@Module({ imports: [PlatformModule, TenancyModule], controllers: [SettingsController, UsersController], providers: [SettingsService, OwnerGuard] })
export class SettingsModule {}
