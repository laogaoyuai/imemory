import type { ContentListResponse, ContentSyncRequest, ContentSyncResponse } from '@atlas/contracts';

import { ContentSyncCoordinator, type ContentSyncLocalStore, type ContentSyncRemote } from './index';

const emptyRequest: ContentSyncRequest = { upserts: [], deletions: [] };
const emptyList: ContentListResponse = { items: [], serverTime: '2026-08-23T01:00:00.000Z' };

class LocalStore implements ContentSyncLocalStore {
  readonly calls: string[] = [];
  cursor: string | null = null;
  request: ContentSyncRequest = emptyRequest;

  async prepareForSync() { this.calls.push('prepare'); }
  async pendingChanges() { this.calls.push('pending'); return this.request; }
  async acknowledge(_response: ContentSyncResponse, _submitted: ContentSyncRequest) { this.calls.push('acknowledge'); }
  async mergeRemote(_response: ContentListResponse) { this.calls.push('merge'); }
  async getCursor() { this.calls.push('cursor:get'); return this.cursor; }
  async setCursor(cursor: string) { this.calls.push('cursor:set'); this.cursor = cursor; }
}

describe('ContentSyncCoordinator', () => {
  it('skips an empty push and advances the cursor after merging', async () => {
    const local = new LocalStore();
    const remote: ContentSyncRemote = {
      listContents: jest.fn(async () => emptyList),
      syncContents: jest.fn(),
    };

    const result = await new ContentSyncCoordinator(local, remote).synchronize();

    expect(remote.syncContents).not.toHaveBeenCalled();
    expect(local.calls).toEqual(['prepare', 'pending', 'cursor:get', 'merge', 'cursor:set']);
    expect(local.cursor).toBe(emptyList.serverTime);
    expect(result).toEqual({ pushed: 0, pulled: 0, conflicts: 0, serverTime: emptyList.serverTime });
  });

  it('acknowledges the submitted snapshot before pulling remote changes', async () => {
    const local = new LocalStore();
    local.request = {
      upserts: [{
        idempotencyKey: '0e6bbf36-a03d-4a20-a521-59560e047e55',
        baseRevision: 0,
        item: sampleItem,
      }],
      deletions: [],
    };
    const accepted = { item: sampleItem, revision: 1, serverUpdatedAt: sampleItem.updatedAt, deletedAt: null };
    const remote: ContentSyncRemote = {
      syncContents: jest.fn(async () => ({ accepted: [accepted], conflicts: [], serverTime: sampleItem.updatedAt })),
      listContents: jest.fn(async () => ({ items: [accepted], serverTime: '2026-08-23T01:00:00.000Z' })),
    };

    const result = await new ContentSyncCoordinator(local, remote).synchronize();

    expect(local.calls).toEqual(['prepare', 'pending', 'acknowledge', 'cursor:get', 'merge', 'cursor:set']);
    expect(result.pushed).toBe(1);
    expect(result.pulled).toBe(1);
  });

  it('does not advance the cursor when merge fails', async () => {
    const local = new LocalStore();
    local.mergeRemote = async () => { throw new Error('local write failed'); };
    const remote: ContentSyncRemote = {
      listContents: jest.fn(async () => emptyList),
      syncContents: jest.fn(),
    };

    await expect(new ContentSyncCoordinator(local, remote).synchronize()).rejects.toThrow('local write failed');
    expect(local.cursor).toBeNull();
  });
});

const sampleItem = {
  id: 'content-1',
  kind: 'note' as const,
  title: '',
  body: '离线内容',
  excerpt: '离线内容',
  location: '',
  authorName: '我',
  lastSubmittedBy: '我',
  teamName: '无',
  teamNames: ['无'],
  projectIds: [],
  isPublic: false,
  attachments: [],
  tags: [],
  createdAt: '2026-08-23T00:00:00.000Z',
  updatedAt: '2026-08-23T00:00:00.000Z',
  version: '0.0.1',
  isFavorite: false,
  isLiked: false,
  readCount: 0,
  likeCount: 0,
  shareCount: 0,
  favoriteCount: 0,
  commentCount: 0,
};
