import { normalizeRequestId, RequestRateLimiter } from './request-security';

describe('request security', () => {
  it('keeps a valid caller request id and replaces unsafe values', () => {
    expect(normalizeRequestId('mini-01:request_9')).toBe('mini-01:request_9');
    expect(normalizeRequestId('bad value')).toMatch(/^[0-9a-f-]{36}$/);
    expect(normalizeRequestId(undefined)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('enforces a fixed-window request limit and resets after the window', () => {
    const limiter = new RequestRateLimiter(60_000);
    expect(limiter.take('auth:127.0.0.1', 2, 1000)).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.take('auth:127.0.0.1', 2, 2000)).toMatchObject({ allowed: true, remaining: 0 });
    expect(limiter.take('auth:127.0.0.1', 2, 3000)).toMatchObject({ allowed: false, remaining: 0 });
    expect(limiter.take('auth:127.0.0.1', 2, 61_000)).toMatchObject({ allowed: true, remaining: 1 });
  });
});
