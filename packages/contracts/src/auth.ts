import { z } from 'zod/v3';

export const publicUserSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().trim().min(1).max(40),
  avatarUrl: z.string().url().nullable(),
  bio: z.string().max(160).default(''),
  createdAt: z.string().datetime(),
});

export type PublicUser = z.infer<typeof publicUserSchema>;

export const wechatLoginRequestSchema = z.object({
  code: z.string().trim().min(1).max(256),
  displayName: z.string().trim().min(1).max(40).optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

export type WechatLoginRequest = z.infer<typeof wechatLoginRequestSchema>;

export const refreshSessionRequestSchema = z.object({
  refreshToken: z.string().min(32).max(512),
});

export type RefreshSessionRequest = z.infer<typeof refreshSessionRequestSchema>;

export const authSessionSchema = z.object({
  accessToken: z.string().min(1),
  accessTokenExpiresAt: z.string().datetime(),
  refreshToken: z.string().min(32),
  refreshTokenExpiresAt: z.string().datetime(),
  user: publicUserSchema,
});

export type AuthSession = z.infer<typeof authSessionSchema>;
