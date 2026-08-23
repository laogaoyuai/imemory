import {
  AtlasApiClient,
  type HttpRequest,
  type HttpResponse,
  type HttpTransport,
  type TokenStore,
} from '@atlas/api-client';
import type { Attachment } from '@atlas/core';
import {
  type AuthSession,
  type UploadPresignRequest,
} from '@atlas/contracts';
import Taro from '@tarojs/taro';

const SESSION_KEY = 'atlas:miniprogram:v1:remote-session';

class TaroTransport implements HttpTransport {
  async send(request: HttpRequest): Promise<HttpResponse> {
    const response = await nativeWechatRequest({
      url: request.url,
      method: request.method,
      header: request.headers,
      ...(request.body === undefined ? {} : { data: request.body }),
      timeout: 15_000,
    });
    return { status: response.statusCode, data: response.data };
  }
}

class TaroTokenStore implements TokenStore {
  async load(): Promise<AuthSession | null> {
    try {
      return readStoredAuthSession(Taro.getStorageSync(SESSION_KEY));
    } catch {
      return null;
    }
  }

  async save(session: AuthSession): Promise<void> {
    Taro.setStorageSync(SESSION_KEY, session);
  }

  async clear(): Promise<void> {
    Taro.removeStorageSync(SESSION_KEY);
  }
}

function readStoredAuthSession(value: unknown): AuthSession | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const session = value as Partial<AuthSession>;
  if (
    typeof session.accessToken !== 'string'
    || typeof session.refreshToken !== 'string'
    || typeof session.accessTokenExpiresAt !== 'string'
    || typeof session.refreshTokenExpiresAt !== 'string'
    || !session.user
    || typeof session.user.id !== 'string'
    || typeof session.user.displayName !== 'string'
  ) return null;
  return session as AuthSession;
}

const tokenStore = new TaroTokenStore();

export const remoteApi = new AtlasApiClient(
  process.env.TARO_APP_API_BASE_URL ?? 'http://127.0.0.1:4000/api/v1',
  new TaroTransport(),
  tokenStore,
);

export function loadRemoteSession(): Promise<AuthSession | null> {
  return tokenStore.load();
}

export function saveRemoteSession(session: AuthSession): Promise<void> {
  return tokenStore.save(session);
}

export async function loginWithCurrentWechatAccount(): Promise<AuthSession> {
  const result = await nativeWechatLogin();
  if (!result.code) throw new Error('微信未返回登录凭证');
  return remoteApi.loginWithWechat({ code: result.code });
}

export async function uploadLocalAttachment(attachment: Attachment): Promise<Attachment> {
  let uploaded = attachment;
  if (!attachment.assetId && !isRemoteUri(attachment.uri)) {
    uploaded = await uploadAttachmentFile(attachment);
  }

  if (uploaded.coverUri && !isRemoteUri(uploaded.coverUri)) {
    const cover = await uploadAttachmentFile({
      id: `${uploaded.id}-cover`,
      assetId: null,
      kind: 'image',
      name: `${uploaded.name.replace(/\.[^.]+$/, '')}-封面.jpg`,
      uri: uploaded.coverUri,
      mimeType: 'image/jpeg',
      size: null,
      width: null,
      height: null,
      durationMs: null,
      coverUri: null,
    });
    uploaded = { ...uploaded, coverUri: cover.uri };
  }
  return uploaded;
}

async function uploadAttachmentFile(attachment: Attachment): Promise<Attachment> {
  const size = attachment.size && attachment.size > 0 ? attachment.size : await readFileSize(attachment.uri);
  if (size > 20 * 1024 * 1024) {
    throw new Error(`附件超过小程序当前 20 MB 上传限制：${attachment.name}`);
  }
  const mimeType = inferMimeType(attachment);
  const presigned = await remoteApi.createUpload({
    fileName: attachment.name,
    mimeType,
    size,
    kind: attachment.kind,
  });
  if (!presigned.publicUrl) {
    throw new Error('对象存储缺少公开读取地址，暂时无法同步附件');
  }

  const data = await readFile(attachment.uri);
  const response = await nativeWechatRequest({
    url: presigned.uploadUrl,
    method: 'PUT',
    header: presigned.headers,
    data,
    timeout: 120_000,
  });
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`附件上传失败（${response.statusCode}）`);
  }
  return {
    ...attachment,
    assetId: presigned.uploadId,
    uri: presigned.publicUrl,
    mimeType,
    size,
  };
}

