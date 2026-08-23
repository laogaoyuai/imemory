import {
  canAssignProjectRole,
  canTransferProjectOwnership,
  hasProjectPermission,
} from './project';

describe('project permissions', () => {
  it('gives members collaboration rights but keeps followers in discussion mode', () => {
    expect(hasProjectPermission('member', 'content:collaborate')).toBe(true);
    expect(hasProjectPermission('follower', 'content:publish')).toBe(true);
    expect(hasProjectPermission('follower', 'discussion:create')).toBe(true);
    expect(hasProjectPermission('follower', 'content:collaborate')).toBe(false);
  });

  it('allows administrators to manage only members and followers', () => {
    expect(canAssignProjectRole('admin', 'follower', 'member')).toBe(true);
    expect(canAssignProjectRole('admin', 'member', 'follower')).toBe(true);
    expect(canAssignProjectRole('admin', 'admin', 'member')).toBe(false);
    expect(canAssignProjectRole('admin', 'follower', 'admin')).toBe(false);
  });

  it('reserves administrator assignment and ownership transfer for the owner', () => {
    expect(canAssignProjectRole('owner', 'follower', 'admin')).toBe(true);
    expect(canTransferProjectOwnership('owner', 'member')).toBe(true);
    expect(canTransferProjectOwnership('admin', 'member')).toBe(false);
  });
});
