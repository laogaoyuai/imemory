import { ArgumentsHost, Catch, HttpException, HttpStatus, type ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = exception instanceof HttpException ? exception.getResponse() : null;
    const object = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : {};
    const fallbackMessage = status === 500 ? '服务器内部错误' : String(raw ?? '请求失败');
    response.status(status).json({
      statusCode: status,
      code: typeof object.code === 'string' ? object.code : status === 500 ? 'internal_error' : 'request_failed',
      message: typeof object.message === 'string' ? object.message : fallbackMessage,
      ...(object.details === undefined ? {} : { details: object.details }),
      requestId: request.headers['x-request-id'] || undefined,
    });
  }
}
