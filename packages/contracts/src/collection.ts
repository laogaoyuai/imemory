import { collectionTypeSchema, contentCollectionSchema, contentItemSchema } from '@atlas/core';
import { z } from 'zod/v3';

export const collectionListResponseSchema = z.object({ collections: z.array(contentCollectionSchema) });
export type CollectionListResponse = z.infer<typeof collectionListResponseSchema>;

export const collectionDetailResponseSchema = z.object({
  collection: contentCollectionSchema,
  contents: z.array(contentItemSchema),
});
export type CollectionDetailResponse = z.infer<typeof collectionDetailResponseSchema>;

export const createCollectionRequestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240).default(''),
  coverUri: z.string().url().nullable().default(null),
  type: collectionTypeSchema,
});
export type CreateCollectionRequest = z.infer<typeof createCollectionRequestSchema>;

export const updateCollectionRequestSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(240).optional(),
  coverUri: z.string().url().nullable().optional(),
  type: collectionTypeSchema.optional(),
  contentIds: z.array(z.string().min(1).max(128)).max(500).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: '至少提供一个修改字段' });
export type UpdateCollectionRequest = z.infer<typeof updateCollectionRequestSchema>;
