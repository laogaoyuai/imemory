import { contentItemSchema } from '@atlas/core';
import { z } from 'zod/v3';

export const syncContentItemSchema = z.object({
  item: contentItemSchema,
  revision: z.number().int().positive(),
  serverUpdatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});

export type SyncContentItem = z.infer<typeof syncContentItemSchema>;

const remoteContentItemSchema = contentItemSchema.refine(
  (item) => item.attachments.every((attachment) => /^https?:\/\//i.test(attachment.uri)),
  { message: '同步附件必须先上传到对象存储', path: ['attachments'] },
);

export const contentUpsertSchema = z.object({
  idempotencyKey: z.string().uuid(),
  baseRevision: z.number().int().nonnegative(),
  item: remoteContentItemSchema,
});

export const contentDeletionSchema = z.object({
  idempotencyKey: z.string().uuid(),
  contentId: z.string().min(1).max(128),
  baseRevision: z.number().int().positive(),
});

export const contentSyncRequestSchema = z.object({
  upserts: z.array(contentUpsertSchema).max(100).default([]),
  deletions: z.array(contentDeletionSchema).max(100).default([]),
});

export type ContentSyncRequest = z.infer<typeof contentSyncRequestSchema>;

export const contentConflictSchema = z.object({
  contentId: z.string(),
  reason: z.enum(['revision_conflict', 'not_found', 'ownership_mismatch']),
  server: syncContentItemSchema.nullable(),
});

export type ContentConflict = z.infer<typeof contentConflictSchema>;

export const contentSyncResponseSchema = z.object({
  accepted: z.array(syncContentItemSchema),
  conflicts: z.array(contentConflictSchema),
  serverTime: z.string().datetime(),
});

export type ContentSyncResponse = z.infer<typeof contentSyncResponseSchema>;

export const contentListResponseSchema = z.object({
  items: z.array(syncContentItemSchema),
  serverTime: z.string().datetime(),
});

export type ContentListResponse = z.infer<typeof contentListResponseSchema>;
