import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  canAssignProjectRole,
  canTransferProjectOwnership,
  contentItemSchema,
  hasProjectPermission,
  type ProjectRole,
} from '@atlas/core';
import type {
  CreateProjectRequest,
  Project,
  ProjectDetailResponse,
  ProjectListResponse,
  UpdateProjectRequest,
} from '@atlas/contracts';

import { PrismaService } from '../database/prisma.service';

type DbRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'FOLLOWER';

interface ProjectRecord {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  avatarUrl: string | null;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  owner: UserRecord;
  members: Array<{ userId: string; role: DbRole; createdAt: Date; user: UserRecord }>;
  contents: Array<{
    content: { payload: unknown; deletedAt: Date | null; currentVersionStatus: 'PENDING' | 'APPROVED' | 'REJECTED' };
  }>;
}

interface UserRecord {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  createdAt: Date;
}

@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, scope: 'mine' | 'discover'): Promise<ProjectListResponse> {
    const projects = await this.prisma.project.findMany({
      where: scope === 'mine'
        ? { members: { some: { userId } } }
        : { isPublic: true },
      include: projectInclude,
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return { projects: projects.map((project) => toProject(project as ProjectRecord, userId)) };
  }

  async detail(userId: string, projectId: string): Promise<ProjectDetailResponse> {
    const project = await this.load(projectId);
    this.assertVisible(project, userId);
    return toDetail(project, userId);
  }

  async create(userId: string, input: CreateProjectRequest): Promise<Project> {
    const project = await this.prisma.project.create({
      data: {
        ownerId: userId,
        name: input.name,
        description: input.description,
        avatarUrl: input.avatarUrl ?? null,
        isPublic: input.isPublic,
        members: { create: { userId, role: 'OWNER' } },
      },
      include: projectInclude,
    });
    return toProject(project as ProjectRecord, userId);
  }

  async update(userId: string, projectId: string, input: UpdateProjectRequest): Promise<Project> {
    const project = await this.load(projectId);
    if (project.ownerId !== userId) throw new ForbiddenException('只有项目主可以修改项目设置');
    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
        ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
      },
      include: projectInclude,
    });
    return toProject(updated as ProjectRecord, userId);
  }

  async follow(userId: string, projectId: string): Promise<Project> {
    const project = await this.load(projectId);
    const existing = project.members.find((member) => member.userId === userId);
    if (!existing && !project.isPublic) throw new ForbiddenException('私密项目不能直接关注');
    if (!existing) {
      await this.prisma.projectMember.create({ data: { projectId, userId, role: 'FOLLOWER' } });
    }
    return toProject(await this.load(projectId), userId);
  }

  async unfollow(userId: string, projectId: string): Promise<void> {
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!membership) return;
    if (membership.role !== 'FOLLOWER') {
      throw new ConflictException('项目主、管理员或成员需要先调整为粉丝才能取消关注');
    }
    await this.prisma.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });
  }

  async changeRole(
    actorId: string,
    projectId: string,
    targetUserId: string,
    nextRole: ProjectRole,
  ): Promise<ProjectDetailResponse> {
    if (actorId === targetUserId) throw new ConflictException('不能直接修改自己的项目角色');
    const project = await this.load(projectId);
    const actor = project.members.find((member) => member.userId === actorId);
    const target = project.members.find((member) => member.userId === targetUserId);
    if (!actor || !target) throw new NotFoundException('项目成员不存在');
    const actorRole = fromDbRole(actor.role);
    const currentRole = fromDbRole(target.role);

    if (nextRole === 'owner') {
      if (!canTransferProjectOwnership(actorRole, currentRole) || project.ownerId !== actorId) {
        throw new ForbiddenException('只有项目主可以转让项目');
      }
      await this.prisma.$transaction([
        this.prisma.project.update({ where: { id: projectId }, data: { ownerId: targetUserId } }),
        this.prisma.projectMember.update({
          where: { projectId_userId: { projectId, userId: actorId } },
          data: { role: 'ADMIN' },
        }),
        this.prisma.projectMember.update({
          where: { projectId_userId: { projectId, userId: targetUserId } },
          data: { role: 'OWNER' },
        }),
      ]);
    } else {
      if (!canAssignProjectRole(actorRole, currentRole, nextRole)) {
        throw new ForbiddenException('当前角色无权进行该调整');
      }
      await this.prisma.projectMember.update({
        where: { projectId_userId: { projectId, userId: targetUserId } },
        data: { role: toDbRole(nextRole) },
      });
    }
    return this.detail(actorId, projectId);
  }

  async addFollower(actorId: string, projectId: string, targetUserId: string): Promise<ProjectDetailResponse> {
    if (actorId === targetUserId) throw new ConflictException('你已经在项目中');
    const project = await this.load(projectId);
    const actor = project.members.find((member) => member.userId === actorId);
    if (!actor || !hasProjectPermission(fromDbRole(actor.role), 'member:manage')) {
      throw new ForbiddenException('只有项目主或管理员可以邀请成员');
    }
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, status: true } });
    if (!target || target.status !== 'ACTIVE') throw new NotFoundException('用户不存在');
    await this.prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId: targetUserId } },
      create: { projectId, userId: targetUserId, role: 'FOLLOWER' },
      update: {},
    });
    return this.detail(actorId, projectId);
  }

  private async load(projectId: string): Promise<ProjectRecord> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, include: projectInclude });
    if (!project) throw new NotFoundException('项目不存在');
    return project as ProjectRecord;
  }

  private assertVisible(project: ProjectRecord, userId: string): void {
    if (!project.isPublic && !project.members.some((member) => member.userId === userId)) {
      throw new ForbiddenException('无权查看该私密项目');
    }
  }
}

const projectInclude = {
  owner: true,
  members: { include: { user: true }, orderBy: { createdAt: 'asc' as const } },
  contents: {
    where: { content: { deletedAt: null } },
    include: { content: true },
    orderBy: { createdAt: 'desc' as const },
  },
} as const;

function toDetail(record: ProjectRecord, userId: string): ProjectDetailResponse {
  return {
    project: toProject(record, userId),
    members: record.members.map((member) => ({
      user: publicUser(member.user),
      role: fromDbRole(member.role),
      joinedAt: member.createdAt.toISOString(),
    })),
    contents: visibleContents(record, userId),
  };
}

function toProject(record: ProjectRecord, userId: string): Project {
  const current = record.members.find((member) => member.userId === userId);
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    avatarUrl: record.avatarUrl,
    isPublic: record.isPublic,
    owner: publicUser(record.owner),
    currentRole: current ? fromDbRole(current.role) : null,
    stats: {
      admins: record.members.filter((member) => member.role === 'ADMIN').length,
      members: record.members.filter((member) => member.role === 'MEMBER').length,
      followers: record.members.filter((member) => member.role === 'FOLLOWER').length,
      contents: visibleContents(record, userId).length,
    },
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function visibleContents(record: ProjectRecord, userId: string) {
  const isMember = record.members.some((member) => member.userId === userId);
  return record.contents.flatMap(({ content }) => {
    const parsed = contentItemSchema.safeParse(content.payload);
    if (!parsed.success) return [];
    if (!isMember && (content.currentVersionStatus !== 'APPROVED' || !parsed.data.isPublic)) return [];
    return [parsed.data];
  });
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

function fromDbRole(role: DbRole): ProjectRole {
  return role.toLowerCase() as ProjectRole;
}

function toDbRole(role: Exclude<ProjectRole, 'owner'>): Exclude<DbRole, 'OWNER'> {
  return role.toUpperCase() as Exclude<DbRole, 'OWNER'>;
}
