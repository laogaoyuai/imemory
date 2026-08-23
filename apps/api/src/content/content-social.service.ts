import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { contentCommentSchema, contentItemSchema, type ContentComment, type ContentItem } from '@atlas/core';
import type {
  CommentListResponse,
  CommentMutationResponse,
  CreateCommentRequest,
  CreateCommentResponse,
  ShareContentResponse,
  SharedContentResponse,
  SyncContentItem,
} from '@atlas/contracts';

import { PrismaService } from '../database/prisma.service';

type DbStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface SocialContentRecord {
  id: string;
  ownerId: string;
  payload: unknown;
  revision: number;
  updatedAt: Date;
  deletedAt: Date | null;
  currentVersionStatus: DbStatus;
  projectLinks: Array<{ project: { isPublic: boolean; members: Array<{ userId: string }> } }>;
}

interface CommentRecord {
  id: string;
  contentId: string;
  body: string;
  likeCount: number;
  createdAt: Date;
  author: { displayName: string };
  replyTo: null | { id: string; body: string; author: { displayName: string } };
  likes: Array<{ userId: string }>;
}

@Injectable()
export class ContentSocialService {
  constructor(private readonly prisma: PrismaService) {}

  async detail(userId: string, contentId: string): Promise<SharedContentResponse> {
    return { content: toSyncItem(await this.loadVisible(userId, contentId)) };
  }

  async listComments(userId: string, contentId: string): Promise<CommentListResponse> {
    await this.loadVisible(userId, contentId);
    const comments = await this.prisma.comment.findMany({
      where: { contentId, deletedAt: null },
      include: commentInclude(userId),
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    return { comments: comments.map((comment) => toComment(comment as CommentRecord)) };
  }

  async createComment(
    userId: string,
    contentId: string,
    input: CreateCommentRequest,
  ): Promise<CreateCommentResponse> {
    const content = await this.loadVisible(userId, contentId);
    if (input.replyToId) {
      const reply = await this.prisma.comment.findFirst({
        where: { id: input.replyToId, contentId, deletedAt: null },
        select: { id: true },
      });
      if (!reply) throw new BadRequestException('回复的评论不存在');
    }
    const now = new Date();
    const item = contentItemSchema.parse(content.payload);
    const updated = contentItemSchema.parse({
      ...item,
      commentCount: item.commentCount + 1,
      updatedAt: now.toISOString(),
    });
    const result = await this.prisma.$transaction(async (transaction) => {
      const comment = await transaction.comment.create({
        data: {
          contentId,
          authorId: userId,
          body: input.body,
          replyToId: input.replyToId,
        },
        include: commentInclude(userId),
      });
      const record = await transaction.content.update({
        where: { id: contentId },
        data: {
          payload: jsonValue(updated),
          revision: { increment: 1 },
          clientUpdatedAt: now,
        },
      });
      return { comment, content: record };
    });
    return { comment: toComment(result.comment as CommentRecord), content: toSyncItem(result.content) };
  }

  async toggleCommentLike(
    userId: string,
    contentId: string,
    commentId: string,
  ): Promise<CommentMutationResponse> {
    await this.loadVisible(userId, contentId);
    const target = await this.prisma.comment.findFirst({
      where: { id: commentId, contentId, deletedAt: null },
      select: { id: true, likeCount: true },
    });
    if (!target) throw new NotFoundException('评论不存在');

    const comment = await this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.commentLike.findUnique({
        where: { commentId_userId: { commentId, userId } },
      });
      if (existing) {
        await transaction.commentLike.delete({ where: { commentId_userId: { commentId, userId } } });
        return transaction.comment.update({
          where: { id: commentId },
          data: { likeCount: target.likeCount > 0 ? { decrement: 1 } : 0 },
          include: commentInclude(userId),
        });
      }
      await transaction.commentLike.create({ data: { commentId, userId } });
      return transaction.comment.update({
        where: { id: commentId },
        data: { likeCount: { increment: 1 } },
        include: commentInclude(userId),
      });
    });
    return { comment: toComment(comment as CommentRecord) };
  }

  async share(userId: string, contentId: string): Promise<ShareContentResponse> {
    const content = await this.loadVisible(userId, contentId);
    const now = new Date();
    const item = contentItemSchema.parse(content.payload);
    const updated = contentItemSchema.parse({
      ...item,
      shareCount: item.shareCount + 1,
      updatedAt: now.toISOString(),
    });
    const record = await this.prisma.content.update({
      where: { id: contentId },
      data: {
        payload: jsonValue(updated),
        revision: { increment: 1 },
        clientUpdatedAt: now,
      },
    });
    return { content: toSyncItem(record) };
  }

  private async loadVisible(userId: string, contentId: string): Promise<SocialContentRecord> {
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
      include: {
        projectLinks: {
          include: {
            project: {
              select: {
                isPublic: true,
                members: { where: { userId }, select: { userId: true } },
              },
            },
          },
        },
      },
    });
    if (!content || content.deletedAt) throw new NotFoundException('内容不存在');
    const record = content as SocialContentRecord;
    if (!isVisible(record, userId)) throw new ForbiddenException('无权查看该内容');
    return record;
  }
}

function isVisible(content: SocialContentRecord, userId: string): boolean {
  if (content.ownerId === userId) return true;
  if (content.projectLinks.some((link) => link.project.members.length > 0)) return true;
  const item = contentItemSchema.parse(content.payload);
  if (content.currentVersionStatus !== 'APPROVED' || !item.isPublic) return false;
  return content.projectLinks.length === 0 || content.projectLinks.some((link) => link.project.isPublic);
}

function commentInclude(userId: string) {
  return {
    author: { select: { displayName: true } },
    replyTo: { include: { author: { select: { displayName: true } } } },
    likes: { where: { userId }, select: { userId: true } },
  } as const;
}

function toComment(record: CommentRecord): ContentComment {
  return contentCommentSchema.parse({
    id: record.id,
    contentId: record.contentId,
    authorName: record.author.displayName,
    body: record.body,
    createdAt: record.createdAt.toISOString(),
    replyToId: record.replyTo?.id ?? null,
    replyToAuthorName: record.replyTo?.author.displayName ?? null,
    replyToBody: record.replyTo?.body ?? null,
    isLiked: record.likes.length > 0,
    likeCount: Math.max(0, record.likeCount),
  });
}

function toSyncItem(record: { payload: unknown; revision: number; updatedAt: Date; deletedAt: Date | null }): SyncContentItem {
  return {
    item: contentItemSchema.parse(record.payload),
    revision: record.revision,
    serverUpdatedAt: record.updatedAt.toISOString(),
    deletedAt: record.deletedAt?.toISOString() ?? null,
  };
}

function jsonValue(value: ContentItem): object {
  return JSON.parse(JSON.stringify(value)) as object;
}
