import { Controller, Get, Inject } from '@nestjs/common';

import { LUCY_CONFIG } from '../core/config/app-config.module';
import type { LucyConfig } from '../core/config/lucy-config';
import { describeDevStack } from '../core/config/lucy-dev-stack';

@Controller('health')
export class HealthController {
  constructor(@Inject(LUCY_CONFIG) private readonly config: LucyConfig) {}

  @Get()
  check() {
    const payload: Record<string, unknown> = {
      status: 'ok',
      service: 'lucy-backend',
    };

    if (this.config.nodeEnv !== 'production') {
      payload.dev = describeDevStack(this.config);
    }

    return payload;
  }
}
