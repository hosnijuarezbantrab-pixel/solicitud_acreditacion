import {
  ExceptionFilter, Catch, ArgumentsHost,
  HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx    = host.switchToHttp();
    const res    = ctx.getResponse<Response>();
    const req    = ctx.getRequest<Request>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const raw = exception instanceof HttpException
      ? exception.getResponse()
      : null;

    const message = raw
      ? ((raw as any)?.message ?? (exception as any)?.message)
      : 'Error interno del servidor';

    if (status >= 500) {
      this.logger.error(
        `[${req.method}] ${req.url} → ${status}`,
        (exception as any)?.stack,
      );
    }

    res.status(status).json({
      ok: false,
      statusCode: status,
      path: req.url,
      timestamp: new Date().toISOString(),
      message: Array.isArray(message) ? message.join('; ') : message,
    });
  }
}
