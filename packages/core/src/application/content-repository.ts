import type { ContentItem } from '../domain/content';

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

export interface VersionedContentRepository extends ContentRepository {
  saveVersion(version: ContentVersion): Promise<void>;
  listVersions(contentId: string): Promise<ContentVersion[]>;
  getVersion(versionId: string): Promise<ContentVersion | null>;
  updateVersionStatus(versionId: string, status: ContentVersion['status']): Promise<void>;
}
