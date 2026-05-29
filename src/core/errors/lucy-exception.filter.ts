import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

import { LucyErrorCodes } from './lucy-error-codes';
import { LucyApiError } from './lucy-api.error';

@Catch()
export class LucyExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(LucyExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof LucyApiError) {
      response.status(exception.statusCode).json(exception.toBody());
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = this.httpExceptionBody(exception, status);
      response.status(status).json(body);
      return;
    }

    this.logger.error(exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: LucyErrorCodes.INTERNAL_ERROR,
      message: 'Internal server error',
    });
  }

  private httpExceptionBody(
    exception: HttpException,
    status: number,
  ): Record<string, unknown> {
    const response = exception.getResponse();
    const message =
      typeof response === 'string'
        ? response
        : typeof response === 'object' &&
            response !== null &&
            'message' in response
          ? String((response as { message: unknown }).message)
          : exception.message;

    const error =
      status === HttpStatus.UNAUTHORIZED
        ? LucyErrorCodes.UNAUTHORIZED
        : status === HttpStatus.BAD_REQUEST
          ? LucyErrorCodes.VALIDATION_ERROR
          : LucyErrorCodes.INTERNAL_ERROR;

    return {
      statusCode: status,
      error,
      message: Array.isArray(message) ? message.join(', ') : message,
    };
  }
}
