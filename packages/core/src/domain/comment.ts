import { z } from 'zod/v3';

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

export function selectCommentHighlights(comments: readonly ContentComment[], limit = 5): ContentComment[] {
  if (limit <= 0) return [];
  const liked = [...comments]
    .filter((comment) => comment.likeCount > 0)
    .sort((left, right) => right.likeCount - left.likeCount || left.createdAt.localeCompare(right.createdAt))
    .slice(0, 3);
  const selected = new Set(liked.map((comment) => comment.id));
  const earliest = [...comments]
    .filter((comment) => !selected.has(comment.id))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  return [...liked, ...earliest].slice(0, limit);
}
