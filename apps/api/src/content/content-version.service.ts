import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  canEditContentVersion,
  canReviewContentVersion,
  compareVersions,
  contentItemSchema,
  incrementPatchVersion,
  shouldAutoApproveContentVersion,
  type ContentItem,
  type ProjectRole,
} from '@atlas/core';
import type {
  ApiContentVersion,
  ContentRollbackResponse,
  ContentVersionListResponse,
  ContentVersionMutationResponse,
  CreateContentVersionRequest,
  ReviewContentVersionRequest,
  SyncContentItem,
} from '@atlas/contracts';

import { PrismaService } from '../database/prisma.service';

type DbStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type DbRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'FOLLOWER';

interface UserRecord {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  createdAt: Date;
}

interface VersionRecord {
  id: string;
  contentId: string;
  version: string;
  status: DbStatus;
  snapshot: unknown;
  createdAt: Date;
  reviewedAt: Date | null;
  submittedBy: UserRecord;
  reviewedBy: UserRecord | null;
}

interface VersionContentRecord {
  id: string;
  ownerId: string;
  payload: unknown;
  revision: number;
  updatedAt: Date;
  deletedAt: Date | null;
  currentVersionStatus: DbStatus;
  projectLinks: Array<{
    projectId: string;
    project: { members: Array<{ role: DbRole }> };
  }>;
  versions: VersionRecord[];
}

