import {
  canEditContentVersion,
  canReviewContentVersion,
  compareVersions,
  incrementPatchVersion,
  shouldAutoApproveContentVersion,
} from './content-version';

describe('content version rules', () => {
  it('compares semantic versions and increments the patch component', () => {
    expect(compareVersions('0.10.0', '0.9.9')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(incrementPatchVersion('1.2.9')).toBe('1.2.10');
  });

  it('allows creators and project managers to edit', () => {
    expect(canEditContentVersion(true, ['follower'])).toBe(true);
    expect(canEditContentVersion(false, ['admin'])).toBe(true);
    expect(canEditContentVersion(false, ['member'])).toBe(false);
  });

  it('requires management rights in every associated project to review or auto approve', () => {
    expect(canReviewContentVersion(['owner', 'admin'], 2)).toBe(true);
    expect(canReviewContentVersion(['owner', 'member'], 2)).toBe(false);
    expect(shouldAutoApproveContentVersion([], 0)).toBe(true);
    expect(shouldAutoApproveContentVersion(['admin'], 1)).toBe(true);
    expect(shouldAutoApproveContentVersion(['member'], 1)).toBe(false);
  });
});
