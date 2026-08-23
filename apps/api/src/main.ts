import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json } from 'express';

import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { createRequestSecurityMiddleware } from './common/request-security';
import { readApiConfig } from './config/api-config';

async function bootstrap(): Promise<void> {
  const config = readApiConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use(createRequestSecurityMiddleware(config));
  app.use(json({ limit: config.requestBodyLimitBytes }));
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();
  if (config.corsOrigins.length > 0) {
    app.enableCors({ origin: config.corsOrigins, credentials: true });
  }
  await app.listen(config.port, '0.0.0.0');
}

void bootstrap();