interface NativeLoginResult {
  code: string;
}

interface NativeRequestOptions {
  url: string;
  method: string;
  header: Record<string, string>;
  data?: unknown;
  timeout: number;
}

interface NativeRequestResult {
  statusCode: number;
  data: unknown;
}

interface NativeWechatNetworkApi {
  login(option: {
    success: (result: NativeLoginResult) => void;
    fail: (error: unknown) => void;
  }): void;
  request(option: NativeRequestOptions & {
    success: (result: NativeRequestResult) => void;
    fail: (error: unknown) => void;
  }): unknown;
}

function getNativeWechatNetworkApi(): NativeWechatNetworkApi {
  const candidate = (globalThis as typeof globalThis & { wx?: Partial<NativeWechatNetworkApi> }).wx;
  if (!candidate || typeof candidate.login !== 'function' || typeof candidate.request !== 'function') {
    throw new Error('当前环境不支持微信登录');
  }
  return candidate as NativeWechatNetworkApi;
}

function nativeWechatLogin(): Promise<NativeLoginResult> {
  const wechat = getNativeWechatNetworkApi();
  return new Promise((resolve, reject) => {
    wechat.login({ success: resolve, fail: reject });
  });
}

function nativeWechatRequest(options: NativeRequestOptions): Promise<NativeRequestResult> {
  const wechat = getNativeWechatNetworkApi();
  return new Promise((resolve, reject) => {
    wechat.request({ ...options, success: resolve, fail: reject });
  });
}

export async function uploadCollectionCover(input: {
  uri: string;
  size: number;
  width: number | null;
  height: number | null;
}): Promise<string> {
  const uploaded = await uploadLocalAttachment({
    id: `collection-cover-${Date.now().toString(36)}`,
    assetId: null,
    kind: 'image',
    name: input.uri.split('/').pop() || 'collection-cover.jpg',
    uri: input.uri,
    mimeType: null,
    size: input.size,
    width: input.width,
    height: input.height,
    durationMs: null,
    coverUri: null,
  });
  return uploaded.uri;
}

function isRemoteUri(uri: string): boolean {
  return /^https?:\/\//i.test(uri);
}

function inferMimeType(attachment: Attachment): UploadPresignRequest['mimeType'] {
  const normalized = attachment.mimeType?.toLowerCase();
  if (normalized && supportedMimeTypes.has(normalized)) {
    return normalized as UploadPresignRequest['mimeType'];
  }
  const extension = attachment.name.split('.').pop()?.toLowerCase() ?? attachment.uri.split('.').pop()?.toLowerCase();
  const fromExtension = extension ? mimeByExtension[extension] : undefined;
  if (fromExtension) return fromExtension;
  if (attachment.kind === 'image') return 'image/jpeg';
  if (attachment.kind === 'video') return 'video/mp4';
  if (attachment.kind === 'audio') return 'audio/mpeg';
  throw new Error(`无法识别文件格式：${attachment.name}`);
}

function readFile(path: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    Taro.getFileSystemManager().readFile({
      filePath: path,
      success: (result) => {
        if (typeof result.data === 'string') reject(new Error('读取附件失败'));
        else resolve(result.data);
      },
      fail: () => reject(new Error('无法读取本地附件，请重新选择文件')),
    });
  });
}

function readFileSize(path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    Taro.getFileSystemManager().stat({
      path,
      success: (result) => {
        const size = Array.isArray(result.stats) ? result.stats[0]?.stats.size : result.stats.size;
        if (!size || size <= 0) reject(new Error('附件大小无效'));
        else resolve(size);
      },
      fail: () => reject(new Error('无法读取附件大小')),
    });
  });
}

const mimeByExtension: Record<string, UploadPresignRequest['mimeType']> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

const supportedMimeTypes = new Set<string>(Object.values(mimeByExtension));
