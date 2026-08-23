import { createContentItem } from '@atlas/core';

import { ContentSocialService } from './content-social.service';

describe('ContentSocialService', () => {
  it('increments the authoritative comment count when creating a comment', async () => {
    const prisma = createPrismaMock();
    const content = contentRecord(true);
    prisma.content.findUnique.mockResolvedValue(content);
    prisma.comment.create.mockResolvedValue(commentRecord([]));
    prisma.content.update.mockImplementation(async ({ data }: { data: { payload: unknown } }) => ({
      ...content,
      payload: data.payload,
      revision: 2,
      updatedAt: now,
    }));
    const service = new ContentSocialService(prisma as never);

    const result = await service.createComment(viewerId, contentId, { body: '这是一条评论', replyToId: null });

    expect(result.comment.body).toBe('这是一条评论');
    expect(result.content.item.commentCount).toBe(1);
    expect(result.content.revision).toBe(2);
  });

  it('records a per-user comment like and returns the liked state', async () => {
    const prisma = createPrismaMock();
    prisma.content.findUnique.mockResolvedValue(contentRecord(true));
    prisma.comment.findFirst.mockResolvedValue({ id: commentId });
    prisma.commentLike.findUnique.mockResolvedValue(null);
    prisma.comment.update.mockResolvedValue(commentRecord([{ userId: viewerId }], 1));
    const service = new ContentSocialService(prisma as never);

    const result = await service.toggleCommentLike(viewerId, contentId, commentId);

    expect(prisma.commentLike.create).toHaveBeenCalledWith({ data: { commentId, userId: viewerId } });
    expect(result.comment.isLiked).toBe(true);
    expect(result.comment.likeCount).toBe(1);
  });

  it('prevents another user from opening private personal content', async () => {
    const prisma = createPrismaMock();
    prisma.content.findUnique.mockResolvedValue(contentRecord(false));
    const service = new ContentSocialService(prisma as never);

    await expect(service.detail(viewerId, contentId)).rejects.toThrow('无权查看');
  });
});

function createPrismaMock() {
  const content = { findUnique: jest.fn(), update: jest.fn() };
  const comment = { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() };
  const commentLike = { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() };
  return {
    content,
    comment,
    commentLike,
    $transaction: jest.fn(async (operation: (transaction: unknown) => unknown) => operation({ content, comment, commentLike })),
  };
}

function contentRecord(isPublic: boolean) {
  return {
    id: contentId,
    ownerId,
    payload: { ...item, isPublic },
    revision: 1,
    updatedAt: now,
    deletedAt: null,
    currentVersionStatus: 'APPROVED',
    projectLinks: [],
  };
}

function commentRecord(likes: Array<{ userId: string }>, likeCount = 0) {
  return {
    id: commentId,
    contentId,
    body: '这是一条评论',
    likeCount,
    createdAt: now,
    author: { displayName: '访问者' },
    replyTo: null,
    likes,
  };
}

const now = new Date('2026-08-27T00:00:00.000Z');
const contentId = 'content-beta1';
const commentId = '30000000-0000-4000-8000-000000000001';
const ownerId = '10000000-0000-4000-8000-000000000001';
const viewerId = '10000000-0000-4000-8000-000000000002';
const item = createContentItem({
  title: '公开内容',
  body: '欢迎评论',
  attachments: [],
  tags: [],
  isPublic: true,
}, { id: () => contentId, now: () => now });
