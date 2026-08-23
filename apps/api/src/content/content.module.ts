import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ContentController } from './content.controller';
import { ContentSyncService } from './content-sync.service';
import { ContentSocialService } from './content-social.service';
import { ContentVersionService } from './content-version.service';

@Module({ imports: [AuthModule], controllers: [ContentController], providers: [ContentSyncService, ContentVersionService, ContentSocialService] })
export class ContentModule {}
