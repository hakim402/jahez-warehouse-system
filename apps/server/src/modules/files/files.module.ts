import { Module } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  imports: [PlatformModule, TenancyModule],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}