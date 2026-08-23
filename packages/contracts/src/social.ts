import { contentCommentSchema } from '@atlas/core';
import { z } from 'zod/v3';

import { syncContentItemSchema } from './content-sync';

export const sharedContentResponseSchema = z.object({ content: syncContentItemSchema });
export type SharedContentResponse = z.infer<typeof sharedContentResponseSchema>;

export const commentListResponseSchema = z.object({ comments: z.array(contentCommentSchema) });
export type CommentListResponse = z.infer<typeof commentListResponseSchema>;

export const createCommentRequestSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  replyToId: z.string().uuid().nullable().default(null),
});
export type CreateCommentRequest = z.infer<typeof createCommentRequestSchema>;

export const createCommentResponseSchema = z.object({
  comment: contentCommentSchema,
  content: syncContentItemSchema,
});
export type CreateCommentResponse = z.infer<typeof createCommentResponseSchema>;

export const commentMutationResponseSchema = z.object({ comment: contentCommentSchema });
export type CommentMutationResponse = z.infer<typeof commentMutationResponseSchema>;

export const shareContentResponseSchema = z.object({ content: syncContentItemSchema });
export type ShareContentResponse = z.infer<typeof shareContentResponseSchema>;
