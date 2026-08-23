import { Global, Module } from '@nestjs/common';

import { API_CONFIG, readApiConfig } from './api-config';

@Global()
@Module({
  providers: [{ provide: API_CONFIG, useFactory: () => readApiConfig() }],
  exports: [API_CONFIG],
})
export class ConfigModule {}
