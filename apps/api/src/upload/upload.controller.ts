import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { uploadPresignRequestSchema } from '@atlas/contracts';

import { AuthGuard, type AccessIdentity } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { parseWithSchema } from '../common/zod';
import { UploadService } from './upload.service';

@Controller('uploads')
@UseGuards(AuthGuard)
export class UploadController {
  constructor(private readonly uploads: UploadService) {}

  @Post('presign')
  presign(@CurrentUser() user: AccessIdentity, @Body() body: unknown) {
    return this.uploads.presign(user.id, parseWithSchema(uploadPresignRequestSchema, body));
  }
}
