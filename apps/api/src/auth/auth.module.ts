import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { WechatAuthProvider } from './wechat-auth.provider';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [JwtModule.register({ global: true }), SecurityModule],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, WechatAuthProvider],
  exports: [AuthGuard],
})
export class AuthModule {}
