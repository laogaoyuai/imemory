import { selectCommentHighlights, type ContentComment } from './comment';

describe('comment highlights', () => {
  it('shows highly liked comments first and fills with earliest unique comments', () => {
    const comments = [comment('early', 0, '2026-08-01T00:00:00.000Z'), comment('popular', 8, '2026-08-03T00:00:00.000Z'), comment('middle', 2, '2026-08-02T00:00:00.000Z')];
    expect(selectCommentHighlights(comments).map((item) => item.id)).toEqual(['popular', 'middle', 'early']);
  });

  it('respects an empty or bounded preview', () => {
    expect(selectCommentHighlights([comment('one', 0, '2026-08-01T00:00:00.000Z')], 0)).toEqual([]);
    expect(selectCommentHighlights([comment('one', 0, '2026-08-01T00:00:00.000Z')], 1)).toHaveLength(1);
  });
});

function comment(id: string, likeCount: number, createdAt: string): ContentComment {
  return { id, contentId: 'content-1', authorName: '用户', body: id, createdAt, replyToId: null, replyToAuthorName: null, replyToBody: null, isLiked: false, likeCount };
}
