import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  canAddToCollection,
  collectionTypeSchema,
  contentCollectionSchema,
  contentItemSchema,
  normalizeCollectionContentIds,
  type CollectionType,
  type ContentCollection,
  type ContentItem,
} from '@atlas/core';
import type {
  CollectionDetailResponse,
  CollectionListResponse,
  CreateCollectionRequest,
  UpdateCollectionRequest,
} from '@atlas/contracts';

import { PrismaService } from '../database/prisma.service';

interface CollectionRecord {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  coverUrl: string | null;
  type: string;
  createdAt: Date;
  updatedAt: Date;
  owner: { displayName: string };
  items: Array<{ position: number; content: { payload: unknown } }>;
}

@Injectable()
export class CollectionService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<CollectionListResponse> {
    const records = await this.prisma.collection.findMany({
      where: { ownerId: userId },
      include: collectionInclude,
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return { collections: records.map((record) => toCollection(record as CollectionRecord)) };
  }

  async detail(userId: string, collectionId: string): Promise<CollectionDetailResponse> {
    const record = await this.load(collectionId);
    this.assertOwner(record, userId);
    return toDetail(record);
  }

  async create(userId: string, input: CreateCollectionRequest): Promise<ContentCollection> {
    const record = await this.prisma.collection.create({
      data: {
        ownerId: userId,
        name: input.name,
        description: input.description,
        coverUrl: input.coverUri,
        type: input.type,
      },
      include: collectionInclude,
    });
    return toCollection(record as CollectionRecord);
  }

  async update(
    userId: string,
    collectionId: string,
    input: UpdateCollectionRequest,
  ): Promise<CollectionDetailResponse> {
    const current = await this.load(collectionId);
    this.assertOwner(current, userId);
    const type = input.type ?? collectionTypeSchema.parse(current.type);
    const requestedIds = input.contentIds
      ? normalizeCollectionContentIds(input.contentIds)
      : current.items.sort((left, right) => left.position - right.position)
        .map((item) => contentItemSchema.parse(item.content.payload).id);
    if (input.contentIds && requestedIds.length !== input.contentIds.length) {
      throw new BadRequestException('合集内容不能重复');
    }
    const validatedIds = input.contentIds || input.type
      ? await this.validateContents(userId, type, requestedIds)
      : requestedIds;

    await this.prisma.$transaction(async (transaction) => {
      await transaction.collection.update({
        where: { id: collectionId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.coverUri !== undefined ? { coverUrl: input.coverUri } : {}),
          ...(input.type !== undefined ? { type: input.type } : {}),
        },
      });
      if (input.contentIds || input.type) {
        await transaction.collectionItem.deleteMany({ where: { collectionId } });
        if (validatedIds.length > 0) {
          await transaction.collectionItem.createMany({
            data: validatedIds.map((contentId, position) => ({ collectionId, contentId, position })),
          });
        }
      }
    });
    return this.detail(userId, collectionId);
  }

  async remove(userId: string, collectionId: string): Promise<void> {
    const record = await this.load(collectionId);
    this.assertOwner(record, userId);
    await this.prisma.collection.delete({ where: { id: collectionId } });
  }

  private async validateContents(userId: string, type: CollectionType, contentIds: string[]): Promise<string[]> {
    if (contentIds.length === 0) return [];
    const records = await this.prisma.content.findMany({
      where: {
        id: { in: contentIds },
        ownerId: userId,
        deletedAt: null,
        projectLinks: { none: {} },
      },
      select: { id: true, payload: true },
    });
    const byId = new Map(records.map((record) => [record.id, contentItemSchema.parse(record.payload)]));
    const ordered = contentIds.map((contentId) => byId.get(contentId));
    if (ordered.some((item) => !item)) {
      throw new BadRequestException('合集只能添加自己的个人内容');
    }
    if (ordered.some((item) => !canAddToCollection(type, item as ContentItem))) {
      throw new BadRequestException('合集只能包含同一类型的个人内容');
    }
    return contentIds;
  }

  private async load(collectionId: string): Promise<CollectionRecord> {
    const record = await this.prisma.collection.findUnique({
      where: { id: collectionId },
      include: collectionInclude,
    });
    if (!record) throw new NotFoundException('合集不存在');
    return record as CollectionRecord;
  }

  private assertOwner(record: CollectionRecord, userId: string): void {
    if (record.ownerId !== userId) throw new ForbiddenException('只能管理自己的合集');
  }
}

const collectionInclude = {
  owner: { select: { displayName: true } },
  items: {
    where: { content: { deletedAt: null } },
    include: { content: { select: { payload: true } } },
    orderBy: { position: 'asc' as const },
  },
} as const;

function toCollection(record: CollectionRecord): ContentCollection {
  return contentCollectionSchema.parse({
    id: record.id,
    ownerName: record.owner.displayName,
    name: record.name,
    description: record.description,
    coverUri: record.coverUrl,
    type: record.type,
    contentIds: record.items.map((item) => contentItemSchema.parse(item.content.payload).id),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

function toDetail(record: CollectionRecord): CollectionDetailResponse {
  return {
    collection: toCollection(record),
    contents: record.items.map((item) => contentItemSchema.parse(item.content.payload)),
  };
}
