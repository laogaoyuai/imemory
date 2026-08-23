import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { updateProfileRequestSchema } from '@atlas/contracts';

import { AuthGuard, type AccessIdentity } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { parseWithSchema } from '../common/zod';
import { ProfileService } from './profile.service';

@Controller('profile')
@UseGuards(AuthGuard)
export class ProfileController {
  constructor(private readonly profiles: ProfileService) {}

  @Get()
  get(@CurrentUser() user: AccessIdentity) {
    return this.profiles.get(user.id);
  }

  @Patch()
  update(@CurrentUser() user: AccessIdentity, @Body() body: unknown) {
    return this.profiles.update(user.id, parseWithSchema(updateProfileRequestSchema, body));
  }
}
