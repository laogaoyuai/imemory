import { z } from 'zod';

const rawConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  DATABASE_URL: z.string().min(1).default('postgresql://atlas:atlas@127.0.0.1:5432/atlas?schema=public'),
  JWT_SECRET: z.string().min(16).default('atlas-development-secret-change-me'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  CORS_ORIGINS: z.string().default(''),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  REQUEST_BODY_LIMIT_BYTES: z.coerce.number().int().min(16_384).max(10 * 1024 * 1024).default(1024 * 1024),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(10).max(3600).default(60),
  RATE_LIMIT_MAX: z.coerce.number().int().min(10).max(10_000).default(180),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(3).max(1000).default(20),
  LOG_REQUESTS: z.enum(['true', 'false']).optional(),
  WECHAT_AUTH_MODE: z.enum(['live', 'mock']).optional(),
  WECHAT_APP_ID: z.string().optional(),
  WECHAT_APP_SECRET: z.string().optional(),
  CONTENT_SECURITY_MODE: z.enum(['wechat', 'disabled']).optional(),
  WECHAT_SECURITY_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30_000).default(8000),
  STORAGE_MODE: z.enum(['s3', 'disabled']).default('disabled'),
  STORAGE_REGION: z.string().default('auto'),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_ENDPOINT: z.string().url().optional().or(z.literal('')),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  STORAGE_PUBLIC_BASE_URL: z.string().url().optional().or(z.literal('')),
  STORAGE_FORCE_PATH_STYLE: z.string().default('false'),
});

export interface ApiConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
  corsOrigins: string[];
  trustProxy: boolean;
  requestBodyLimitBytes: number;
  rateLimit: {
    windowMs: number;
    max: number;
    authMax: number;
  };
  logRequests: boolean;
  wechat: {
    mode: 'live' | 'mock';
    appId: string | null;
    appSecret: string | null;
  };
  contentSecurity: {
    mode: 'wechat' | 'disabled';
    timeoutMs: number;
  };
  storage: {
    mode: 's3' | 'disabled';
    region: string;
    bucket: string | null;
    endpoint: string | null;
    accessKeyId: string | null;
    secretAccessKey: string | null;
    publicBaseUrl: string | null;
    forcePathStyle: boolean;
  };
}

export const API_CONFIG = Symbol('API_CONFIG');

export function readApiConfig(source: NodeJS.ProcessEnv = process.env): ApiConfig {
  const raw = rawConfigSchema.parse(source);
  const wechatMode = raw.WECHAT_AUTH_MODE ?? (raw.NODE_ENV === 'production' ? 'live' : 'mock');
  const contentSecurityMode = raw.CONTENT_SECURITY_MODE ?? (raw.NODE_ENV === 'production' ? 'wechat' : 'disabled');
  if (raw.NODE_ENV === 'production' && !source.DATABASE_URL) {
    throw new Error('生产环境必须显式配置 DATABASE_URL');
  }
  if (raw.NODE_ENV === 'production' && (!source.JWT_SECRET || raw.JWT_SECRET.length < 32)) {
    throw new Error('生产环境 JWT_SECRET 至少需要 32 个字符');
  }
  if (wechatMode === 'live' && (!raw.WECHAT_APP_ID || !raw.WECHAT_APP_SECRET)) {
    throw new Error('微信正式登录需要 WECHAT_APP_ID 和 WECHAT_APP_SECRET');
  }
  if (raw.NODE_ENV === 'production' && contentSecurityMode !== 'wechat') {
    throw new Error('生产环境必须启用微信内容安全检查');
  }
  if (raw.NODE_ENV === 'production' && raw.STORAGE_MODE !== 's3') {
    throw new Error('生产环境必须配置 S3 兼容对象存储');
  }
  if (raw.STORAGE_MODE === 's3' && (!raw.STORAGE_BUCKET || !raw.STORAGE_ACCESS_KEY_ID || !raw.STORAGE_SECRET_ACCESS_KEY)) {
    throw new Error('S3 存储需要 bucket 和访问凭证');
  }
  if (raw.NODE_ENV === 'production' && !raw.STORAGE_PUBLIC_BASE_URL) {
    throw new Error('生产环境必须配置 STORAGE_PUBLIC_BASE_URL');
  }
  if (raw.NODE_ENV === 'production' && raw.STORAGE_PUBLIC_BASE_URL && !raw.STORAGE_PUBLIC_BASE_URL.startsWith('https://')) {
    throw new Error('生产环境 STORAGE_PUBLIC_BASE_URL 必须使用 HTTPS');
  }
  const corsOrigins = raw.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);
  if (raw.NODE_ENV === 'production' && corsOrigins.some((origin) => origin === '*' || !origin.startsWith('https://'))) {
    throw new Error('生产环境 CORS_ORIGINS 只允许明确的 HTTPS 来源');
  }
  if (raw.AUTH_RATE_LIMIT_MAX > raw.RATE_LIMIT_MAX) {
    throw new Error('AUTH_RATE_LIMIT_MAX 不能大于 RATE_LIMIT_MAX');
  }
  return {
    nodeEnv: raw.NODE_ENV,
    port: raw.PORT,
    databaseUrl: raw.DATABASE_URL,
    jwtSecret: raw.JWT_SECRET,
    accessTokenTtlSeconds: raw.ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlDays: raw.REFRESH_TOKEN_TTL_DAYS,
    corsOrigins,
    trustProxy: raw.TRUST_PROXY === 'true',
    requestBodyLimitBytes: raw.REQUEST_BODY_LIMIT_BYTES,
    rateLimit: {
      windowMs: raw.RATE_LIMIT_WINDOW_SECONDS * 1000,
      max: raw.RATE_LIMIT_MAX,
      authMax: raw.AUTH_RATE_LIMIT_MAX,
    },
    logRequests: raw.LOG_REQUESTS ? raw.LOG_REQUESTS === 'true' : raw.NODE_ENV === 'production',
    wechat: {
      mode: wechatMode,
      appId: raw.WECHAT_APP_ID || null,
      appSecret: raw.WECHAT_APP_SECRET || null,
    },
    contentSecurity: {
      mode: contentSecurityMode,
      timeoutMs: raw.WECHAT_SECURITY_TIMEOUT_MS,
    },
    storage: {
      mode: raw.STORAGE_MODE,
      region: raw.STORAGE_REGION,
      bucket: raw.STORAGE_BUCKET || null,
      endpoint: raw.STORAGE_ENDPOINT || null,
      accessKeyId: raw.STORAGE_ACCESS_KEY_ID || null,
      secretAccessKey: raw.STORAGE_SECRET_ACCESS_KEY || null,
      publicBaseUrl: raw.STORAGE_PUBLIC_BASE_URL || null,
      forcePathStyle: raw.STORAGE_FORCE_PATH_STYLE === 'true',
    },
  };
}
