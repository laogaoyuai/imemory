import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { refreshSessionRequestSchema, wechatLoginRequestSchema } from '@atlas/contracts';

import { parseWithSchema } from '../common/zod';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('wechat')
  @HttpCode(200)
  login(@Body() body: unknown) {
    return this.auth.login(parseWithSchema(wechatLoginRequestSchema, body));
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() body: unknown) {
    return this.auth.refresh(parseWithSchema(refreshSessionRequestSchema, body).refreshToken);
  }
}
