import type { ProjectRole } from './project';

export function compareVersions(left: string, right: string): number {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export function incrementPatchVersion(version: string): string {
  const [major, minor, patch] = parseVersion(version);
  return `${major}.${minor}.${patch + 1}`;
}

export function canEditContentVersion(isCreator: boolean, projectRoles: readonly ProjectRole[]): boolean {
  return isCreator || projectRoles.some((role) => role === 'owner' || role === 'admin');
}

export function canReviewContentVersion(projectRoles: readonly ProjectRole[], projectCount: number): boolean {
  return projectCount > 0
    && projectRoles.length === projectCount
    && projectRoles.every((role) => role === 'owner' || role === 'admin');
}

export function shouldAutoApproveContentVersion(projectRoles: readonly ProjectRole[], projectCount: number): boolean {
  return projectCount === 0 || canReviewContentVersion(projectRoles, projectCount);
}

function parseVersion(version: string): [number, number, number] {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('版本号必须符合 x.x.x 格式');
  const [major, minor, patch] = version.split('.').map(Number);
  return [major ?? 0, minor ?? 0, patch ?? 0];
}
