import { z } from 'zod';

export const contentKindSchema = z.enum([
  'note',
  'article',
  'sticker',
  'image',
  'gallery',
  'video',
  'audio',
  'file',
]);

export type ContentKind = z.infer<typeof contentKindSchema>;

export const attachmentKindSchema = z.enum([
  'image',
  'video',
  'audio',
  'document',
]);

export type AttachmentKind = z.infer<typeof attachmentKindSchema>;

export const attachmentSchema = z.object({
  id: z.string().min(1),
  assetId: z.string().nullable().optional(),
  kind: attachmentKindSchema,
  name: z.string().min(1),
  uri: z.string().min(1),
  mimeType: z.string().nullable(),
  size: z.number().int().nonnegative().nullable(),
  width: z.number().positive().nullable(),
  height: z.number().positive().nullable(),
  durationMs: z.number().nonnegative().nullable(),
  coverUri: z.string().nullable().optional(),
});

export type Attachment = z.infer<typeof attachmentSchema>;

export const contentItemSchema = z.object({
  id: z.string().min(1),
  kind: contentKindSchema,
  title: z.string().trim().max(120),
  body: z.string().max(100_000),
  excerpt: z.string().max(240),
  location: z.string().max(80).default(''),
  authorName: z.string().max(40).default('我'),
  lastSubmittedBy: z.string().max(40).default(''),
  teamName: z.string().max(40).default('无'),
  teamNames: z.array(z.string().trim().min(1).max(40)).max(20).default(['无']),
  isPublic: z.boolean().default(false),
  attachments: z.array(attachmentSchema).max(20),
  tags: z.array(z.string().trim().min(1).max(24)).max(10),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/).default('0.0.1'),
  isFavorite: z.boolean(),
  isLiked: z.boolean().default(false),
  readCount: z.number().int().nonnegative().default(0),
  likeCount: z.number().int().nonnegative().default(0),
  shareCount: z.number().int().nonnegative().default(0),
  favoriteCount: z.number().int().nonnegative().default(0),
  commentCount: z.number().int().nonnegative().default(0),
});

export type ContentItem = z.infer<typeof contentItemSchema>;

export const contentDraftSchema = z
  .object({
    title: z.string().trim().max(120),
    body: z.string().max(100_000),
    attachments: z.array(attachmentSchema).max(20),
    tags: z.array(z.string().trim().min(1).max(24)).max(5),
    location: z.string().trim().max(80).optional(),
    authorName: z.string().trim().max(40).optional(),
    teamNames: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    isPublic: z.boolean().optional(),
  })
  .superRefine((draft, context) => {
    if (!draft.title && !draft.body.trim() && draft.attachments.length === 0) {
      context.addIssue({
        code: 'custom',
        message: 'content.empty',
        path: ['body'],
      });
    }
    const bodyLength = draft.body.trim().length;
    if (bodyLength >= 300 && !draft.title.trim()) {
      context.addIssue({ code: 'custom', message: 'content.articleTitleRequired', path: ['title'] });
    }
    if (draft.attachments.filter((attachment) => attachment.kind === 'video').length > 1) {
      context.addIssue({ code: 'custom', message: 'content.onlyOneVideo', path: ['attachments'] });
    }
    if (draft.attachments.filter((attachment) => attachment.kind === 'audio').length > 1) {
      context.addIssue({ code: 'custom', message: 'content.onlyOneAudio', path: ['attachments'] });
    }
    if (draft.attachments.some((attachment) => attachment.kind === 'audio' || attachment.kind === 'video') && !draft.title.trim() && !draft.body.trim()) {
      context.addIssue({ code: 'custom', message: 'content.mediaTextRequired', path: ['body'] });
    }
  });

export type ContentDraft = z.infer<typeof contentDraftSchema>;

export type ContentFilter = 'all' | ContentKind | 'liked' | 'favorite';

export function inferContentKind(draft: ContentDraft): ContentKind {
  if (draft.body.trim().length >= 300) return 'article';
  const kinds = new Set(draft.attachments.map((attachment) => attachment.kind));
  const images = draft.attachments.filter((attachment) => attachment.kind === 'image');

  if (draft.attachments.length === 0) {
    return 'note';
  }
  if (images.length > 0 && images.length === draft.attachments.length) return 'sticker';
  if (kinds.has('video')) return 'video';
  if (kinds.has('audio')) return 'audio';
  if (kinds.has('document')) return 'file';
  if (kinds.has('image')) return 'image';
  return 'note';
}

export function createContentItem(
  input: ContentDraft,
  dependencies: { id: () => string; now: () => Date },
): ContentItem {
  const draft = contentDraftSchema.parse(input);
  const kind = inferContentKind(draft);
  const title = draft.title || (kind === 'note' || kind === 'sticker' || kind === 'audio' || kind === 'video' ? '' : deriveTitle(draft.body, draft.attachments[0]?.name));
  const timestamp = dependencies.now().toISOString();

  return contentItemSchema.parse({
    id: dependencies.id(),
    kind,
    title,
    body: draft.body.trim(),
    excerpt: createExcerpt(draft.body),
    location: draft.location?.trim() ?? '',
    authorName: draft.authorName?.trim() || '我',
    lastSubmittedBy: draft.authorName?.trim() || '我',
    teamName: '无',
    teamNames: normalizeTeams(draft.teamNames),
    isPublic: draft.isPublic ?? false,
    attachments: draft.attachments,
    tags: [...new Set(draft.tags.map((tag) => tag.trim()).filter(Boolean))],
    createdAt: timestamp,
    updatedAt: timestamp,
    version: '0.0.1',
    isFavorite: false,
    isLiked: false,
    readCount: 0,
    likeCount: 0,
    shareCount: 0,
    favoriteCount: 0,
    commentCount: 0,
  });
}

export function toggleFavorite(item: ContentItem, now: Date): ContentItem {
  return contentItemSchema.parse({
    ...item,
    isFavorite: !item.isFavorite,
    favoriteCount: Math.max(0, item.favoriteCount + (item.isFavorite ? -1 : 1)),
    updatedAt: now.toISOString(),
  });
}

export function toggleLike(item: ContentItem, now: Date): ContentItem {
  return contentItemSchema.parse({
    ...item,
    isLiked: !item.isLiked,
    likeCount: Math.max(0, item.likeCount + (item.isLiked ? -1 : 1)),
    updatedAt: now.toISOString(),
  });
}

export function incrementMetric(item: ContentItem, metric: 'readCount' | 'shareCount' | 'commentCount', now: Date): ContentItem {
  return contentItemSchema.parse({ ...item, [metric]: item[metric] + 1, updatedAt: now.toISOString() });
}

function deriveTitle(body: string, attachmentName?: string): string {
  const firstLine = body.trim().split(/\r?\n/, 1)[0]?.trim();
  return (firstLine || attachmentName || '未命名内容').slice(0, 120);
}

function createExcerpt(body: string): string {
  return body.replace(/\s+/g, ' ').trim().slice(0, 240);
}

function normalizeTeams(teamNames?: readonly string[]): string[] {
  const teams = [...new Set((teamNames ?? []).map((team) => team.trim()).filter(Boolean))];
  return teams.length > 0 ? teams : ['无'];
}
