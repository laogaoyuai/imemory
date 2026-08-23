import { attachmentKindSchema } from '@atlas/core';
import { z } from 'zod/v3';

export const allowedUploadMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
] as const;

export const uploadPresignRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  mimeType: z.enum(allowedUploadMimeTypes),
  size: z.number().int().positive().max(100 * 1024 * 1024),
  kind: attachmentKindSchema,
});

export type UploadPresignRequest = z.infer<typeof uploadPresignRequestSchema>;

export const uploadPresignResponseSchema = z.object({
  uploadId: z.string().uuid(),
  objectKey: z.string().min(1),
  uploadUrl: z.string().url(),
  publicUrl: z.string().url().nullable(),
  expiresAt: z.string().datetime(),
  headers: z.record(z.string(), z.string()),
});

export type UploadPresignResponse = z.infer<typeof uploadPresignResponseSchema>;
