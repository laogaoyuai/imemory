import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { ContentSafetyInterceptor } from './content-safety.interceptor';
import { ContentSafetyService } from './content-safety.service';

@Global()
@Module({
  providers: [
    ContentSafetyService,
    { provide: APP_INTERCEPTOR, useClass: ContentSafetyInterceptor },
  ],
  exports: [ContentSafetyService],
})
export class SecurityModule {}
