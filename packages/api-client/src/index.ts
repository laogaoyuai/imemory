import {
  apiErrorSchema,
  apiPaths,
  collectionDetailResponseSchema,
  collectionListResponseSchema,
  commentListResponseSchema,
  commentMutationResponseSchema,
  createCommentResponseSchema,
  contentListResponseSchema,
  contentRollbackResponseSchema,
  contentSyncResponseSchema,
  contentVersionListResponseSchema,
  contentVersionMutationResponseSchema,
  profileResponseSchema,
  projectDetailResponseSchema,
  projectListResponseSchema,
  shareContentResponseSchema,
  sharedContentResponseSchema,
  userSearchResponseSchema,
  userProfileResponseSchema,
  uploadPresignResponseSchema,
  type ApiError,
  type AuthSession,
  type CollectionDetailResponse,
  type CollectionListResponse,
  type CommentListResponse,
  type CommentMutationResponse,
  type ContentListResponse,
  type ContentRollbackResponse,
  type ContentSyncRequest,
  type ContentSyncResponse,
  type ContentVersionListResponse,
  type ContentVersionMutationResponse,
  type CreateCollectionRequest,
  type CreateCommentRequest,
  type CreateCommentResponse,
  type CreateContentVersionRequest,
  type ChangeProjectRoleRequest,
  type AddProjectMemberRequest,
  type CreateProjectRequest,
  type ProfileResponse,
  type Project,
  type ProjectDetailResponse,
  type ProjectListResponse,
  type ReviewContentVersionRequest,
  type ShareContentResponse,
  type SharedContentResponse,
  type UpdateProfileRequest,
  type UpdateCollectionRequest,
  type UpdateProjectRequest,
  type UserSearchResponse,
  type UserProfileResponse,
  type UploadPresignRequest,
  type UploadPresignResponse,
  type WechatLoginRequest,
} from '@atlas/contracts';

export interface TokenStore {
  load(): Promise<AuthSession | null>;
  save(session: AuthSession): Promise<void>;
  clear(): Promise<void>;
}

export interface HttpRequest {
  url: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  headers: Record<string, string>;
  body?: unknown;
}

export interface HttpResponse {
  status: number;
  data: unknown;
}

export interface HttpTransport {
  send(request: HttpRequest): Promise<HttpResponse>;
}

export class AtlasApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AtlasApiError';
  }
}

