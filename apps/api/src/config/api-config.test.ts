import { contentSyncRequestSchema, uploadPresignRequestSchema } from '@atlas/contracts';

import { readApiConfig } from './api-config';

describe('API production configuration', () => {
  it('uses safe local-only adapters in development', () => {
    const config = readApiConfig({});
    expect(config.wechat.mode).toBe('mock');
    expect(config.storage.mode).toBe('disabled');
    expect(config.port).toBe(4000);
    expect(config.logRequests).toBe(false);
    expect(config.rateLimit).toEqual({ windowMs: 60_000, max: 180, authMax: 20 });
  });

  it('rejects production without strong secrets and external services', () => {
    expect(() => readApiConfig({ NODE_ENV: 'production' })).toThrow();
  });

  it('does not allow production to inherit local database or JWT defaults', () => {
    expect(() => readApiConfig({
      NODE_ENV: 'production',
      WECHAT_APP_ID: 'wx-example',
      WECHAT_APP_SECRET: 'wechat-secret',
      STORAGE_MODE: 's3',
      STORAGE_BUCKET: 'atlas-production',
      STORAGE_ACCESS_KEY_ID: 'access-key',
      STORAGE_SECRET_ACCESS_KEY: 'secret-key',
      STORAGE_PUBLIC_BASE_URL: 'https://assets.example.com',
    })).toThrow('DATABASE_URL');
  });

  it('accepts a complete production configuration', () => {
    const config = readApiConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://atlas:secret@database.example.com:5432/atlas',
      JWT_SECRET: 'a-production-secret-that-is-longer-than-32-characters',
      WECHAT_APP_ID: 'wx-example',
      WECHAT_APP_SECRET: 'wechat-secret',
      STORAGE_MODE: 's3',
      STORAGE_REGION: 'auto',
      STORAGE_BUCKET: 'atlas-production',
      STORAGE_ACCESS_KEY_ID: 'access-key',
      STORAGE_SECRET_ACCESS_KEY: 'secret-key',
      STORAGE_PUBLIC_BASE_URL: 'https://assets.example.com',
    });
    expect(config.wechat.mode).toBe('live');
    expect(config.storage.mode).toBe('s3');
    expect(config.logRequests).toBe(true);
    expect(config.contentSecurity.mode).toBe('wechat');
  });

  it('does not allow production content moderation to be disabled', () => {
    expect(() => readApiConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://atlas:secret@database.example.com:5432/atlas',
      JWT_SECRET: 'a-production-secret-that-is-longer-than-32-characters',
      WECHAT_APP_ID: 'wx-example',
      WECHAT_APP_SECRET: 'wechat-secret',
      CONTENT_SECURITY_MODE: 'disabled',
      STORAGE_MODE: 's3',
      STORAGE_BUCKET: 'atlas-production',
      STORAGE_ACCESS_KEY_ID: 'access-key',
      STORAGE_SECRET_ACCESS_KEY: 'secret-key',
      STORAGE_PUBLIC_BASE_URL: 'https://assets.example.com',
    })).toThrow('内容安全');
  });

  it('rejects insecure public origins in production', () => {
    const production = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://atlas:secret@database.example.com:5432/atlas',
      JWT_SECRET: 'a-production-secret-that-is-longer-than-32-characters',
      WECHAT_APP_ID: 'wx-example',
      WECHAT_APP_SECRET: 'wechat-secret',
      STORAGE_MODE: 's3',
      STORAGE_BUCKET: 'atlas-production',
      STORAGE_ACCESS_KEY_ID: 'access-key',
      STORAGE_SECRET_ACCESS_KEY: 'secret-key',
    };
    expect(() => readApiConfig({ ...production, STORAGE_PUBLIC_BASE_URL: 'http://assets.example.com' })).toThrow('HTTPS');
    expect(() => readApiConfig({ ...production, STORAGE_PUBLIC_BASE_URL: 'https://assets.example.com', CORS_ORIGINS: '*' })).toThrow('CORS_ORIGINS');
  });

  it('keeps the authentication limit at or below the global limit', () => {
    expect(() => readApiConfig({ RATE_LIMIT_MAX: '10', AUTH_RATE_LIMIT_MAX: '11' })).toThrow('AUTH_RATE_LIMIT_MAX');
  });

  it('requires a readable asset origin in production', () => {
    expect(() => readApiConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://atlas:secret@database.example.com:5432/atlas',
      JWT_SECRET: 'a-production-secret-that-is-longer-than-32-characters',
      WECHAT_APP_ID: 'wx-example',
      WECHAT_APP_SECRET: 'wechat-secret',
      STORAGE_MODE: 's3',
      STORAGE_BUCKET: 'atlas-production',
      STORAGE_ACCESS_KEY_ID: 'access-key',
      STORAGE_SECRET_ACCESS_KEY: 'secret-key',
    })).toThrow('STORAGE_PUBLIC_BASE_URL');
  });
});

describe('API boundaries', () => {
  it('defaults an empty sync batch', () => {
    expect(contentSyncRequestSchema.parse({})).toEqual({ upserts: [], deletions: [] });
  });

  it('rejects files over the production upload limit', () => {
    expect(uploadPresignRequestSchema.safeParse({
      fileName: 'large.pdf',
      mimeType: 'application/pdf',
      size: 101 * 1024 * 1024,
      kind: 'document',
    }).success).toBe(false);
  });
});
