import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import type { ApiConfig } from '../config/api-config';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

export class RequestRateLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>();
  private calls = 0;

  constructor(private readonly windowMs: number) {}

  take(key: string, limit: number, now = Date.now()): RateLimitResult {
    this.calls += 1;
    if (this.calls % 1000 === 0) this.sweep(now);
    const current = this.buckets.get(key);
    const bucket = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + this.windowMs }
      : current;
    bucket.count += 1;
    this.buckets.set(key, bucket);
    return {
      allowed: bucket.count <= limit,
      remaining: Math.max(0, limit - bucket.count),
      resetAt: bucket.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  private sweep(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}

export function normalizeRequestId(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && /^[A-Za-z0-9._:-]{8,128}$/.test(candidate) ? candidate : randomUUID();
}

export function createRequestSecurityMiddleware(config: ApiConfig): RequestHandler {
  const limiter = new RequestRateLimiter(config.rateLimit.windowMs);
  const logger = new Logger('HTTP');
  return (request: Request, response: Response, next: NextFunction): void => {
    const startedAt = Date.now();
    const requestId = normalizeRequestId(request.headers['x-request-id']);
    request.headers['x-request-id'] = requestId;
    response.setHeader('X-Request-Id', requestId);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.setHeader('Cache-Control', 'no-store');

    const identity = request.ip || request.socket.remoteAddress || 'unknown';
    if (config.logRequests) {
      response.once('finish', () => {
        logger.log(JSON.stringify({
          requestId,
          method: request.method,
          path: request.originalUrl.split('?')[0],
          statusCode: response.statusCode,
          durationMs: Date.now() - startedAt,
          ip: identity,
        }));
      });
    }

    const authRequest = /^\/api\/v1\/auth\/(wechat|refresh)(?:\/|$)/.test(request.path);
    const limit = authRequest ? config.rateLimit.authMax : config.rateLimit.max;
    const result = limiter.take(`${authRequest ? 'auth' : 'global'}:${identity}`, limit);
    response.setHeader('X-RateLimit-Limit', String(limit));
    response.setHeader('X-RateLimit-Remaining', String(result.remaining));
    response.setHeader('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));
    if (!result.allowed) {
      response.setHeader('Retry-After', String(result.retryAfterSeconds));
      response.status(429).json({
        statusCode: 429,
        code: 'rate_limit_exceeded',
        message: '请求过于频繁，请稍后重试',
        requestId,
      });
      return;
    }

    next();
  };
}
