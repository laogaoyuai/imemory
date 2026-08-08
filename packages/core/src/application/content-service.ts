import { produce } from 'immer';
import { BehaviorSubject, distinctUntilChanged, map, type Observable } from 'rxjs';

import type { ContentRepository, ContentVersion, VersionedContentRepository } from './content-repository';
import {
  createContentItem,
  toggleFavorite,
  toggleLike,
  incrementMetric,
  type ContentDraft,
  type ContentFilter,
  type ContentItem,
} from '../domain/content';
import { queryContent } from '../domain/query';

export interface ContentState {
  items: ContentItem[];
  filter: ContentFilter;
  keyword: string;
  tags: string[];
  locations: string[];
  loading: boolean;
}

export class ContentService {
  private readonly stateSubject = new BehaviorSubject<ContentState>({
    items: [],
    filter: 'all',
    keyword: '',
    tags: [],
    locations: [],
    loading: false,
  });

  readonly state$ = this.stateSubject.asObservable();
  readonly visibleItems$: Observable<ContentItem[]> = this.state$.pipe(
    map((state) => queryContent(state.items, state)),
    distinctUntilChanged((previous, current) =>
      previous.length === current.length && previous.every((item, index) => item === current[index]),
    ),
  );

  constructor(
    private readonly repository: ContentRepository,
    private readonly dependencies: { id: () => string; now: () => Date },
  ) {}

  get snapshot(): ContentState {
    return this.stateSubject.value;
  }

  async hydrate(): Promise<void> {
    this.patch((draft) => {
      draft.loading = true;
    });
    const items = await this.repository.list();
    this.patch((draft) => {
      draft.items = items;
      draft.loading = false;
    });
  }

  setQuery(query: Partial<Pick<ContentState, 'filter' | 'keyword' | 'tags' | 'locations'>>): void {
    this.patch((draft) => {
      if (query.filter !== undefined) draft.filter = query.filter;
      if (query.keyword !== undefined) draft.keyword = query.keyword;
      if (query.tags !== undefined) draft.tags = query.tags;
      if (query.locations !== undefined) draft.locations = query.locations;
    });
  }

  async publish(draft: ContentDraft): Promise<ContentItem> {
    const item = createContentItem(draft, this.dependencies);
    await this.repository.save(item);
    await this.saveVersion(item);
    this.patch((state) => {
      state.items.unshift(item);
    });
    return item;
  }

  async update(id: string, draft: ContentDraft, customVersion?: string): Promise<ContentItem> {
    const current = this.snapshot.items.find((item) => item.id === id) ?? await this.repository.get(id);
    if (!current) throw new Error('内容不存在');
    const parsed = createContentItem({ ...draft, authorName: draft.authorName ?? current.authorName }, this.dependencies);
    const changed = JSON.stringify({ title: parsed.title, body: parsed.body, excerpt: parsed.excerpt, location: parsed.location, teamNames: parsed.teamNames, isPublic: parsed.isPublic, attachments: parsed.attachments, tags: parsed.tags }) !==
      JSON.stringify({ title: current.title, body: current.body, excerpt: current.excerpt, location: current.location, teamNames: current.teamNames, isPublic: current.isPublic, attachments: current.attachments, tags: current.tags });
    if (!changed && !customVersion?.trim()) return current;
    const version = customVersion?.trim() || incrementPatch(current.version);
    if (!isGreaterVersion(version, current.version)) throw new Error('版本号只能变大');
    const updated: ContentItem = {
      ...parsed,
      id: current.id,
      authorName: current.authorName,
      lastSubmittedBy: draft.authorName?.trim() || current.lastSubmittedBy || current.authorName,
      createdAt: current.createdAt,
      updatedAt: this.dependencies.now().toISOString(),
      version,
      isFavorite: current.isFavorite,
      isLiked: current.isLiked,
      readCount: current.readCount,
      likeCount: current.likeCount,
      shareCount: current.shareCount,
      favoriteCount: current.favoriteCount,
      commentCount: current.commentCount,
    };
    await this.saveVersion(current);
    await this.repository.save(updated);
    await this.saveVersion(updated);
    this.patch((state) => {
      const index = state.items.findIndex((item) => item.id === id);
      if (index >= 0) state.items[index] = updated;
    });
    return updated;
  }

