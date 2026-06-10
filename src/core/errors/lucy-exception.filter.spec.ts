import type { ArgumentsHost } from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';

import { LucyErrorCodes } from './lucy-error-codes';
import { LucyApiError } from './lucy-api.error';
import { LucyExceptionFilter } from './lucy-exception.filter';

function createHost(): {
  host: ArgumentsHost;
  json: jest.Mock;
  status: jest.Mock;
} {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
    }),
  } as ArgumentsHost;
  return { host, json, status };
}

describe('LucyExceptionFilter', () => {
  const filter = new LucyExceptionFilter();

  it('maps LucyApiError to structured JSON body', () => {
    const { host, json, status } = createHost();
    const error = new LucyApiError(
      403,
      LucyErrorCodes.ONBOARDING_ALREADY_COMPLETE,
      'Already done',
    );

    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      statusCode: 403,
      error: LucyErrorCodes.ONBOARDING_ALREADY_COMPLETE,
      message: 'Already done',
    });
  });

  it('maps HttpException 401 to UNAUTHORIZED', () => {
    const { host, json, status } = createHost();
    filter.catch(
      new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED),
      host,
    );

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        error: LucyErrorCodes.UNAUTHORIZED,
      }),
    );
  });
});
