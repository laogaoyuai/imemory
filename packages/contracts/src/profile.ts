import { z } from 'zod/v3';

import { publicUserSchema } from './auth';

export const updateProfileRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(40),
  bio: z.string().trim().max(160).default(''),
  avatarUrl: z.string().url().nullable().optional(),
});

export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

export const profileResponseSchema = publicUserSchema;
export type ProfileResponse = z.infer<typeof profileResponseSchema>;

export const userSearchResponseSchema = z.object({ users: z.array(publicUserSchema).max(20) });
export type UserSearchResponse = z.infer<typeof userSearchResponseSchema>;

export const userProfileResponseSchema = z.object({
  user: publicUserSchema,
  followerCount: z.number().int().nonnegative(),
  followingCount: z.number().int().nonnegative(),
  isFollowing: z.boolean(),
});
export type UserProfileResponse = z.infer<typeof userProfileResponseSchema>;