  async listVersions(id: string): Promise<ContentVersion[]> {
    const repository = this.versionRepository();
    return repository ? repository.listVersions(id) : [];
  }

  async getVersion(versionId: string): Promise<ContentVersion | null> {
    const repository = this.versionRepository();
    return repository ? repository.getVersion(versionId) : null;
  }

  async setVersionStatus(versionId: string, status: ContentVersion['status']): Promise<void> {
    const repository = this.versionRepository();
    if (repository) await repository.updateVersionStatus(versionId, status);
  }

  async rollback(id: string, versionId: string): Promise<ContentItem> {
    const version = await this.getVersion(versionId);
    const current = this.snapshot.items.find((item) => item.id === id);
    if (!version || !current || version.contentId !== id) throw new Error('历史版本不存在');
    const restored = { ...version.snapshot, id, updatedAt: this.dependencies.now().toISOString() };
    await this.saveVersion(current);
    await this.repository.save(restored);
    this.patch((state) => {
      const index = state.items.findIndex((item) => item.id === id);
      if (index >= 0) state.items[index] = restored;
    });
    return restored;
  }

  async toggleFavorite(id: string): Promise<void> {
    const current = this.snapshot.items.find((item) => item.id === id);
    if (!current) return;
    const updated = toggleFavorite(current, this.dependencies.now());
    await this.repository.save(updated);
    this.patch((state) => {
      const index = state.items.findIndex((item) => item.id === id);
      if (index >= 0) state.items[index] = updated;
    });
  }

  async toggleLike(id: string): Promise<void> {
    const current = this.snapshot.items.find((item) => item.id === id);
    if (!current) return;
    const updated = toggleLike(current, this.dependencies.now());
    await this.repository.save(updated);
    this.patch((state) => {
      const index = state.items.findIndex((item) => item.id === id);
      if (index >= 0) state.items[index] = updated;
    });
  }

  async incrementMetric(id: string, metric: 'readCount' | 'shareCount' | 'commentCount'): Promise<void> {
    const current = this.snapshot.items.find((item) => item.id === id);
    if (!current) return;
    const updated = incrementMetric(current, metric, this.dependencies.now());
    await this.repository.save(updated);
    this.patch((state) => {
      const index = state.items.findIndex((item) => item.id === id);
      if (index >= 0) state.items[index] = updated;
    });
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
    this.patch((state) => {
      state.items = state.items.filter((item) => item.id !== id);
    });
  }

  private patch(recipe: (draft: ContentState) => void): void {
    this.stateSubject.next(produce(this.stateSubject.value, recipe));
  }

  private versionRepository(): VersionedContentRepository | null {
    const repository = this.repository as Partial<VersionedContentRepository>;
    return typeof repository.listVersions === 'function' && typeof repository.getVersion === 'function'
      ? this.repository as VersionedContentRepository
      : null;
  }

  private async saveVersion(item: ContentItem): Promise<void> {
    const repository = this.versionRepository();
    if (!repository) return;
    await repository.saveVersion({
      // One history entry per content/version. Updating a content item stores
      // the previous snapshot again, so the identifier must be stable.
      id: `${item.id}-${item.version}`,
      contentId: item.id,
      version: item.version,
      title: item.title,
      authorName: item.lastSubmittedBy || item.authorName,
      submittedAt: item.updatedAt,
      status: 'approved',
      snapshot: item,
    });
  }
}

function incrementPatch(version: string): string {
  const [major, minor, patch] = version.split('.').map(Number);
  return `${major || 0}.${minor || 0}.${(patch || 0) + 1}`;
}

function isGreaterVersion(next: string, current: string): boolean {
  const nextParts = next.split('.').map(Number);
  const currentParts = current.split('.').map(Number);
  if (nextParts.length !== 3 || currentParts.length !== 3 || nextParts.some((part) => !Number.isInteger(part) || part < 0) || currentParts.some((part) => !Number.isInteger(part) || part < 0)) return false;
  for (let index = 0; index < 3; index += 1) {
    const nextPart = nextParts[index] ?? 0;
    const currentPart = currentParts[index] ?? 0;
    if (nextPart !== currentPart) return nextPart > currentPart;
  }
  return false;
}