@Injectable()
export class ContentVersionService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, contentId: string): Promise<ContentVersionListResponse> {
    const content = await this.load(contentId, userId);
    const permissions = this.permissions(content, userId);
    if (!permissions.canEdit) throw new ForbiddenException('无权查看该内容的版本历史');
    const current = contentItemSchema.parse(content.payload);
    return {
      versions: content.versions.map(toApiVersion),
      currentVersion: current.version,
      permissions,
    };
  }

  async submit(
    userId: string,
    contentId: string,
    input: CreateContentVersionRequest,
  ): Promise<ContentVersionMutationResponse> {
    const content = await this.load(contentId, userId);
    const permissions = this.permissions(content, userId);
    if (!permissions.canEdit) throw new ForbiddenException('无权编辑该内容');
    if (input.snapshot.id !== contentId) throw new BadRequestException('内容快照与路径不一致');
    if (input.snapshot.attachments.some((attachment) => !/^https?:\/\//i.test(attachment.uri))) {
      throw new BadRequestException('版本附件必须先上传到对象存储');
    }

    const current = contentItemSchema.parse(content.payload);
    if (!sameIds(current.projectIds, input.snapshot.projectIds)) {
      throw new BadRequestException('版本编辑不能改变所属项目');
    }
    const latest = highestVersion(content.versions.map((version) => version.version));
    const version = input.version ?? incrementPatchVersion(latest);
    if (compareVersions(version, latest) <= 0) throw new ConflictException(`版本号必须大于 ${latest}`);
    const roles = projectRoles(content);
    const status: DbStatus = shouldAutoApproveContentVersion(roles, content.projectLinks.length) ? 'APPROVED' : 'PENDING';
    const actor = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!actor) throw new NotFoundException('用户不存在');
    const now = new Date();
    const normalized = contentItemSchema.parse({
      ...input.snapshot,
      id: contentId,
      version,
      authorName: current.authorName,
      lastSubmittedBy: actor.displayName,
      createdAt: current.createdAt,
      updatedAt: now.toISOString(),
    });

    const result = await this.prisma.$transaction(async (transaction) => {
      const versionRecord = await transaction.contentVersion.create({
        data: {
          contentId,
          version,
          status,
          snapshot: jsonValue(normalized),
          submittedById: userId,
          ...(status === 'APPROVED' ? { reviewedById: userId, reviewedAt: now } : {}),
        },
        include: { submittedBy: true, reviewedBy: true },
      });
      const record = await transaction.content.update({
        where: { id: contentId },
        data: {
          kind: normalized.kind,
          title: normalized.title,
          payload: jsonValue(normalized),
          currentVersionStatus: status,
          clientUpdatedAt: now,
          revision: { increment: 1 },
          deletedAt: null,
        },
      });
      return { version: versionRecord as VersionRecord, content: record };
    });
    return { content: toSyncItem(result.content), version: toApiVersion(result.version) };
  }

  async review(
    userId: string,
    contentId: string,
    versionId: string,
    input: ReviewContentVersionRequest,
  ): Promise<ContentVersionMutationResponse> {
    const content = await this.load(contentId, userId);
    if (!this.permissions(content, userId).canReview) throw new ForbiddenException('无权审核该内容版本');
    const target = content.versions.find((version) => version.id === versionId);
    if (!target) throw new NotFoundException('版本不存在');
    if (target.status !== 'PENDING') throw new ConflictException('该版本已经完成审核');
    const status = toDbStatus(input.status);
    const now = new Date();
    const current = contentItemSchema.parse(content.payload);

    const result = await this.prisma.$transaction(async (transaction) => {
      const version = await transaction.contentVersion.update({
        where: { id: versionId },
        data: { status, reviewedById: userId, reviewedAt: now },
        include: { submittedBy: true, reviewedBy: true },
      });
      let record;
      if (current.version === target.version && status === 'REJECTED') {
        const previous = content.versions.find((version) => version.id !== versionId && version.status === 'APPROVED');
        if (previous) {
          const restored = contentItemSchema.parse({
            ...contentItemSchema.parse(previous.snapshot),
            updatedAt: now.toISOString(),
          });
          record = await transaction.content.update({
            where: { id: contentId },
            data: {
              kind: restored.kind,
              title: restored.title,
              payload: jsonValue(restored),
              currentVersionStatus: 'APPROVED',
              clientUpdatedAt: now,
              revision: { increment: 1 },
            },
          });
        } else {
          record = await transaction.content.update({
            where: { id: contentId },
            data: { currentVersionStatus: 'REJECTED', revision: { increment: 1 } },
          });
        }
      } else if (current.version === target.version) {
        record = await transaction.content.update({
          where: { id: contentId },
          data: { currentVersionStatus: status, revision: { increment: 1 } },
        });
      } else {
        record = await transaction.content.findUniqueOrThrow({ where: { id: contentId } });
      }
      return { version: version as VersionRecord, content: record };
    });
    return { content: toSyncItem(result.content), version: toApiVersion(result.version) };
  }

  async rollback(userId: string, contentId: string, versionId: string): Promise<ContentRollbackResponse> {
    const content = await this.load(contentId, userId);
    if (!this.permissions(content, userId).canRollback) throw new ForbiddenException('无权回退该内容');
    const target = content.versions.find((version) => version.id === versionId);
    if (!target) throw new NotFoundException('版本不存在');
    if (target.status !== 'APPROVED') throw new ConflictException('只能回退到已通过版本');
    const actor = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!actor) throw new NotFoundException('用户不存在');
    const now = new Date();
    const restored = contentItemSchema.parse({
      ...contentItemSchema.parse(target.snapshot),
      lastSubmittedBy: actor.displayName,
      updatedAt: now.toISOString(),
    });
    const record = await this.prisma.content.update({
      where: { id: contentId },
      data: {
        kind: restored.kind,
        title: restored.title,
        payload: jsonValue(restored),
        currentVersionStatus: 'APPROVED',
        clientUpdatedAt: now,
        revision: { increment: 1 },
        deletedAt: null,
      },
    });
    return { content: toSyncItem(record) };
  }

  private async load(contentId: string, userId: string): Promise<VersionContentRecord> {
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
      include: {
        projectLinks: {
          include: { project: { include: { members: { where: { userId }, select: { role: true } } } } },
        },
        versions: {
          include: { submittedBy: true, reviewedBy: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!content || content.deletedAt) throw new NotFoundException('内容不存在');
    return content as VersionContentRecord;
  }

  private permissions(content: VersionContentRecord, userId: string) {
    const roles = projectRoles(content);
    const canEdit = canEditContentVersion(content.ownerId === userId, roles);
    return {
      canEdit,
      canReview: canReviewContentVersion(roles, content.projectLinks.length),
      canRollback: canEdit,
    };
  }
}

function projectRoles(content: VersionContentRecord): ProjectRole[] {
  return content.projectLinks
    .flatMap((link) => link.project.members)
    .map((member) => member.role.toLowerCase() as ProjectRole);
}

function highestVersion(versions: string[]): string {
  return versions.reduce((highest, version) => compareVersions(version, highest) > 0 ? version : highest, '0.0.0');
}

function sameIds(left: string[], right: string[]): boolean {
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.length === sortedRight.length && sortedLeft.every((id, index) => id === sortedRight[index]);
}

function toApiVersion(record: VersionRecord): ApiContentVersion {
  return {
    id: record.id,
    contentId: record.contentId,
    version: record.version,
    status: record.status.toLowerCase() as ApiContentVersion['status'],
    snapshot: contentItemSchema.parse(record.snapshot),
    submittedBy: publicUser(record.submittedBy),
    submittedAt: record.createdAt.toISOString(),
    reviewedBy: record.reviewedBy ? publicUser(record.reviewedBy) : null,
    reviewedAt: record.reviewedAt?.toISOString() ?? null,
  };
}

function publicUser(user: UserRecord) {
  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    createdAt: user.createdAt.toISOString(),
  };
}

function toDbStatus(status: 'approved' | 'rejected'): DbStatus {
  return status.toUpperCase() as DbStatus;
}

function toSyncItem(record: { payload: unknown; revision: number; updatedAt: Date; deletedAt: Date | null }): SyncContentItem {
  return {
    item: contentItemSchema.parse(record.payload),
    revision: record.revision,
    serverUpdatedAt: record.updatedAt.toISOString(),
    deletedAt: record.deletedAt?.toISOString() ?? null,
  };
}

function jsonValue(value: unknown): object {
  return JSON.parse(JSON.stringify(value)) as object;
}
