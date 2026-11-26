import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { loadServerConfig, SERVER_CONFIG } from './server-config';
import { StorageService } from './storage.service';

@Module({
  providers: [{ provide: SERVER_CONFIG, useFactory: loadServerConfig }, DatabaseService, StorageService],
  exports: [SERVER_CONFIG, DatabaseService, StorageService],
})
export class PlatformModule {}