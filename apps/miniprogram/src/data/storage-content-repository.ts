import {
  contentItemSchema,
  type ContentComment,
  type ContentItem,
  type ContentVersion,
  type VersionedContentRepository,
} from '@atlas/core';
import {
  contentConflictSchema,
  type ContentConflict,
  type ContentListResponse,
  type ContentSyncRequest,
  type ContentSyncResponse,
  type SyncContentItem,
} from '@atlas/contracts';
import type { ContentSyncLocalStore } from '@atlas/sync-engine';
import Taro from '@tarojs/taro';

const STORAGE_PREFIX = 'atlas:miniprogram:v1';
const GUEST_SCOPE = 'guest';

interface PendingMutation {
  idempotencyKey: string;
  baseRevision: number;
}

interface ContentSyncMetadata {
  revision: number;
  serverUpdatedAt: string | null;
  pendingUpsert?: PendingMutation;
  pendingDeletion?: PendingMutation;
}

interface PersistedSyncState {
  cursor: string | null;
  records: Record<string, ContentSyncMetadata>;
  conflicts: ContentConflict[];
}

export interface LocalSyncStats {
  pending: number;
  conflicts: number;
  cursor: string | null;
}

export class StorageContentRepository implements VersionedContentRepository, ContentSyncLocalStore {
  private scope = GUEST_SCOPE;

  get accountId(): string | null {
    return this.scope === GUEST_SCOPE ? null : this.scope;
  }

  /** Switches the cache namespace and imports pre-login drafts once. */
  useAccount(userId: string | null): { migratedGuestItems: number } {
    if (!userId) {
      this.scope = GUEST_SCOPE;
      return { migratedGuestItems: 0 };
    }

    const accountScope = normalizeScope(userId);
    const accountItems = readArray(contentKey(accountScope));
    const guestItems = readArray(contentKey(GUEST_SCOPE));
    let migratedGuestItems = 0;

    if (guestItems.length > 0) {
      const accountIds = new Set(accountItems.map((item) => (
        item && typeof item === 'object' && 'id' in item ? String(item.id) : ''
      )));
      const importedItems = guestItems.filter((item) => (
        item && typeof item === 'object' && 'id' in item && !accountIds.has(String(item.id))
      ));
      Taro.setStorageSync(contentKey(accountScope), [...accountItems, ...importedItems]);
      Taro.setStorageSync(versionKey(accountScope), [
        ...readArray(versionKey(accountScope)),
        ...readArray(versionKey(GUEST_SCOPE)),
      ]);
      Taro.setStorageSync(commentKey(accountScope), [
        ...readArray(commentKey(accountScope)),
        ...readArray(commentKey(GUEST_SCOPE)),
      ]);
      Taro.removeStorageSync(contentKey(GUEST_SCOPE));
      Taro.removeStorageSync(versionKey(GUEST_SCOPE));
      Taro.removeStorageSync(commentKey(GUEST_SCOPE));
      migratedGuestItems = importedItems.length;
    }

    this.scope = accountScope;
    return { migratedGuestItems };
  }

