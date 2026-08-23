import { CallHandler, ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';

import type { AuthenticatedRequest } from '../auth/auth.guard';
import { ContentSafetyService } from './content-safety.service';

const moderatedKeys = new Set(['displayName', 'bio', 'name', 'description', 'title', 'body', 'tags', 'location', 'content']);

@Injectable()
export class ContentSafetyInterceptor implements NestInterceptor {
  constructor(private readonly safety: ContentSafetyService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.atlasUser || !['POST', 'PATCH', 'PUT'].includes(request.method)) return next.handle();
    const values = extractModeratedText(request.body);
    if (values.length > 0) {
      const scene = request.path.startsWith('/api/v1/profile') ? 1 : 2;
      await this.safety.assertUserTextSafe(request.atlasUser.id, values, scene);
    }
    return next.handle();
  }
}

export function extractModeratedText(value: unknown, key = ''): string[] {
  if (typeof value === 'string') return moderatedKeys.has(key) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap((item) => extractModeratedText(item, key));
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([childKey, child]) => extractModeratedText(child, childKey));
}
