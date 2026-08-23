import { createHash } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { z } from 'zod';

import { API_CONFIG, type ApiConfig } from '../config/api-config';

const wechatResponseSchema = z.object({
  openid: z.string().min(1).optional(),
  session_key: z.string().optional(),
  unionid: z.string().optional(),
  errcode: z.number().optional(),
  errmsg: z.string().optional(),
});

export interface WechatIdentity {
  openId: string;
  unionId: string | null;
}

@Injectable()
export class WechatAuthProvider {
  constructor(@Inject(API_CONFIG) private readonly config: ApiConfig) {}

  async exchange(code: string): Promise<WechatIdentity> {
    if (this.config.wechat.mode === 'mock') {
      if (this.config.nodeEnv === 'production') throw new UnauthorizedException('生产环境禁止模拟微信登录');
      return {
        openId: `mock_${createHash('sha256').update(code).digest('hex').slice(0, 28)}`,
        unionId: null,
      };
    }
    const query = new URLSearchParams({
      appid: this.config.wechat.appId ?? '',
      secret: this.config.wechat.appSecret ?? '',
      js_code: code,
      grant_type: 'authorization_code',
    });
    const response = await fetch(`https://api.weixin.qq.com/sns/jscode2session?${query.toString()}`);
    if (!response.ok) throw new UnauthorizedException('微信登录服务暂不可用');
    const result = wechatResponseSchema.parse(await response.json());
    if (!result.openid || result.errcode) {
      throw new UnauthorizedException({ code: 'wechat_login_failed', message: result.errmsg || '微信登录失败' });
    }
    return { openId: result.openid, unionId: result.unionid ?? null };
  }
}
