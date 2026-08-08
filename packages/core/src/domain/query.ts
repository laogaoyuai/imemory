import type { ContentFilter, ContentItem } from './content';

export interface ContentQuery {
  filter: ContentFilter;
  keyword: string;
  tags: readonly string[];
  locations: readonly string[];
}

export function queryContent(items: readonly ContentItem[], query: ContentQuery): ContentItem[] {
  const keyword = query.keyword.trim().toLocaleLowerCase();

  return items
    .filter((item) => {
      if (query.filter === 'favorite' && !item.isFavorite) return false;
      if (query.filter === 'liked' && !item.isLiked) return false;
      if (query.filter === 'sticker' && !['sticker', 'image', 'gallery'].includes(item.kind)) return false;
      if (query.filter !== 'all' && query.filter !== 'favorite' && query.filter !== 'liked' && query.filter !== 'sticker' && item.kind !== query.filter) {
        return false;
      }
      if (query.tags.length > 0 && !query.tags.some((tag) => item.tags.includes(tag))) {
        return false;
      }
      if (query.locations.length > 0 && !query.locations.includes(item.location)) {
        return false;
      }
      if (!keyword) return true;
      return [item.title, item.body, ...item.tags]
        .join(' ')
        .toLocaleLowerCase()
        .includes(keyword);
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
