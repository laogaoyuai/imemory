import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import { API_CONFIG, type ApiConfig } from '../config/api-config';
import { PrismaService } from '../database/prisma.service';

export interface AccessIdentity {
  id: string;
  sessionId: string;
}

export interface AuthenticatedRequest extends Request {
  atlasUser: AccessIdentity;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    @Inject(API_CONFIG) private readonly config: ApiConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    if (!token) throw new UnauthorizedException({ code: 'access_token_missing', message: '需要登录' });
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; sid: string }>(token, { secret: this.config.jwtSecret });
      const session = await this.prisma.authSession.findFirst({
        where: { id: payload.sid, userId: payload.sub, revokedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true },
      });
      if (!session) throw new Error('session revoked');
      request.atlasUser = { id: payload.sub, sessionId: payload.sid };
      return true;
    } catch {
      throw new UnauthorizedException({ code: 'access_token_invalid', message: '登录状态已失效' });
    }
  }
}
