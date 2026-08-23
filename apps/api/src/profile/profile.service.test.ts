import { ProfileService } from './profile.service';

describe('ProfileService follow rules', () => {
  it('rejects following yourself before touching persistence', async () => {
    const prisma = createPrismaMock();
    const service = new ProfileService(prisma as never);

    await expect(service.follow(user.id, user.id)).rejects.toThrow('不能关注自己');
    expect(prisma.userFollow.upsert).not.toHaveBeenCalled();
  });

  it('creates an idempotent follow relation and returns updated counts', async () => {
    const prisma = createPrismaMock();
    prisma.user.findFirst.mockResolvedValueOnce({ id: target.id }).mockResolvedValueOnce(target);
    prisma.userFollow.upsert.mockResolvedValue({});
    prisma.userFollow.count.mockResolvedValueOnce(3).mockResolvedValueOnce(2);
    prisma.userFollow.findUnique.mockResolvedValue({ followerId: user.id, followingId: target.id });
    const service = new ProfileService(prisma as never);

    const result = await service.follow(user.id, target.id);

    expect(prisma.userFollow.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: { followerId: user.id, followingId: target.id },
    }));
    expect(result).toMatchObject({ followerCount: 3, followingCount: 2, isFollowing: true });
  });
});

function createPrismaMock() {
  return {
    user: { findFirst: jest.fn() },
    userFollow: {
      upsert: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
}

const createdAt = new Date('2026-08-24T00:00:00.000Z');
const user = { id: '10000000-0000-4000-8000-000000000001' };
const target = {
  id: '10000000-0000-4000-8000-000000000002',
  displayName: '目标用户',
  avatarUrl: null,
  bio: '',
  createdAt,
};
