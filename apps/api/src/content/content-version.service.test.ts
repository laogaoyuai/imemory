import { createContentItem } from '@atlas/core';

import { ContentVersionService } from './content-version.service';

describe('ContentVersionService', () => {
  it('submits a project member edit as pending review', async () => {
    const prisma = createPrismaMock();
    const content = contentRecord('MEMBER');
    prisma.content.findUnique.mockResolvedValue(content);
    prisma.user.findUnique.mockResolvedValue(member);
    prisma.contentVersion.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: pendingVersionId,
      ...data,
      createdAt: now,
      reviewedAt: null,
      submittedBy: member,
      reviewedBy: null,
    }));
    prisma.content.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...content,
      ...data,
      revision: content.revision + 1,
      updatedAt: now,
    }));
    const service = new ContentVersionService(prisma as never);

    const result = await service.submit(member.id, content.id, {
      snapshot: { ...currentItem, body: '成员提交的新正文', version: '0.0.2' },
    });

    expect(result.version.status).toBe('pending');
    expect(prisma.contentVersion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ version: '0.0.2', status: 'PENDING', submittedById: member.id }),
    }));
    expect(prisma.content.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ currentVersionStatus: 'PENDING' }),
    }));
  });

  it('restores the previous approved snapshot when the current version is rejected', async () => {
    const prisma = createPrismaMock();
    const previousSnapshot = { ...currentItem, body: '已通过正文', version: '0.0.1' };
    const pendingSnapshot = { ...currentItem, body: '待审核正文', version: '0.0.2' };
    const content = {
      ...contentRecord('OWNER'),
      payload: pendingSnapshot,
      currentVersionStatus: 'PENDING',
      versions: [
        versionRecord(pendingVersionId, pendingSnapshot, 'PENDING'),
        versionRecord(approvedVersionId, previousSnapshot, 'APPROVED'),
      ],
    };
    prisma.content.findUnique.mockResolvedValue(content);
    prisma.contentVersion.update.mockResolvedValue({
      ...content.versions[0],
      status: 'REJECTED',
      reviewedBy: owner,
      reviewedAt: now,
    });
    prisma.content.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...content,
      ...data,
      payload: data.payload,
      revision: content.revision + 1,
      updatedAt: now,
    }));
    const service = new ContentVersionService(prisma as never);

    const result = await service.review(owner.id, content.id, pendingVersionId, { status: 'rejected' });

    expect(result.version.status).toBe('rejected');
    expect(result.content.item.version).toBe('0.0.1');
    expect(result.content.item.body).toBe('已通过正文');
    expect(prisma.content.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ currentVersionStatus: 'APPROVED' }),
    }));
  });

  it('allows rollback only to approved versions', async () => {
    const prisma = createPrismaMock();
    const pendingSnapshot = { ...currentItem, version: '0.0.2' };
    prisma.content.findUnique.mockResolvedValue({
      ...contentRecord('OWNER'),
      versions: [versionRecord(pendingVersionId, pendingSnapshot, 'PENDING')],
    });
    const service = new ContentVersionService(prisma as never);

    await expect(service.rollback(owner.id, contentId, pendingVersionId)).rejects.toThrow('只能回退到已通过版本');
    expect(prisma.content.update).not.toHaveBeenCalled();
  });
});

function createPrismaMock() {
  const content = { findUnique: jest.fn(), update: jest.fn(), findUniqueOrThrow: jest.fn() };
  const contentVersion = { create: jest.fn(), update: jest.fn() };
  return {
    content,
    contentVersion,
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(async (operation: (transaction: unknown) => unknown) => operation({ content, contentVersion })),
  };
}

function contentRecord(role: 'OWNER' | 'MEMBER') {
  return {
    id: contentId,
    ownerId: member.id,
    payload: currentItem,
    revision: 1,
    updatedAt: now,
    deletedAt: null,
    currentVersionStatus: 'APPROVED',
    projectLinks: [{ projectId, project: { members: [{ role }] } }],
    versions: [versionRecord(approvedVersionId, currentItem, 'APPROVED')],
  };
}

function versionRecord(id: string, snapshot: typeof currentItem, status: 'PENDING' | 'APPROVED' | 'REJECTED') {
  return {
    id,
    contentId,
    version: snapshot.version,
    status,
    snapshot,
    createdAt: status === 'APPROVED' ? new Date('2026-08-24T00:00:00.000Z') : now,
    reviewedAt: status === 'APPROVED' ? now : null,
    submittedBy: member,
    reviewedBy: status === 'APPROVED' ? owner : null,
  };
}

const now = new Date('2026-08-25T00:00:00.000Z');
const contentId = 'content-alpha4';
const projectId = '20000000-0000-4000-8000-000000000001';
const approvedVersionId = '30000000-0000-4000-8000-000000000001';
const pendingVersionId = '30000000-0000-4000-8000-000000000002';
const owner = user('10000000-0000-4000-8000-000000000001', '项目主');
const member = user('10000000-0000-4000-8000-000000000002', '成员');
const currentItem = createContentItem({
  title: '版本测试',
  body: '初始正文',
  attachments: [],
  tags: ['版本'],
  authorName: member.displayName,
  teamNames: ['拾光编辑部'],
  projectIds: [projectId],
  isPublic: true,
}, { id: () => contentId, now: () => new Date('2026-08-24T00:00:00.000Z') });

function user(id: string, displayName: string) {
  return { id, displayName, avatarUrl: null, bio: '', createdAt: now };
}
