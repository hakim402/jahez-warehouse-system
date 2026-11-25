import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from './platform/database.service';

@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  check() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    const readiness = await this.database.checkReadiness();
    if (readiness.status === 'down') {
      throw new ServiceUnavailableException({ status: 'error', database: 'down' });
    }
    return { status: 'ok', database: 'up', latencyMs: readiness.latencyMs };
  }
}
