import type { ContentItem } from '../domain/content';
import type { ContentRepository } from './content-repository';
import { ContentService } from './content-service';

class MemoryRepository implements ContentRepository {
  readonly items = new Map<string, ContentItem>();

  async list(): Promise<ContentItem[]> {
    return [...this.items.values()];
  }

  async get(id: string): Promise<ContentItem | null> {
    return this.items.get(id) ?? null;
  }

  async save(item: ContentItem): Promise<void> {
    this.items.set(item.id, item);
  }

  async remove(id: string): Promise<void> {
    this.items.delete(id);
  }
}

describe('ContentService', () => {
  it('publishes, favorites and removes through the repository boundary', async () => {
    const repository = new MemoryRepository();
    const service = new ContentService(repository, {
      id: () => 'content-1',
      now: () => new Date('2026-08-06T00:00:00.000Z'),
    });

    const item = await service.publish({
      title: '一条灵感',
      body: '核心逻辑不依赖任何平台 API。',
      attachments: [],
      tags: ['架构'],
    });
    expect(repository.items.get(item.id)).toEqual(item);
    expect(service.snapshot.items).toHaveLength(1);

    await service.toggleFavorite(item.id);
    expect(service.snapshot.items[0]?.isFavorite).toBe(true);

    await service.remove(item.id);
    expect(repository.items.size).toBe(0);
    expect(service.snapshot.items).toHaveLength(0);
  });
});
