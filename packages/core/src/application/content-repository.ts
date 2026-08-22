import type { ContentItem } from '../domain/content';
import type { ContentComment } from '../domain/comment';

export interface ContentVersion {
  id: string;
  contentId: string;
  version: string;
  title: string;
  authorName: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  snapshot: ContentItem;
}

export interface ContentRepository {
  list(): Promise<ContentItem[]>;
  get(id: string): Promise<ContentItem | null>;
  save(item: ContentItem): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface CommentRepository {
  listComments(contentId: string): Promise<ContentComment[]>;
  saveComment(comment: ContentComment): Promise<void>;
  toggleCommentLike(commentId: string): Promise<ContentComment | null>;
}

export interface VersionedContentRepository extends ContentRepository {
  saveVersion(version: ContentVersion): Promise<void>;
  listVersions(contentId: string): Promise<ContentVersion[]>;
  getVersion(versionId: string): Promise<ContentVersion | null>;
  updateVersionStatus(versionId: string, status: ContentVersion['status']): Promise<void>;
  removeVersion(versionId: string): Promise<void>;
}
