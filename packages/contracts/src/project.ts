import { contentItemSchema, projectRoleSchema } from '@atlas/core';
import { z } from 'zod/v3';

import { publicUserSchema } from './auth';

export const projectStatsSchema = z.object({
  admins: z.number().int().nonnegative(),
  members: z.number().int().nonnegative(),
  followers: z.number().int().nonnegative(),
  contents: z.number().int().nonnegative(),
});

export const projectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  description: z.string().max(500),
  avatarUrl: z.string().url().nullable(),
  isPublic: z.boolean(),
  owner: publicUserSchema,
  currentRole: projectRoleSchema.nullable(),
  stats: projectStatsSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Project = z.infer<typeof projectSchema>;

export const projectMemberSchema = z.object({
  user: publicUserSchema,
  role: projectRoleSchema,
  joinedAt: z.string().datetime(),
});

export type ProjectMember = z.infer<typeof projectMemberSchema>;

export const projectListResponseSchema = z.object({ projects: z.array(projectSchema) });
export type ProjectListResponse = z.infer<typeof projectListResponseSchema>;

export const projectDetailResponseSchema = z.object({
  project: projectSchema,
  members: z.array(projectMemberSchema),
  contents: z.array(contentItemSchema),
});
export type ProjectDetailResponse = z.infer<typeof projectDetailResponseSchema>;

export const createProjectRequestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).default(''),
  avatarUrl: z.string().url().nullable().optional(),
  isPublic: z.boolean().default(false),
});
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;

export const updateProjectRequestSchema = createProjectRequestSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: '至少提供一个修改字段' },
);
export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>;

export const changeProjectRoleRequestSchema = z.object({ role: projectRoleSchema });
export type ChangeProjectRoleRequest = z.infer<typeof changeProjectRoleRequestSchema>;

export const addProjectMemberRequestSchema = z.object({ userId: z.string().uuid() });
export type AddProjectMemberRequest = z.infer<typeof addProjectMemberRequestSchema>;
