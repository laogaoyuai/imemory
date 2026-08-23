import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { AccessIdentity, AuthenticatedRequest } from './auth.guard';

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AccessIdentity => (
  context.switchToHttp().getRequest<AuthenticatedRequest>().atlasUser
));