  async list(): Promise<ContentItem[]> {
    return this.readItems().sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async get(id: string): Promise<ContentItem | null> {
    return this.readItems().find((item) => item.id === id) ?? null;
  }

  async save(item: ContentItem): Promise<void> {
    this.writeItem(item);
    if (!this.accountId) return;

    const state = this.readSyncState();
    const metadata = state.records[item.id] ?? emptyMetadata();
    metadata.pendingUpsert = {
      idempotencyKey: createUuid(),
      baseRevision: metadata.revision,
    };
    delete metadata.pendingDeletion;
    state.records[item.id] = metadata;
    this.writeSyncState(state);
  }

  async remove(id: string): Promise<void> {
    this.removeLocalItem(id, true);
    if (!this.accountId) return;

    const state = this.readSyncState();
    const metadata = state.records[id];
    if (!metadata || metadata.revision === 0) {
      delete state.records[id];
    } else {
      delete metadata.pendingUpsert;
      metadata.pendingDeletion = {
        idempotencyKey: createUuid(),
        baseRevision: metadata.revision,
      };
      state.records[id] = metadata;
    }
    state.conflicts = state.conflicts.filter((conflict) => conflict.contentId !== id);
    this.writeSyncState(state);
  }

  async saveVersion(version: ContentVersion): Promise<void> {
    const versions = this.readVersions();
    const index = versions.findIndex((candidate) => candidate.id === version.id);
    if (index >= 0) versions[index] = version;
    else versions.unshift(version);
    Taro.setStorageSync(this.versionStorageKey, versions);
  }

  async listVersions(contentId: string): Promise<ContentVersion[]> {
    return this.readVersions()
      .filter((version) => version.contentId === contentId)
      .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
  }

  async getVersion(versionId: string): Promise<ContentVersion | null> {
    return this.readVersions().find((version) => version.id === versionId) ?? null;
  }

  async updateVersionStatus(versionId: string, status: ContentVersion['status']): Promise<void> {
    Taro.setStorageSync(this.versionStorageKey, this.readVersions().map((version) => (
      version.id === versionId ? { ...version, status } : version
    )));
  }

  async removeVersion(versionId: string): Promise<void> {
    Taro.setStorageSync(this.versionStorageKey, this.readVersions().filter((version) => version.id !== versionId));
  }

  async listComments(contentId: string): Promise<ContentComment[]> {
    return this.readComments().filter((comment) => comment.contentId === contentId);
  }

  async saveComment(comment: ContentComment): Promise<void> {
    Taro.setStorageSync(this.commentStorageKey, [...this.readComments(), comment]);
  }

  async prepareForSync(): Promise<void> {
    if (!this.accountId) return;
    const state = this.readSyncState();
    let changed = false;
    for (const item of this.readItems()) {
      if (state.records[item.id]) continue;
      state.records[item.id] = {
        ...emptyMetadata(),
        pendingUpsert: { idempotencyKey: createUuid(), baseRevision: 0 },
      };
      changed = true;
    }
    if (changed) this.writeSyncState(state);
  }

  async pendingChanges(): Promise<ContentSyncRequest> {
    if (!this.accountId) return { upserts: [], deletions: [] };
    const state = this.readSyncState();
    const items = new Map(this.readItems().map((item) => [item.id, item]));
    const upserts: ContentSyncRequest['upserts'] = [];
    const deletions: ContentSyncRequest['deletions'] = [];

    for (const [contentId, metadata] of Object.entries(state.records)) {
      const item = items.get(contentId);
      if (metadata.pendingUpsert && item) {
        upserts.push({ ...metadata.pendingUpsert, item });
      }
      if (metadata.pendingDeletion) {
        deletions.push({ ...metadata.pendingDeletion, contentId });
      }
    }
    return { upserts, deletions };
  }

  async acknowledge(response: ContentSyncResponse, submitted: ContentSyncRequest): Promise<void> {
    const state = this.readSyncState();
    for (const accepted of response.accepted) {
      const contentId = accepted.item.id;
      const metadata = state.records[contentId] ?? emptyMetadata();
      const submittedUpsert = submitted.upserts.find((change) => change.item.id === contentId);
      const submittedDeletion = submitted.deletions.find((change) => change.contentId === contentId);

      metadata.revision = accepted.revision;
      metadata.serverUpdatedAt = accepted.serverUpdatedAt;

      if (submittedUpsert) {
        if (metadata.pendingUpsert?.idempotencyKey === submittedUpsert.idempotencyKey) {
          delete metadata.pendingUpsert;
          if (accepted.deletedAt) this.removeLocalItem(contentId, false);
          else this.writeItem(accepted.item);
        } else if (metadata.pendingUpsert) {
          metadata.pendingUpsert.baseRevision = accepted.revision;
        }
      }

      if (submittedDeletion && metadata.pendingDeletion?.idempotencyKey === submittedDeletion.idempotencyKey) {
        delete metadata.pendingDeletion;
        this.removeLocalItem(contentId, false);
      }
      state.records[contentId] = metadata;
    }

    for (const conflict of response.conflicts) {
      state.conflicts = replaceConflict(state.conflicts, conflict);
    }
    this.writeSyncState(state);
  }

  async mergeRemote(response: ContentListResponse): Promise<void> {
    const state = this.readSyncState();
    for (const remote of response.items) {
      const contentId = remote.item.id;
      const metadata = state.records[contentId] ?? emptyMetadata();
      const hasPending = Boolean(metadata.pendingUpsert || metadata.pendingDeletion);

      if (hasPending) {
        if (remote.revision > metadata.revision) {
          state.conflicts = replaceConflict(state.conflicts, {
            contentId,
            reason: 'revision_conflict',
            server: remote,
          });
        }
        continue;
      }

      this.applyRemoteItem(remote);
      state.records[contentId] = {
        revision: remote.revision,
        serverUpdatedAt: remote.serverUpdatedAt,
      };
      state.conflicts = state.conflicts.filter((conflict) => conflict.contentId !== contentId);
    }
    this.writeSyncState(state);
  }

  /** Applies a direct API mutation while keeping the local sync cursor coherent. */
  async applyServerMutation(remote: SyncContentItem): Promise<void> {
    const state = this.readSyncState();
    const metadata = state.records[remote.item.id] ?? emptyMetadata();
    if (metadata.pendingUpsert || metadata.pendingDeletion) {
      if (remote.revision > metadata.revision) {
        state.conflicts = replaceConflict(state.conflicts, {
          contentId: remote.item.id,
          reason: 'revision_conflict',
          server: remote,
        });
        this.writeSyncState(state);
      }
      return;
    }
    this.applyRemoteItem(remote);
    state.records[remote.item.id] = {
      revision: remote.revision,
      serverUpdatedAt: remote.serverUpdatedAt,
    };
    state.conflicts = state.conflicts.filter((conflict) => conflict.contentId !== remote.item.id);
    this.writeSyncState(state);
  }

  async getCursor(): Promise<string | null> {
    return this.accountId ? this.readSyncState().cursor : null;
  }

  async setCursor(cursor: string): Promise<void> {
    if (!this.accountId) return;
    const state = this.readSyncState();
    state.cursor = cursor;
    this.writeSyncState(state);
  }

  async syncStats(): Promise<LocalSyncStats> {
    const state = this.readSyncState();
    return {
      pending: Object.values(state.records).filter((record) => record.pendingUpsert || record.pendingDeletion).length,
      conflicts: state.conflicts.length,
      cursor: state.cursor,
    };
  }

  async listSyncConflicts(): Promise<ContentConflict[]> {
    return this.readSyncState().conflicts;
  }

  async resolveConflict(contentId: string, strategy: 'local' | 'remote'): Promise<void> {
    const state = this.readSyncState();
    const conflict = state.conflicts.find((candidate) => candidate.contentId === contentId);
    if (!conflict) return;

    if (strategy === 'remote') {
      if (conflict.server) {
        this.applyRemoteItem(conflict.server);
        state.records[contentId] = {
          revision: conflict.server.revision,
          serverUpdatedAt: conflict.server.serverUpdatedAt,
        };
      } else {
        this.removeLocalItem(contentId, false);
        delete state.records[contentId];
      }
    } else {
      if (conflict.reason === 'ownership_mismatch') {
        throw new Error('该内容属于其他账号，不能覆盖云端内容');
      }
      const metadata = state.records[contentId] ?? emptyMetadata();
      const baseRevision = conflict.server?.revision ?? 0;
      metadata.revision = baseRevision;
      metadata.serverUpdatedAt = conflict.server?.serverUpdatedAt ?? null;
      if (this.readItems().some((item) => item.id === contentId)) {
        metadata.pendingUpsert = { idempotencyKey: createUuid(), baseRevision };
        delete metadata.pendingDeletion;
      } else if (baseRevision > 0) {
        metadata.pendingDeletion = { idempotencyKey: createUuid(), baseRevision };
        delete metadata.pendingUpsert;
      }
      state.records[contentId] = metadata;
    }

    state.conflicts = state.conflicts.filter((candidate) => candidate.contentId !== contentId);
    this.writeSyncState(state);
  }

  /** Persists uploaded attachment URLs without creating a new queue entry. */
  async replacePendingItem(item: ContentItem): Promise<void> {
    const state = this.readSyncState();
    if (!state.records[item.id]?.pendingUpsert) return;
    this.writeItem(item);
  }

  async preparePendingAttachments(
    upload: (attachment: ContentItem['attachments'][number]) => Promise<ContentItem['attachments'][number]>,
  ): Promise<void> {
    const pending = await this.pendingChanges();
    for (const change of pending.upserts) {
      let item = change.item;
      for (let index = 0; index < item.attachments.length; index += 1) {
        const attachment = item.attachments[index];
        if (!attachment || attachment.assetId || /^https?:\/\//i.test(attachment.uri)) continue;
        const uploaded = await upload(attachment);
        const attachments = [...item.attachments];
        attachments[index] = uploaded;
        item = contentItemSchema.parse({ ...item, attachments });
        await this.replacePendingItem(item);
      }
    }
  }

  private applyRemoteItem(remote: SyncContentItem): void {
    if (remote.deletedAt) this.removeLocalItem(remote.item.id, true);
    else this.writeItem(remote.item);
  }

  private writeItem(item: ContentItem): void {
    const items = this.readItems();
    const index = items.findIndex((candidate) => candidate.id === item.id);
    if (index >= 0) items[index] = item;
    else items.unshift(item);
    Taro.setStorageSync(this.contentStorageKey, items);
  }

  private removeLocalItem(id: string, removeRelated: boolean): void {
    Taro.setStorageSync(this.contentStorageKey, this.readItems().filter((item) => item.id !== id));
    if (!removeRelated) return;
    Taro.setStorageSync(this.versionStorageKey, this.readVersions().filter((version) => version.contentId !== id));
    Taro.setStorageSync(this.commentStorageKey, this.readComments().filter((comment) => comment.contentId !== id));
  }

  private readItems(): ContentItem[] {
    return readArray(this.contentStorageKey)
      .map((value) => contentItemSchema.safeParse(value))
      .filter((result) => result.success)
      .map((result) => result.data);
  }

  private readVersions(): ContentVersion[] {
    return readArray(this.versionStorageKey) as ContentVersion[];
  }

  private readComments(): ContentComment[] {
    return readArray(this.commentStorageKey) as ContentComment[];
  }

  private readSyncState(): PersistedSyncState {
    const fallback: PersistedSyncState = { cursor: null, records: {}, conflicts: [] };
    try {
      const value: unknown = Taro.getStorageSync(this.syncStorageKey);
      if (!value || typeof value !== 'object') return fallback;
      const raw = value as Partial<PersistedSyncState>;
      const records: Record<string, ContentSyncMetadata> = {};
      if (raw.records && typeof raw.records === 'object') {
        for (const [id, candidate] of Object.entries(raw.records)) {
          const parsed = parseMetadata(candidate);
          if (parsed) records[id] = parsed;
        }
      }
      const conflicts = Array.isArray(raw.conflicts)
        ? raw.conflicts.map((conflict) => contentConflictSchema.safeParse(conflict)).filter((result) => result.success).map((result) => result.data)
        : [];
      return { cursor: typeof raw.cursor === 'string' ? raw.cursor : null, records, conflicts };
    } catch {
      return fallback;
    }
  }

  private writeSyncState(state: PersistedSyncState): void {
    Taro.setStorageSync(this.syncStorageKey, state);
  }

  private get contentStorageKey() { return contentKey(this.scope); }
  private get versionStorageKey() { return versionKey(this.scope); }
  private get commentStorageKey() { return commentKey(this.scope); }
  private get syncStorageKey() { return `${STORAGE_PREFIX}:sync:${this.scope}`; }
}

function contentKey(scope: string): string {
  return scope === GUEST_SCOPE ? `${STORAGE_PREFIX}:content` : `${STORAGE_PREFIX}:content:${scope}`;
}

function versionKey(scope: string): string {
  return scope === GUEST_SCOPE ? `${STORAGE_PREFIX}:versions` : `${STORAGE_PREFIX}:versions:${scope}`;
}

function commentKey(scope: string): string {
  return scope === GUEST_SCOPE ? `${STORAGE_PREFIX}:comments` : `${STORAGE_PREFIX}:comments:${scope}`;
}

function emptyMetadata(): ContentSyncMetadata {
  return { revision: 0, serverUpdatedAt: null };
}

function parseMetadata(value: unknown): ContentSyncMetadata | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<ContentSyncMetadata>;
  if (!Number.isInteger(raw.revision) || (raw.revision ?? -1) < 0) return null;
  return {
    revision: raw.revision as number,
    serverUpdatedAt: typeof raw.serverUpdatedAt === 'string' ? raw.serverUpdatedAt : null,
    ...(parseMutation(raw.pendingUpsert) ? { pendingUpsert: parseMutation(raw.pendingUpsert) as PendingMutation } : {}),
    ...(parseMutation(raw.pendingDeletion) ? { pendingDeletion: parseMutation(raw.pendingDeletion) as PendingMutation } : {}),
  };
}

function parseMutation(value: unknown): PendingMutation | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<PendingMutation>;
  return typeof raw.idempotencyKey === 'string' && Number.isInteger(raw.baseRevision) && (raw.baseRevision ?? -1) >= 0
    ? { idempotencyKey: raw.idempotencyKey, baseRevision: raw.baseRevision as number }
    : null;
}

function replaceConflict(conflicts: ContentConflict[], next: ContentConflict): ContentConflict[] {
  return [...conflicts.filter((conflict) => conflict.contentId !== next.contentId), next];
}

function normalizeScope(userId: string): string {
  return userId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
}

function createUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function readArray(key: string): unknown[] {
  try {
    const value: unknown = Taro.getStorageSync(key);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
