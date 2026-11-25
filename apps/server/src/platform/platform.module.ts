import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { loadServerConfig, SERVER_CONFIG } from './server-config';

@Module({
  providers: [{ provide: SERVER_CONFIG, useFactory: loadServerConfig }, DatabaseService],
  exports: [SERVER_CONFIG, DatabaseService],
})
export class PlatformModule {}