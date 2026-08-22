import { z } from 'zod';

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
