import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'atlas-api',
      version: '0.0.2',
      time: new Date().toISOString(),
    };
  }
}
