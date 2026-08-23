import { z } from 'zod/v3';

import type { ContentItem } from './content';

export const collectionTypeSchema = z.enum(['note', 'sticker', 'article', 'video', 'audio']);
export type CollectionType = z.infer<typeof collectionTypeSchema>;

export const contentCollectionSchema = z.object({
  id: z.string().min(1),
  ownerName: z.string().trim().min(1).max(40).default('我'),
  name: z.string().trim().min(1).max(80),
  description: z.string().max(240).default(''),
  coverUri: z.string().nullable().default(null),
  type: collectionTypeSchema,
  contentIds: z.array(z.string().min(1)).max(500).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ContentCollection = z.infer<typeof contentCollectionSchema>;

export function canAddToCollection(type: CollectionType, item: ContentItem): boolean {
  return item.kind === type && item.projectIds.length === 0;
}

export function normalizeCollectionContentIds(contentIds: readonly string[]): string[] {
  return [...new Set(contentIds.map((contentId) => contentId.trim()).filter(Boolean))].slice(0, 500);
}

export function moveCollectionContent(
  contentIds: readonly string[],
  index: number,
  direction: -1 | 1,
): string[] {
  const target = index + direction;
  if (index < 0 || index >= contentIds.length || target < 0 || target >= contentIds.length) return [...contentIds];
  const next = [...contentIds];
  const currentId = next[index];
  const targetId = next[target];
  if (!currentId || !targetId) return next;
  next[index] = targetId;
  next[target] = currentId;
  return next;
}
