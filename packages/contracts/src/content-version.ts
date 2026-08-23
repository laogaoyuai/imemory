import { contentItemSchema } from '@atlas/core';
import { z } from 'zod/v3';

import { publicUserSchema } from './auth';
import { syncContentItemSchema } from './content-sync';

export const contentVersionStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type ContentVersionStatus = z.infer<typeof contentVersionStatusSchema>;

export const apiContentVersionSchema = z.object({
  id: z.string().uuid(),
  contentId: z.string().min(1).max(128),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  status: contentVersionStatusSchema,
  snapshot: contentItemSchema,
  submittedBy: publicUserSchema,
  submittedAt: z.string().datetime(),
  reviewedBy: publicUserSchema.nullable(),
  reviewedAt: z.string().datetime().nullable(),
});
export type ApiContentVersion = z.infer<typeof apiContentVersionSchema>;

export const contentVersionListResponseSchema = z.object({
  versions: z.array(apiContentVersionSchema),
  currentVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  permissions: z.object({
    canEdit: z.boolean(),
    canReview: z.boolean(),
    canRollback: z.boolean(),
  }),
});
export type ContentVersionListResponse = z.infer<typeof contentVersionListResponseSchema>;

export const createContentVersionRequestSchema = z.object({
  snapshot: contentItemSchema,
  version: z.string().regex(/^\d+\.\d+\.\d+$/).optional(),
});
export type CreateContentVersionRequest = z.infer<typeof createContentVersionRequestSchema>;

export const reviewContentVersionRequestSchema = z.object({
  status: z.enum(['approved', 'rejected']),
});
export type ReviewContentVersionRequest = z.infer<typeof reviewContentVersionRequestSchema>;

export const contentVersionMutationResponseSchema = z.object({
  content: syncContentItemSchema,
  version: apiContentVersionSchema,
});
export type ContentVersionMutationResponse = z.infer<typeof contentVersionMutationResponseSchema>;

export const contentRollbackResponseSchema = z.object({ content: syncContentItemSchema });
export type ContentRollbackResponse = z.infer<typeof contentRollbackResponseSchema>;
