import { z } from 'zod/v3';

export const apiErrorSchema = z.object({
  statusCode: z.number().int(),
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.unknown().optional(),
  requestId: z.string().optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export const apiPaths = {
  health: '/health',
  wechatLogin: '/auth/wechat',
  refreshSession: '/auth/refresh',
  contents: '/contents',
  contentSync: '/contents/sync',
  uploadPresign: '/uploads/presign',
  profile: '/profile',
  projects: '/projects',
  users: '/users',
  collections: '/collections',
} as const;
