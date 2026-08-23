import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  contentSyncRequestSchema,
  createCommentRequestSchema,
  createContentVersionRequestSchema,
  reviewContentVersionRequestSchema,
} from '@atlas/contracts';

import { AuthGuard, type AccessIdentity } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { parseWithSchema } from '../common/zod';
import { ContentSyncService } from './content-sync.service';
import { ContentSocialService } from './content-social.service';
import { ContentVersionService } from './content-version.service';

@Controller('contents')
@UseGuards(AuthGuard)
export class ContentController {
  constructor(
    private readonly contents: ContentSyncService,
    private readonly versions: ContentVersionService,
    private readonly social: ContentSocialService,
  ) {}

  @Get()
  list(@CurrentUser() user: AccessIdentity, @Query('since') since?: string) {
    const parsedSince = since ? new Date(since) : undefined;
    if (parsedSince && Number.isNaN(parsedSince.getTime())) throw new BadRequestException('since 必须是 ISO 时间');
    return this.contents.list(user.id, parsedSince);
  }

  @Post('sync')
  sync(@CurrentUser() user: AccessIdentity, @Body() body: unknown) {
    return this.contents.sync(user.id, parseWithSchema(contentSyncRequestSchema, body));
  }

  @Get(':contentId')
  detail(@CurrentUser() user: AccessIdentity, @Param('contentId') contentId: string) {
    return this.social.detail(user.id, contentId);
  }

  @Get(':contentId/comments')
  comments(@CurrentUser() user: AccessIdentity, @Param('contentId') contentId: string) {
    return this.social.listComments(user.id, contentId);
  }

  @Post(':contentId/comments')
  createComment(@CurrentUser() user: AccessIdentity, @Param('contentId') contentId: string, @Body() body: unknown) {
    return this.social.createComment(user.id, contentId, parseWithSchema(createCommentRequestSchema, body));
  }

  @Post(':contentId/comments/:commentId/like')
  toggleCommentLike(
    @CurrentUser() user: AccessIdentity,
    @Param('contentId') contentId: string,
    @Param('commentId', new ParseUUIDPipe()) commentId: string,
  ) {
    return this.social.toggleCommentLike(user.id, contentId, commentId);
  }

  @Post(':contentId/share')
  share(@CurrentUser() user: AccessIdentity, @Param('contentId') contentId: string) {
    return this.social.share(user.id, contentId);
  }

  @Get(':contentId/versions')
  versionsList(@CurrentUser() user: AccessIdentity, @Param('contentId') contentId: string) {
    return this.versions.list(user.id, contentId);
  }

  @Post(':contentId/versions')
  createVersion(@CurrentUser() user: AccessIdentity, @Param('contentId') contentId: string, @Body() body: unknown) {
    return this.versions.submit(user.id, contentId, parseWithSchema(createContentVersionRequestSchema, body));
  }

  @Patch(':contentId/versions/:versionId')
  reviewVersion(
    @CurrentUser() user: AccessIdentity,
    @Param('contentId') contentId: string,
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Body() body: unknown,
  ) {
    return this.versions.review(user.id, contentId, versionId, parseWithSchema(reviewContentVersionRequestSchema, body));
  }

  @Post(':contentId/versions/:versionId/rollback')
  rollbackVersion(
    @CurrentUser() user: AccessIdentity,
    @Param('contentId') contentId: string,
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
  ) {
    return this.versions.rollback(user.id, contentId, versionId);
  }
}
