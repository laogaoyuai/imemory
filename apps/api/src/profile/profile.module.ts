import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { UserController } from './user.controller';

@Module({
  imports: [AuthModule],
  controllers: [ProfileController, UserController],
  providers: [ProfileService],
})
export class ProfileModule {}
