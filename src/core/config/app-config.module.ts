import { Global, Module } from '@nestjs/common';

import { loadLucyConfig, type LucyConfig } from './lucy-config';

export const LUCY_CONFIG = Symbol('LUCY_CONFIG');

@Global()
@Module({
  providers: [
    {
      provide: LUCY_CONFIG,
      useFactory: (): LucyConfig => loadLucyConfig(),
    },
  ],
  exports: [LUCY_CONFIG],
})
export class AppConfigModule {}
