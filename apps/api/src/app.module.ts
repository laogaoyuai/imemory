import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { CollectionModule } from './collection/collection.module';
import { ConfigModule } from './config/config.module';
import { ContentModule } from './content/content.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { ProfileModule } from './profile/profile.module';
import { ProjectModule } from './project/project.module';
import { SecurityModule } from './security/security.module';
import { UploadModule } from './upload/upload.module';

@Module({
  imports: [ConfigModule, DatabaseModule, SecurityModule, AuthModule, ContentModule, CollectionModule, UploadModule, ProfileModule, ProjectModule],
  controllers: [HealthController],
})
export class AppModule {}