export class AtlasApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly transport: HttpTransport,
    private readonly tokens: TokenStore,
  ) {}

  async loginWithWechat(input: WechatLoginRequest): Promise<AuthSession> {
    const session = parseAuthSession(await this.request(apiPaths.wechatLogin, 'POST', input, false));
    try {
      await this.tokens.save(session);
    } catch (error) {
      throw new Error(`登录状态保存失败：${errorMessage(error)}`);
    }
    return session;
  }

  async refreshSession(): Promise<AuthSession> {
    const current = await this.tokens.load();
    if (!current) throw new AtlasApiError(401, 'session_missing', '尚未登录');
    const session = parseAuthSession(await this.request(
      apiPaths.refreshSession,
      'POST',
      { refreshToken: current.refreshToken },
      false,
    ));
    await this.tokens.save(session);
    return session;
  }

  async listContents(since?: string): Promise<ContentListResponse> {
    const suffix = since ? `?since=${encodeURIComponent(since)}` : '';
    return contentListResponseSchema.parse(await this.authenticatedRequest(`${apiPaths.contents}${suffix}`, 'GET'));
  }

  async syncContents(input: ContentSyncRequest): Promise<ContentSyncResponse> {
    return contentSyncResponseSchema.parse(await this.authenticatedRequest(apiPaths.contentSync, 'POST', input));
  }

  async getContent(contentId: string): Promise<SharedContentResponse> {
    return sharedContentResponseSchema.parse(await this.authenticatedRequest(
      `${apiPaths.contents}/${encodeURIComponent(contentId)}`,
      'GET',
    ));
  }

  async listComments(contentId: string): Promise<CommentListResponse> {
    return commentListResponseSchema.parse(await this.authenticatedRequest(
      `${apiPaths.contents}/${encodeURIComponent(contentId)}/comments`,
      'GET',
    ));
  }

  async createComment(contentId: string, input: CreateCommentRequest): Promise<CreateCommentResponse> {
    return createCommentResponseSchema.parse(await this.authenticatedRequest(
      `${apiPaths.contents}/${encodeURIComponent(contentId)}/comments`,
      'POST',
      input,
    ));
  }

  async toggleCommentLike(contentId: string, commentId: string): Promise<CommentMutationResponse> {
    return commentMutationResponseSchema.parse(await this.authenticatedRequest(
      `${apiPaths.contents}/${encodeURIComponent(contentId)}/comments/${encodeURIComponent(commentId)}/like`,
      'POST',
    ));
  }

  async shareContent(contentId: string): Promise<ShareContentResponse> {
    return shareContentResponseSchema.parse(await this.authenticatedRequest(
      `${apiPaths.contents}/${encodeURIComponent(contentId)}/share`,
      'POST',
    ));
  }

  async listContentVersions(contentId: string): Promise<ContentVersionListResponse> {
    return contentVersionListResponseSchema.parse(await this.authenticatedRequest(
      `${apiPaths.contents}/${encodeURIComponent(contentId)}/versions`,
      'GET',
    ));
  }

  async createContentVersion(contentId: string, input: CreateContentVersionRequest): Promise<ContentVersionMutationResponse> {
    return contentVersionMutationResponseSchema.parse(await this.authenticatedRequest(
      `${apiPaths.contents}/${encodeURIComponent(contentId)}/versions`,
      'POST',
      input,
    ));
  }

  async reviewContentVersion(
    contentId: string,
    versionId: string,
    input: ReviewContentVersionRequest,
  ): Promise<ContentVersionMutationResponse> {
    return contentVersionMutationResponseSchema.parse(await this.authenticatedRequest(
      `${apiPaths.contents}/${encodeURIComponent(contentId)}/versions/${encodeURIComponent(versionId)}`,
      'PATCH',
      input,
    ));
  }

  async rollbackContentVersion(contentId: string, versionId: string): Promise<ContentRollbackResponse> {
    return contentRollbackResponseSchema.parse(await this.authenticatedRequest(
      `${apiPaths.contents}/${encodeURIComponent(contentId)}/versions/${encodeURIComponent(versionId)}/rollback`,
      'POST',
    ));
  }

  async listCollections(): Promise<CollectionListResponse> {
    return collectionListResponseSchema.parse(await this.authenticatedRequest(apiPaths.collections, 'GET'));
  }

  async getCollection(collectionId: string): Promise<CollectionDetailResponse> {
    return collectionDetailResponseSchema.parse(await this.authenticatedRequest(
      `${apiPaths.collections}/${encodeURIComponent(collectionId)}`,
      'GET',
    ));
  }

  async createCollection(input: CreateCollectionRequest): Promise<CollectionDetailResponse['collection']> {
    return collectionDetailResponseSchema.shape.collection.parse(await this.authenticatedRequest(
      apiPaths.collections,
      'POST',
      input,
    ));
  }

  async updateCollection(collectionId: string, input: UpdateCollectionRequest): Promise<CollectionDetailResponse> {
    return collectionDetailResponseSchema.parse(await this.authenticatedRequest(
      `${apiPaths.collections}/${encodeURIComponent(collectionId)}`,
      'PATCH',
      input,
    ));
  }

  async deleteCollection(collectionId: string): Promise<void> {
    await this.authenticatedRequest(`${apiPaths.collections}/${encodeURIComponent(collectionId)}`, 'DELETE');
  }

  async createUpload(input: UploadPresignRequest): Promise<UploadPresignResponse> {
    return uploadPresignResponseSchema.parse(await this.authenticatedRequest(apiPaths.uploadPresign, 'POST', input));
  }

  async getProfile(): Promise<ProfileResponse> {
    return profileResponseSchema.parse(await this.authenticatedRequest(apiPaths.profile, 'GET'));
  }

  async updateProfile(input: UpdateProfileRequest): Promise<ProfileResponse> {
    return profileResponseSchema.parse(await this.authenticatedRequest(apiPaths.profile, 'PATCH', input));
  }

  async listProjects(scope: 'mine' | 'discover' = 'mine'): Promise<ProjectListResponse> {
    return projectListResponseSchema.parse(await this.authenticatedRequest(`${apiPaths.projects}?scope=${scope}`, 'GET'));
  }

  async getProject(projectId: string): Promise<ProjectDetailResponse> {
    return projectDetailResponseSchema.parse(await this.authenticatedRequest(`${apiPaths.projects}/${encodeURIComponent(projectId)}`, 'GET'));
  }

  async createProject(input: CreateProjectRequest): Promise<Project> {
    return projectDetailResponseSchema.shape.project.parse(await this.authenticatedRequest(apiPaths.projects, 'POST', input));
  }

  async updateProject(projectId: string, input: UpdateProjectRequest): Promise<Project> {
    return projectDetailResponseSchema.shape.project.parse(await this.authenticatedRequest(`${apiPaths.projects}/${encodeURIComponent(projectId)}`, 'PATCH', input));
  }

  async followProject(projectId: string): Promise<Project> {
    return projectDetailResponseSchema.shape.project.parse(await this.authenticatedRequest(`${apiPaths.projects}/${encodeURIComponent(projectId)}/follow`, 'POST'));
  }

  async unfollowProject(projectId: string): Promise<void> {
    await this.authenticatedRequest(`${apiPaths.projects}/${encodeURIComponent(projectId)}/follow`, 'DELETE');
  }

  async changeProjectRole(projectId: string, userId: string, input: ChangeProjectRoleRequest): Promise<ProjectDetailResponse> {
    return projectDetailResponseSchema.parse(await this.authenticatedRequest(
      `${apiPaths.projects}/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`,
      'PATCH',
      input,
    ));
  }

  async addProjectMember(projectId: string, input: AddProjectMemberRequest): Promise<ProjectDetailResponse> {
    return projectDetailResponseSchema.parse(await this.authenticatedRequest(
      `${apiPaths.projects}/${encodeURIComponent(projectId)}/members`,
      'POST',
      input,
    ));
  }

  async searchUsers(keyword: string): Promise<UserSearchResponse> {
    return userSearchResponseSchema.parse(await this.authenticatedRequest(
      `${apiPaths.users}?q=${encodeURIComponent(keyword)}`,
      'GET',
    ));
  }

  async getUserProfile(userId: string): Promise<UserProfileResponse> {
    return userProfileResponseSchema.parse(await this.authenticatedRequest(`${apiPaths.users}/${encodeURIComponent(userId)}`, 'GET'));
  }

  async followUser(userId: string): Promise<UserProfileResponse> {
    return userProfileResponseSchema.parse(await this.authenticatedRequest(`${apiPaths.users}/${encodeURIComponent(userId)}/follow`, 'POST'));
  }

  async unfollowUser(userId: string): Promise<UserProfileResponse> {
    return userProfileResponseSchema.parse(await this.authenticatedRequest(`${apiPaths.users}/${encodeURIComponent(userId)}/follow`, 'DELETE'));
  }

  async logout(): Promise<void> {
    await this.tokens.clear();
  }

  private async authenticatedRequest(path: string, method: HttpRequest['method'], body?: unknown): Promise<unknown> {
    try {
      return await this.request(path, method, body, true);
    } catch (error) {
      if (!(error instanceof AtlasApiError) || error.status !== 401) throw error;
      await this.refreshSession();
      return this.request(path, method, body, true);
    }
  }

  private async request(path: string, method: HttpRequest['method'], body: unknown, authenticated: boolean): Promise<unknown> {
    const session = authenticated ? await this.tokens.load() : null;
    if (authenticated && !session) throw new AtlasApiError(401, 'session_missing', '尚未登录');
    const response = await this.transport.send({
      url: `${this.baseUrl.replace(/\/$/, '')}${path}`,
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Request-Id': createRequestId(),
        ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      },
      ...(body === undefined ? {} : { body }),
    });
    if (response.status >= 200 && response.status < 300) return response.data;
    throw apiError(response.status, response.data);
  }
}

