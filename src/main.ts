import 'dotenv/config';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { LucyExceptionFilter } from './core/errors/lucy-exception.filter';
import { buildCorsOptions } from './core/config/lucy-cors';
import { describeDevStack, isLocalDevStackReady } from './core/config/lucy-dev-stack';
import { loadLucyConfig, validateLucyConfig } from './core/config/lucy-config';

async function bootstrap() {
  const config = loadLucyConfig();
  validateLucyConfig(config);
  const app = await NestFactory.create(AppModule);
  app.enableCors(buildCorsOptions(config.corsAllowedOrigins));
  app.setGlobalPrefix('v1', { exclude: ['health'] });
  app.useGlobalFilters(new LucyExceptionFilter());
  const port = config.port;
  await app.listen(port);
  Logger.log(`Lucy API listening on http://localhost:${port}`, 'Bootstrap');

  if (isLocalDevStackReady(config)) {
    Logger.log(
      'Local dev stack active (mock LLM, dev auth, in-memory Firestore). Use Bearer dev:<uid>.',
      'Bootstrap',
    );
  } else if (config.nodeEnv !== 'production') {
    Logger.log(`Dev config: ${JSON.stringify(describeDevStack(config))}`, 'Bootstrap');
  }
}

void bootstrap();
