import { extractModeratedText } from './content-safety.interceptor';
import { splitTextForModeration } from './content-safety.service';

describe('content safety input selection', () => {
  it('collects user-generated text but excludes identifiers and tokens', () => {
    expect(extractModeratedText({
      refreshToken: 'secret-token',
      upserts: [{ item: { id: 'content-id', title: '标题', body: '正文', tags: ['标签'], attachments: [{ name: '说明.pdf' }] } }],
    })).toEqual(['标题', '正文', '标签', '说明.pdf']);
  });

  it('deduplicates, trims and chunks long text for the platform API', () => {
    expect(splitTextForModeration([' 同一段 ', '同一段'], 20)).toEqual(['同一段']);
    expect(splitTextForModeration(['123456789', 'abcdefghi'], 10)).toEqual(['123456789\n', 'abcdefghi']);
  });
});
