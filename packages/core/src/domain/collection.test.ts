import { createContentItem } from './content';
import { canAddToCollection, moveCollectionContent, normalizeCollectionContentIds } from './collection';

describe('collection rules', () => {
  it('accepts only personal content matching the collection type', () => {
    const note = createContentItem({ title: '', body: '一条短文', attachments: [], tags: [] }, dependencies);
    expect(canAddToCollection('note', note)).toBe(true);
    expect(canAddToCollection('video', note)).toBe(false);
    expect(canAddToCollection('note', { ...note, projectIds: [projectId] })).toBe(false);
  });

  it('deduplicates content identifiers while preserving their order', () => {
    expect(normalizeCollectionContentIds(['a', 'b', 'a', ' ', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('moves content without crossing collection boundaries', () => {
    expect(moveCollectionContent(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveCollectionContent(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
  });
});

const projectId = '20000000-0000-4000-8000-000000000001';
const dependencies = { id: () => 'content-1', now: () => new Date('2026-08-25T00:00:00.000Z') };
