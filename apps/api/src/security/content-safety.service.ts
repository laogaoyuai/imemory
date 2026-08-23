import { Inject, Injectable, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { z } from 'zod';

import { API_CONFIG, type ApiConfig } from '../config/api-config';
import { PrismaService } from '../database/prisma.service';

const tokenResponseSchema = z.object({
  access_token: z.string().optional(),
  expires_in: z.number().optional(),
  errcode: z.number().optional(),
  errmsg: z.string().optional(),
});

const securityResponseSchema = z.object({
  errcode: z.number().optional(),
  errmsg: z.string().optional(),
  result: z.object({ suggest: z.enum(['pass', 'review', 'risky']), label: z.number().optional() }).optional(),
});

@Injectable()
export class ContentSafetyService {
  private accessToken: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(API_CONFIG) private readonly config: ApiConfig,
  ) {}

  async assertUserTextSafe(userId: string, values: string[], scene: 1 | 2 | 3 | 4): Promise<void> {
    if (this.config.contentSecurity.mode === 'disabled') return;
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { wechatOpenId: true } });
    if (!user?.wechatOpenId) throw unavailable('无法确认内容提交账号');
    await this.assertOpenIdTextSafe(user.wechatOpenId, values, scene);
  }

  async assertOpenIdTextSafe(openId: string, values: string[], scene: 1 | 2 | 3 | 4): Promise<void> {
    if (this.config.contentSecurity.mode === 'disabled') return;
    for (const content of splitTextForModeration(values)) {
      const result = await this.check(content, openId, scene, true);
      if (result === 'review') {
        throw new UnprocessableEntityException({ code: 'content_requires_review', message: '内容可能存在风险，请调整后重试' });
      }
      if (result === 'risky') {
        throw new UnprocessableEntityException({ code: 'unsafe_content', message: '内容未通过安全检查，请修改后重试' });
      }
    }
  }

  private async check(content: string, openId: string, scene: number, allowTokenRetry: boolean): Promise<'pass' | 'review' | 'risky'> {
    const token = await this.getAccessToken();
    let response: Response;
    try {
      response = await fetch(`https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, version: 2, scene, openid: openId }),
        signal: AbortSignal.timeout(this.config.contentSecurity.timeoutMs),
      });
    } catch {
      throw unavailable('微信内容安全服务暂不可用');
    }
    if (!response.ok) throw unavailable('微信内容安全服务响应异常');
    const parsed = securityResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw unavailable('微信内容安全服务返回了无效响应');
    if (allowTokenRetry && (parsed.data.errcode === 40001 || parsed.data.errcode === 42001)) {
      this.accessToken = null;
      return this.check(content, openId, scene, false);
    }
    if (parsed.data.errcode && parsed.data.errcode !== 0) throw unavailable(parsed.data.errmsg || '微信内容安全检查失败');
    if (!parsed.data.result) throw unavailable('微信内容安全检查缺少结果');
    return parsed.data.result.suggest;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > Date.now()) return this.accessToken.value;
    const query = new URLSearchParams({
      grant_type: 'client_credential',
      appid: this.config.wechat.appId ?? '',
      secret: this.config.wechat.appSecret ?? '',
    });
    let response: Response;
    try {
      response = await fetch(`https://api.weixin.qq.com/cgi-bin/token?${query.toString()}`, {
        signal: AbortSignal.timeout(this.config.contentSecurity.timeoutMs),
      });
    } catch {
      throw unavailable('无法连接微信内容安全服务');
    }
    if (!response.ok) throw unavailable('获取微信服务凭证失败');
    const parsed = tokenResponseSchema.safeParse(await response.json());
    if (!parsed.success || !parsed.data.access_token) throw unavailable(parsed.success ? parsed.data.errmsg || '获取微信服务凭证失败' : '微信凭证响应无效');
    this.accessToken = {
      value: parsed.data.access_token,
      expiresAt: Date.now() + Math.max(60, (parsed.data.expires_in ?? 7200) - 300) * 1000,
    };
    return this.accessToken.value;
  }
}

export function splitTextForModeration(values: string[], chunkSize = 2000): string[] {
  const normalized = [...new Set(values.map((value) => value.trim()).filter(Boolean))].join('\n');
  const chunks: string[] = [];
  for (let index = 0; index < normalized.length; index += chunkSize) chunks.push(normalized.slice(index, index + chunkSize));
  return chunks;
}

function unavailable(message: string): ServiceUnavailableException {
  return new ServiceUnavailableException({ code: 'content_safety_unavailable', message });
}
