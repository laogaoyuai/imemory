import { Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';

import { AuthGuard, type AccessIdentity } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ProfileService } from './profile.service';

@Controller('users')
@UseGuards(AuthGuard)
export class UserController {
  constructor(private readonly profiles: ProfileService) {}

  @Get()
  async search(@CurrentUser() user: AccessIdentity, @Query('q') keyword = '') {
    return { users: await this.profiles.search(keyword.slice(0, 40), user.id) };
  }


  @Get(':userId')
  profile(@CurrentUser() user: AccessIdentity, @Param('userId', new ParseUUIDPipe()) userId: string) {
    return this.profiles.publicProfile(user.id, userId);
  }

  @Post(':userId/follow')
  follow(@CurrentUser() user: AccessIdentity, @Param('userId', new ParseUUIDPipe()) userId: string) {
    return this.profiles.follow(user.id, userId);
  }

  @Delete(':userId/follow')
  unfollow(@CurrentUser() user: AccessIdentity, @Param('userId', new ParseUUIDPipe()) userId: string) {
    return this.profiles.unfollow(user.id, userId);
  }
}
