import { z } from 'zod';

export const contentCommentSchema = z.object({
  id: z.string().min(1),
  contentId: z.string().min(1),
  authorName: z.string().trim().min(1).max(40),
  body: z.string().trim().min(1).max(2000),
  createdAt: z.string().datetime(),
  replyToId: z.string().nullable().default(null),
  replyToAuthorName: z.string().nullable().default(null),
  replyToBody: z.string().nullable().default(null),
  isLiked: z.boolean().default(false),
  likeCount: z.number().int().nonnegative().default(0),
});

export type ContentComment = z.infer<typeof contentCommentSchema>;
