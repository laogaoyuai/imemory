import { ProjectService } from './project.service';

describe('ProjectService permissions', () => {
  it('creates the owner membership atomically with a project', async () => {
    const prisma = createPrismaMock();
    prisma.project.create.mockResolvedValue(projectRecord);
    const service = new ProjectService(prisma as never);

    const project = await service.create(owner.id, {
      name: '拾光编辑部',
      description: '一起整理内容',
      isPublic: true,
    });

    expect(prisma.project.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        ownerId: owner.id,
        members: { create: { userId: owner.id, role: 'OWNER' } },
      }),
    }));
    expect(project.currentRole).toBe('owner');
  });

  it('prevents an administrator from creating another administrator', async () => {
    const prisma = createPrismaMock();
    prisma.project.findUnique.mockResolvedValue({
      ...projectRecord,
      members: [
        projectRecord.members[0],
        { userId: admin.id, role: 'ADMIN', createdAt: now, user: admin },
        { userId: follower.id, role: 'FOLLOWER', createdAt: now, user: follower },
      ],
    });
    const service = new ProjectService(prisma as never);

    await expect(service.changeRole(admin.id, projectRecord.id, follower.id, 'admin')).rejects.toThrow('无权');
    expect(prisma.projectMember.update).not.toHaveBeenCalled();
  });

  it('transfers ownership and keeps the previous owner as an administrator', async () => {
    const prisma = createPrismaMock();
    const before = {
      ...projectRecord,
      members: [
        projectRecord.members[0],
        { userId: member.id, role: 'MEMBER', createdAt: now, user: member },
      ],
    };
    const after = {
      ...before,
      ownerId: member.id,
      owner: member,
      members: [
        { userId: owner.id, role: 'ADMIN', createdAt: now, user: owner },
        { userId: member.id, role: 'OWNER', createdAt: now, user: member },
      ],
    };
    prisma.project.findUnique.mockResolvedValueOnce(before).mockResolvedValueOnce(after);
    prisma.project.update.mockResolvedValue(after);
    prisma.projectMember.update.mockResolvedValue({});
    prisma.$transaction.mockResolvedValue([]);
    const service = new ProjectService(prisma as never);

    const result = await service.changeRole(owner.id, projectRecord.id, member.id, 'owner');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.project.update).toHaveBeenCalledWith({ where: { id: projectRecord.id }, data: { ownerId: member.id } });
    expect(result.project.owner.id).toBe(member.id);
    expect(result.project.currentRole).toBe('admin');
  });

  it('lets an administrator invite a user as a follower', async () => {
    const prisma = createPrismaMock();
    const before = {
      ...projectRecord,
      members: [
        projectRecord.members[0],
        { userId: admin.id, role: 'ADMIN', createdAt: now, user: admin },
      ],
    };
    const after = {
      ...before,
      members: [
        ...before.members,
        { userId: follower.id, role: 'FOLLOWER', createdAt: now, user: follower },
      ],
    };
    prisma.project.findUnique.mockResolvedValueOnce(before).mockResolvedValueOnce(after);
    prisma.user.findUnique.mockResolvedValue({ id: follower.id, status: 'ACTIVE' });
    prisma.projectMember.upsert.mockResolvedValue({});
    const service = new ProjectService(prisma as never);

    const result = await service.addFollower(admin.id, projectRecord.id, follower.id);

    expect(prisma.projectMember.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: { projectId: projectRecord.id, userId: follower.id, role: 'FOLLOWER' },
    }));
    expect(result.members.find((entry) => entry.user.id === follower.id)?.role).toBe('follower');
  });
});

function createPrismaMock() {
  return {
    project: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    projectMember: {
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
}

const now = new Date('2026-08-24T00:00:00.000Z');
const owner = user('10000000-0000-4000-8000-000000000001', '项目主');
const admin = user('10000000-0000-4000-8000-000000000002', '管理员');
const member = user('10000000-0000-4000-8000-000000000003', '成员');
const follower = user('10000000-0000-4000-8000-000000000004', '粉丝');

const projectRecord = {
  id: '20000000-0000-4000-8000-000000000001',
  ownerId: owner.id,
  name: '拾光编辑部',
  description: '一起整理内容',
  avatarUrl: null,
  isPublic: true,
  createdAt: now,
  updatedAt: now,
  owner,
  members: [{ userId: owner.id, role: 'OWNER', createdAt: now, user: owner }],
  contents: [],
};

function user(id: string, displayName: string) {
  return { id, displayName, avatarUrl: null, bio: '', createdAt: now };
}