function parseAuthSession(value: unknown): AuthSession {
  if (!isRecord(value) || !isRecord(value.user)) {
    throw new Error('登录响应校验失败：响应结构不完整');
  }
  const user = value.user;
  if (
    !isNonEmptyString(value.accessToken)
    || !isNonEmptyString(value.accessTokenExpiresAt)
    || !isNonEmptyString(value.refreshToken)
    || !isNonEmptyString(value.refreshTokenExpiresAt)
    || !isNonEmptyString(user.id)
    || !isNonEmptyString(user.displayName)
    || typeof user.bio !== 'string'
    || !isNonEmptyString(user.createdAt)
    || !(user.avatarUrl === null || typeof user.avatarUrl === 'string')
  ) {
    throw new Error('登录响应校验失败：响应字段无效');
  }
  return value as unknown as AuthSession;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object' && 'errMsg' in error && typeof error.errMsg === 'string') return error.errMsg;
  return String(error);
}

function createRequestId(): string {
  return `mini-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function apiError(status: number, data: unknown): AtlasApiError {
  const parsed = apiErrorSchema.safeParse(data);
  if (parsed.success) return new AtlasApiError(status, parsed.data.code, parsed.data.message, parsed.data.details);
  return new AtlasApiError(status, 'unexpected_response', `请求失败（${status}）`);
}

export function isApiError(value: unknown): value is ApiError {
  return apiErrorSchema.safeParse(value).success;
}
