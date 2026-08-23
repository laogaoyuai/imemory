import { contentDraftSchema, createContentItem, inferContentKind, type ContentDraft } from './content';
import { queryContent } from './query';

const emptyDraft: ContentDraft = { title: '', body: '', attachments: [], tags: [] };
const dependencies = {
  id: () => 'content-1',
  now: () => new Date('2026-08-06T00:00:00.000Z'),
};

describe('content domain', () => {
  it('infers note and article from body length', () => {
    expect(inferContentKind({ ...emptyDraft, body: '简短记录' })).toBe('note');
    expect(inferContentKind({ ...emptyDraft, body: '长'.repeat(300), title: '长文章' })).toBe('article');
  });

  it('infers a sticker when all attachments are images', () => {
    expect(
      inferContentKind({
        ...emptyDraft,
        attachments: [1, 2].map((id) => ({
          id: String(id),
          kind: 'image',
          name: `${id}.jpg`,
          uri: `file://${id}.jpg`,
          mimeType: 'image/jpeg',
          size: null,
          width: 100,
          height: 100,
          durationMs: null,
        })),
      }),
    ).toBe('sticker');
  });

  it('keeps an article type when images are attached', () => {
    expect(inferContentKind({
      ...emptyDraft,
      title: '图文文章',
      body: '长'.repeat(300),
      attachments: [{ id: '1', kind: 'image', name: 'a.jpg', uri: 'file://a.jpg', mimeType: 'image/jpeg', size: null, width: 100, height: 100, durationMs: null }],
    })).toBe('article');
  });

  it('keeps a note title empty and normalizes tags', () => {
    const item = createContentItem(
      { ...emptyDraft, body: '第一行\n第二行', tags: ['灵感', '灵感'] },
      dependencies,
    );
    expect(item.title).toBe('');
    expect(item.tags).toEqual(['灵感']);
  });

  it('rejects mixed image, video, and audio attachments', () => {
    const attachment = { name: 'media', uri: 'file://media', mimeType: null, size: null, width: null, height: null, durationMs: null };
    const result = contentDraftSchema.safeParse({
      ...emptyDraft,
      body: '带媒体的内容',
      attachments: [
        { ...attachment, id: 'image-1', kind: 'image' },
        { ...attachment, id: 'video-1', kind: 'video' },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects more than nine images', () => {
    const result = contentDraftSchema.safeParse({
      ...emptyDraft,
      attachments: Array.from({ length: 10 }, (_, index) => ({
        id: `image-${index}`,
        kind: 'image',
        name: `${index}.jpg`,
        uri: `file://${index}.jpg`,
        mimeType: 'image/jpeg',
        size: null,
        width: 100,
        height: 100,
        durationMs: null,
      })),
    });
    expect(result.success).toBe(false);
  });

  it('queries by filter and keyword', () => {
    const item = createContentItem(
      { ...emptyDraft, title: '旅行计划', body: '去杭州', tags: ['生活'] },
      dependencies,
    );
    expect(queryContent([item], { filter: 'note', keyword: '杭州', tags: [], locations: [] })).toEqual([item]);
    expect(queryContent([item], { filter: 'favorite', keyword: '', tags: [], locations: [] })).toEqual([]);
    expect(queryContent([item], { filter: 'all', keyword: '', tags: ['生活'], locations: [] })).toEqual([item]);
  });
});
