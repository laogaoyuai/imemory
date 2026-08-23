import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  compareVersions,
  contentItemSchema,
  shouldAutoApproveContentVersion,
  type ContentItem,
  type ProjectRole,
} from '@atlas/core';
import type {
  ContentListResponse,
  ContentSyncRequest,
  ContentSyncResponse,
  SyncContentItem,
} from '@atlas/contracts';

import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ContentSyncService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, since?: Date): Promise<ContentListResponse> {
    const records = await this.prisma.content.findMany({
      where: { ownerId: userId, ...(since ? { updatedAt: { gt: since } } : {}) },
      orderBy: { updatedAt: 'asc' },
      take: 500,
    });
    return { items: records.map(toSyncItem), serverTime: new Date().toISOString() };
  }

  async sync(userId: string, request: ContentSyncRequest): Promise<ContentSyncResponse> {
    const accepted: SyncContentItem[] = [];
    const conflicts: ContentSyncResponse['conflicts'] = [];

    for (const change of request.upserts) {
      const result = await this.prisma.$transaction(async (transaction) => {
        const repeated = await transaction.idempotencyKey.findUnique({
          where: { userId_scope_key: { userId, scope: 'content:upsert', key: change.idempotencyKey } },
        });
        if (repeated) return { accepted: parseStoredSyncItem(repeated.responseBody), conflict: null };
        const existing = await transaction.content.findUnique({ where: { id: change.item.id } });
        if (existing && existing.ownerId !== userId) {
          return { accepted: null, conflict: { contentId: change.item.id, reason: 'ownership_mismatch' as const, server: null } };
        }
        if (existing && existing.revision !== change.baseRevision) {
          return { accepted: null, conflict: { contentId: change.item.id, reason: 'revision_conflict' as const, server: toSyncItem(existing) } };
        }
        if (!existing && change.baseRevision !== 0) {
          return { accepted: null, conflict: { contentId: change.item.id, reason: 'not_found' as const, server: null } };
        }
        const now = new Date();
        const revision = (existing?.revision ?? 0) + 1;
        let normalized: ContentItem = contentItemSchema.parse({ ...change.item, updatedAt: now.toISOString() });
        let projectRoles: ProjectRole[] = [];
        if (normalized.projectIds.length > 0) {
          const projects = await transaction.project.findMany({
            where: { id: { in: normalized.projectIds }, members: { some: { userId } } },
            select: {
              id: true,
              name: true,
              members: { where: { userId }, select: { role: true } },
            },
          });
          if (projects.length !== normalized.projectIds.length) {
            throw new ForbiddenException('只能向已关注或已加入的项目发布内容');
          }
          const names = new Map(projects.map((project) => [project.id, project.name]));
          normalized = contentItemSchema.parse({
            ...normalized,
            teamNames: normalized.projectIds.map((projectId) => names.get(projectId)),
          });
          projectRoles = projects
            .flatMap((project) => project.members)
            .map((member) => member.role.toLowerCase() as ProjectRole);
        }
        const existingItem = existing ? contentItemSchema.parse(existing.payload) : null;
        const versionChanged = !existingItem || existingItem.version !== normalized.version;
        if (versionChanged && existing) {
          const knownVersions = await transaction.contentVersion.findMany({
            where: { contentId: normalized.id },
            select: { version: true },
          });
          const highest = highestVersion(knownVersions.map((entry) => entry.version));
          if (compareVersions(normalized.version, highest) <= 0) {
            throw new ConflictException(`版本号必须大于 ${highest}`);
          }
        }
        const versionStatus = versionChanged
          ? shouldAutoApproveContentVersion(projectRoles, normalized.projectIds.length) ? 'APPROVED' : 'PENDING'
          : existing?.currentVersionStatus ?? 'APPROVED';
        const record = await transaction.content.upsert({
          where: { id: normalized.id },
          create: {
            id: normalized.id,
            ownerId: userId,
            kind: normalized.kind,
            title: normalized.title,
            payload: jsonValue(normalized),
            revision,
            currentVersionStatus: versionStatus,
            clientUpdatedAt: new Date(change.item.updatedAt),
          },
          update: {
            kind: normalized.kind,
            title: normalized.title,
            payload: jsonValue(normalized),
            revision,
            currentVersionStatus: versionStatus,
            clientUpdatedAt: new Date(change.item.updatedAt),
            deletedAt: null,
          },
        });
        await transaction.contentProject.deleteMany({ where: { contentId: normalized.id } });
        if (normalized.projectIds.length > 0) {
          await transaction.contentProject.createMany({
            data: normalized.projectIds.map((projectId) => ({ contentId: normalized.id, projectId })),
          });
        }
        if (versionChanged) {
          await transaction.contentVersion.create({
            data: {
              contentId: normalized.id,
              version: normalized.version,
              status: versionStatus,
              snapshot: jsonValue(normalized),
              submittedById: userId,
              ...(versionStatus === 'APPROVED' ? { reviewedById: userId, reviewedAt: now } : {}),
            },
          });
        }
        const response = toSyncItem(record);
        await transaction.idempotencyKey.create({
          data: {
            userId,
            scope: 'content:upsert',
            key: change.idempotencyKey,
            responseBody: jsonValue(response),
            expiresAt: new Date(Date.now() + 7 * 86_400_000),
          },
        });
        return { accepted: response, conflict: null };
      });
      if (result.accepted) accepted.push(result.accepted);
      if (result.conflict) conflicts.push(result.conflict);
    }

    for (const deletion of request.deletions) {
      const result = await this.prisma.$transaction(async (transaction) => {
        const repeated = await transaction.idempotencyKey.findUnique({
          where: { userId_scope_key: { userId, scope: 'content:delete', key: deletion.idempotencyKey } },
        });
        if (repeated) return { accepted: parseStoredSyncItem(repeated.responseBody), conflict: null };
        const existing = await transaction.content.findUnique({ where: { id: deletion.contentId } });
        if (!existing) return { accepted: null, conflict: { contentId: deletion.contentId, reason: 'not_found' as const, server: null } };
        if (existing.ownerId !== userId) return { accepted: null, conflict: { contentId: deletion.contentId, reason: 'ownership_mismatch' as const, server: null } };
        if (existing.revision !== deletion.baseRevision) {
          return { accepted: null, conflict: { contentId: deletion.contentId, reason: 'revision_conflict' as const, server: toSyncItem(existing) } };
        }
        const record = await transaction.content.update({
          where: { id: deletion.contentId },
          data: { deletedAt: new Date(), revision: { increment: 1 } },
        });
        const response = toSyncItem(record);
        await transaction.idempotencyKey.create({
          data: {
            userId,
            scope: 'content:delete',
            key: deletion.idempotencyKey,
            responseBody: jsonValue(response),
            expiresAt: new Date(Date.now() + 7 * 86_400_000),
          },
        });
        return { accepted: response, conflict: null };
      });
      if (result.accepted) accepted.push(result.accepted);
      if (result.conflict) conflicts.push(result.conflict);
    }

    return { accepted, conflicts, serverTime: new Date().toISOString() };
  }
}

function highestVersion(versions: string[]): string {
  return versions.reduce(
    (highest, version) => compareVersions(version, highest) > 0 ? version : highest,
    '0.0.0',
  );
}

function toSyncItem(record: { payload: unknown; revision: number; updatedAt: Date; deletedAt: Date | null }): SyncContentItem {
  return {
    item: contentItemSchema.parse(record.payload),
    revision: record.revision,
    serverUpdatedAt: record.updatedAt.toISOString(),
    deletedAt: record.deletedAt?.toISOString() ?? null,
  };
}

function parseStoredSyncItem(value: unknown): SyncContentItem {
  const record = value as Record<string, unknown>;
  return {
    item: contentItemSchema.parse(record.item),
    revision: Number(record.revision),
    serverUpdatedAt: String(record.serverUpdatedAt),
    deletedAt: record.deletedAt === null ? null : String(record.deletedAt),
  };
}

function jsonValue(value: unknown): object {
  return JSON.parse(JSON.stringify(value)) as object;
}
