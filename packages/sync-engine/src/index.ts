import type {
  ContentListResponse,
  ContentSyncRequest,
  ContentSyncResponse,
} from '@atlas/contracts';

export interface ContentSyncLocalStore {
  prepareForSync(): Promise<void>;
  pendingChanges(): Promise<ContentSyncRequest>;
  acknowledge(response: ContentSyncResponse, submitted: ContentSyncRequest): Promise<void>;
  mergeRemote(response: ContentListResponse): Promise<void>;
  getCursor(): Promise<string | null>;
  setCursor(cursor: string): Promise<void>;
}

export interface ContentSyncRemote {
  listContents(since?: string): Promise<ContentListResponse>;
  syncContents(input: ContentSyncRequest): Promise<ContentSyncResponse>;
}

export interface ContentSyncResult {
  pushed: number;
  pulled: number;
  conflicts: number;
  serverTime: string;
}

/**
 * Runs one deterministic push-then-pull cycle. The local adapter owns merge
 * policy and durable queue state; this class only coordinates network order.
 */
export class ContentSyncCoordinator {
  constructor(
    private readonly local: ContentSyncLocalStore,
    private readonly remote: ContentSyncRemote,
  ) {}

  async synchronize(): Promise<ContentSyncResult> {
    await this.local.prepareForSync();
    const pending = await this.local.pendingChanges();
    let pushed = 0;
    let conflicts = 0;

    if (pending.upserts.length > 0 || pending.deletions.length > 0) {
      const response = await this.remote.syncContents(pending);
      await this.local.acknowledge(response, pending);
      pushed = response.accepted.length;
      conflicts = response.conflicts.length;
    }

    const cursor = await this.local.getCursor();
    const pulled = await this.remote.listContents(cursor ?? undefined);
    await this.local.mergeRemote(pulled);
    await this.local.setCursor(pulled.serverTime);

    return {
      pushed,
      pulled: pulled.items.length,
      conflicts,
      serverTime: pulled.serverTime,
    };
  }
}
