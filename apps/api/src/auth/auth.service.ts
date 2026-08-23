import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthSession, PublicUser, WechatLoginRequest } from '@atlas/contracts';

import { API_CONFIG, type ApiConfig } from '../config/api-config';
import { PrismaService } from '../database/prisma.service';
import { WechatAuthProvider } from './wechat-auth.provider';
import { ContentSafetyService } from '../security/content-safety.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly wechat: WechatAuthProvider,
    private readonly safety: ContentSafetyService,
    @Inject(API_CONFIG) private readonly config: ApiConfig,
  ) {}

  async login(input: WechatLoginRequest): Promise<AuthSession> {
    const identity = await this.wechat.exchange(input.code);
    await this.safety.assertOpenIdTextSafe(identity.openId, [input.displayName ?? ''], 1);
    const user = await this.prisma.user.upsert({
      where: { wechatOpenId: identity.openId },
      create: {
        wechatOpenId: identity.openId,
        wechatUnionId: identity.unionId,
        displayName: input.displayName || '微信用户',
        avatarUrl: input.avatarUrl ?? null,
      },
      update: {
        lastLoginAt: new Date(),
        ...(identity.unionId ? { wechatUnionId: identity.unionId } : {}),
        ...(input.displayName ? { displayName: input.displayName } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      },
    });
    if (user.status !== 'ACTIVE') throw new UnauthorizedException('账号不可用');
    return this.issue(user);
  }

  async refresh(rawRefreshToken: string): Promise<AuthSession> {
    const hash = tokenHash(rawRefreshToken);
    const session = await this.prisma.authSession.findUnique({ where: { refreshTokenHash: hash }, include: { user: true } });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.status !== 'ACTIVE') {
      throw new UnauthorizedException({ code: 'refresh_token_invalid', message: '登录状态已失效' });
    }
    const revoked = await this.prisma.authSession.updateMany({
      where: { id: session.id, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date() },
    });
    if (revoked.count !== 1) throw new UnauthorizedException('登录状态已被刷新');
    return this.issue(session.user);
  }

  private async issue(user: { id: string; displayName: string; avatarUrl: string | null; bio: string; createdAt: Date }): Promise<AuthSession> {
    const refreshToken = randomBytes(48).toString('base64url');
    const refreshTokenExpiresAt = new Date(Date.now() + this.config.refreshTokenTtlDays * 86_400_000);
    const session = await this.prisma.authSession.create({
      data: { userId: user.id, refreshTokenHash: tokenHash(refreshToken), expiresAt: refreshTokenExpiresAt },
    });
    const accessTokenExpiresAt = new Date(Date.now() + this.config.accessTokenTtlSeconds * 1000);
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, sid: session.id },
      { secret: this.config.jwtSecret, expiresIn: this.config.accessTokenTtlSeconds },
    );
    return {
      accessToken,
      accessTokenExpiresAt: accessTokenExpiresAt.toISOString(),
      refreshToken,
      refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
      user: publicUser(user),
    };
  }
}

function tokenHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function publicUser(user: { id: string; displayName: string; avatarUrl: string | null; bio: string; createdAt: Date }): PublicUser {
  return { id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl, bio: user.bio, createdAt: user.createdAt.toISOString() };
}
