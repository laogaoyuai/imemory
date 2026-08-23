import { createContentItem } from '@atlas/core';

import { CollectionService } from './collection.service';

describe('CollectionService', () => {
  it('creates an empty personal collection for the current user', async () => {
    const prisma = createPrismaMock();
    prisma.collection.create.mockResolvedValue(collectionRecord([]));
    const service = new CollectionService(prisma as never);

    const result = await service.create(userId, {
      name: '日常短文',
      description: '持续更新',
      coverUri: null,
      type: 'note',
    });

    expect(result.ownerName).toBe('测试用户');
    expect(result.contentIds).toEqual([]);
    expect(prisma.collection.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ ownerId: userId, type: 'note' }),
    }));
  });

  it('persists the requested content order as stable positions', async () => {
    const prisma = createPrismaMock();
    const first = item('content-first', '第一条');
    const second = item('content-second', '第二条');
    prisma.collection.findUnique
      .mockResolvedValueOnce(collectionRecord([]))
      .mockResolvedValueOnce(collectionRecord([second, first]));
    prisma.content.findMany.mockResolvedValue([
      { id: first.id, payload: first },
      { id: second.id, payload: second },
    ]);
    const service = new CollectionService(prisma as never);

    const result = await service.update(userId, collectionId, { contentIds: [second.id, first.id] });

    expect(result.collection.contentIds).toEqual([second.id, first.id]);
    expect(prisma.collectionItem.createMany).toHaveBeenCalledWith({
      data: [
        { collectionId, contentId: second.id, position: 0 },
        { collectionId, contentId: first.id, position: 1 },
      ],
    });
  });

  it('rejects content that is not an owned personal item of the same type', async () => {
    const prisma = createPrismaMock();
    const note = item('content-first', '第一条');
    prisma.collection.findUnique.mockResolvedValue(collectionRecord([]));
    prisma.content.findMany.mockResolvedValue([]);
    const service = new CollectionService(prisma as never);

    await expect(service.update(userId, collectionId, { contentIds: [note.id] })).rejects.toThrow('自己的个人内容');
    expect(prisma.collectionItem.createMany).not.toHaveBeenCalled();
  });
});

function createPrismaMock() {
  const collection = { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() };
  const collectionItem = { deleteMany: jest.fn(), createMany: jest.fn() };
  return {
    collection,
    collectionItem,
    content: { findMany: jest.fn() },
    $transaction: jest.fn(async (operation: (transaction: unknown) => unknown) => operation({ collection, collectionItem })),
  };
}

function collectionRecord(contents: ReturnType<typeof item>[]) {
  return {
    id: collectionId,
    ownerId: userId,
    name: '日常短文',
    description: '持续更新',
    coverUrl: null,
    type: 'note',
    createdAt: now,
    updatedAt: now,
    owner: { displayName: '测试用户' },
    items: contents.map((content, position) => ({ position, content: { payload: content } })),
  };
}

function item(id: string, body: string) {
  return createContentItem({ title: '', body, attachments: [], tags: [] }, { id: () => id, now: () => now });
}

const now = new Date('2026-08-26T00:00:00.000Z');
const userId = '10000000-0000-4000-8000-000000000001';
const collectionId = '20000000-0000-4000-8000-000000000001';
