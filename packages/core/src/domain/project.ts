import { z } from 'zod/v3';

export const projectRoleSchema = z.enum(['owner', 'admin', 'member', 'follower']);
export type ProjectRole = z.infer<typeof projectRoleSchema>;

export const projectPermissionSchema = z.enum([
  'project:update',
  'member:manage',
  'ownership:transfer',
  'content:publish',
  'content:collaborate',
  'discussion:create',
]);
export type ProjectPermission = z.infer<typeof projectPermissionSchema>;

const permissionsByRole: Record<ProjectRole, ReadonlySet<ProjectPermission>> = {
  owner: new Set(projectPermissionSchema.options),
  admin: new Set(['member:manage', 'content:publish', 'content:collaborate', 'discussion:create']),
  member: new Set(['content:publish', 'content:collaborate', 'discussion:create']),
  follower: new Set(['content:publish', 'discussion:create']),
};

export function hasProjectPermission(role: ProjectRole, permission: ProjectPermission): boolean {
  return permissionsByRole[role].has(permission);
}

export function canAssignProjectRole(
  actorRole: ProjectRole,
  currentRole: ProjectRole,
  nextRole: ProjectRole,
): boolean {
  if (actorRole === 'owner') {
    if (currentRole === 'owner') return false;
    return nextRole !== 'owner';
  }
  if (actorRole === 'admin') {
    return (currentRole === 'member' || currentRole === 'follower')
      && (nextRole === 'member' || nextRole === 'follower');
  }
  return false;
}

export function canTransferProjectOwnership(actorRole: ProjectRole, targetRole: ProjectRole): boolean {
  return actorRole === 'owner' && targetRole !== 'owner';
}
