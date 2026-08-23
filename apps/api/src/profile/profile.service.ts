import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { PublicUser, UpdateProfileRequest, UserProfileResponse } from '@atlas/contracts';

import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('用户不存在');
    return toPublicUser(user);
  }

  async update(userId: string, input: UpdateProfileRequest): Promise<PublicUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: input.displayName,
        bio: input.bio,
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      },
    });
    return toPublicUser(user);
  }

  async search(keyword: string, excludeUserId: string): Promise<PublicUser[]> {
    const normalized = keyword.trim();
    if (!normalized) return [];
    const users = await this.prisma.user.findMany({
      where: {
        id: { not: excludeUserId },
        status: 'ACTIVE',
        displayName: { contains: normalized, mode: 'insensitive' },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
    return users.map(toPublicUser);
  }

  async publicProfile(viewerId: string, userId: string): Promise<UserProfileResponse> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, status: 'ACTIVE' } });
    if (!user) throw new NotFoundException('用户不存在');
    const [followerCount, followingCount, following] = await Promise.all([
      this.prisma.userFollow.count({ where: { followingId: userId } }),
      this.prisma.userFollow.count({ where: { followerId: userId } }),
      viewerId === userId
        ? Promise.resolve(null)
        : this.prisma.userFollow.findUnique({ where: { followerId_followingId: { followerId: viewerId, followingId: userId } } }),
    ]);
    return { user: toPublicUser(user), followerCount, followingCount, isFollowing: Boolean(following) };
  }

  async follow(viewerId: string, userId: string): Promise<UserProfileResponse> {
    if (viewerId === userId) throw new ConflictException('不能关注自己');
    const target = await this.prisma.user.findFirst({ where: { id: userId, status: 'ACTIVE' }, select: { id: true } });
    if (!target) throw new NotFoundException('用户不存在');
    await this.prisma.userFollow.upsert({
      where: { followerId_followingId: { followerId: viewerId, followingId: userId } },
      create: { followerId: viewerId, followingId: userId },
      update: {},
    });
    return this.publicProfile(viewerId, userId);
  }

  async unfollow(viewerId: string, userId: string): Promise<UserProfileResponse> {
    await this.prisma.userFollow.deleteMany({ where: { followerId: viewerId, followingId: userId } });
    return this.publicProfile(viewerId, userId);
  }
}

function toPublicUser(user: { id: string; displayName: string; avatarUrl: string | null; bio: string; createdAt: Date }): PublicUser {
  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    createdAt: user.createdAt.toISOString(),
  };
}
