import {
  compareVersions,
  createContentItem,
  incrementPatchVersion,
  type Attachment,
  type AttachmentKind,
  type ContentItem,
} from '@atlas/core';
import { Button, Image, Input, Switch, Text, Textarea, View } from '@tarojs/components';
import Taro, { getCurrentInstance } from '@tarojs/taro';
import { useEffect, useRef, useState } from 'react';

import { useContentStore } from '../../state/content-store';
import { ensureWechatPrivacyAuthorization } from '../../privacy/privacy-consent';
import { ContentAudioPlayer } from '../../components/content-audio-player';
import { ContentImageViewer } from '../../components/content-image-viewer';
import { ContentVideoPlayer } from '../../components/content-video-player';
import { useProjectStore } from '../../state/project-store';
import { useSessionStore } from '../../state/session-store';
import './index.css';

export default function ComposePage() {
  const editId = getCurrentInstance().router?.params.editId ?? '';
  const sourceVersionId = getCurrentInstance().router?.params.sourceVersionId ?? '';
  const editing = Boolean(editId);
  const publish = useContentStore((state) => state.publish);
  const update = useContentStore((state) => state.update);
  const submitVersion = useContentStore((state) => state.submitVersion);
  const listVersions = useContentStore((state) => state.listVersions);
  const hydrateContent = useContentStore((state) => state.hydrate);
  const hydrated = useContentStore((state) => state.hydrated);
  const currentItem = useContentStore((state) => state.items.find((item) => item.id === editId));
  const projects = useProjectStore((state) => state.mine);
  const hydrateProjects = useProjectStore((state) => state.hydrate);
  const session = useSessionStore((state) => state.session);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [location, setLocation] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [version, setVersion] = useState('0.0.2');
  const [baseSnapshot, setBaseSnapshot] = useState<ContentItem | null>(null);
  const [loadingBase, setLoadingBase] = useState(editing);
  const [submitting, setSubmitting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const [imageViewerIndex, setImageViewerIndex] = useState<number | null>(null);
  const initializedSource = useRef('');
  const recorderRef = useRef<ReturnType<typeof Taro.getRecorderManager> | null>(null);
  const recordingRef = useRef(false);
  const recordingStartedAt = useRef(0);
  const recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopRecordingTimer = () => {
    if (recordingTimer.current) clearInterval(recordingTimer.current);
    recordingTimer.current = null;
  };

  const startRecordingTimer = () => {
    stopRecordingTimer();
    recordingTimer.current = setInterval(() => setRecordingMs(Date.now() - recordingStartedAt.current), 250);
  };

  useEffect(() => {
    if (session) void hydrateProjects();
  }, [session?.user.id]);

  useEffect(() => {
    let recorder: ReturnType<typeof Taro.getRecorderManager>;
    try {
      recorder = Taro.getRecorderManager();
    } catch {
      return;
    }
    recorderRef.current = recorder;
    recorder.onStop((result) => {
      recordingRef.current = false;
      setRecording(false);
      stopRecordingTimer();
      setRecordingMs(result.duration || Math.max(0, Date.now() - recordingStartedAt.current));
      if (!result.tempFilePath) return;
      void makeAttachment('audio', result.tempFilePath, result.fileSize, null, null, result.duration, `录音-${formatRecordingTime(result.duration)}.aac`)
        .then((attachment) => setAttachments((current) => [...current.filter((item) => item.kind !== 'audio'), attachment].slice(0, 20)))
        .catch((error) => void Taro.showToast({ title: error instanceof Error ? error.message : '录音保存失败', icon: 'none' }));
    });
    recorder.onError((error) => {
      recordingRef.current = false;
      setRecording(false);
      stopRecordingTimer();
      void Taro.showToast({ title: error.errMsg || '录音失败，请检查麦克风权限', icon: 'none' });
    });
    recorder.onInterruptionBegin(() => {
      if (!recordingRef.current) return;
      recordingRef.current = false;
      setRecording(false);
      stopRecordingTimer();
      void Taro.showToast({ title: '录音被系统中断', icon: 'none' });
    });
    return () => stopRecordingTimer();
  }, []);

  useEffect(() => {
    if (editing && !hydrated) void hydrateContent();
    if (editing) void Taro.setNavigationBarTitle({ title: '编辑内容' });
  }, [editing, hydrated]);

  useEffect(() => {
    if (!editing || !hydrated || initializedSource.current) return;
    void (async () => {
      let source = currentItem ?? null;
      let nextVersion = source ? incrementPatchVersion(source.version) : '0.0.2';
      if (session) {
        try {
          const response = await listVersions(editId);
          const latest = response.versions.reduce(
            (highest, item) => compareVersions(item.version, highest) > 0 ? item.version : highest,
            '0.0.0',
          );
          const selected = sourceVersionId
            ? response.versions.find((item) => item.id === sourceVersionId)?.snapshot
            : response.versions.find((item) => item.version === response.currentVersion)?.snapshot;
          source = selected ?? source;
          nextVersion = incrementPatchVersion(latest);
        } catch (error) {
          if (!source) {
            await Taro.showToast({ title: error instanceof Error ? error.message : '版本加载失败', icon: 'none' });
          }
        }
      }
      if (!source) {
        setLoadingBase(false);
        return;
      }
      initializedSource.current = sourceVersionId || source.version;
      setBaseSnapshot(source);
      setTitle(source.title);
      setBody(source.body);
      setTags(source.tags.join(' '));
      setLocation(source.location);
      setIsPublic(source.isPublic);
      setAttachments(source.attachments);
      setProjectIds(source.projectIds);
      setVersion(nextVersion);
      setLoadingBase(false);
    })();
  }, [editing, hydrated, currentItem?.id, session?.user.id, sourceVersionId]);

  const imageCount = attachments.filter((item) => item.kind === 'image').length;
  const hasImages = imageCount > 0;
  const hasVideo = attachments.some((item) => item.kind === 'video');
  const hasAudio = attachments.some((item) => item.kind === 'audio');

  const chooseImages = async () => {
    try {
      if (hasVideo || hasAudio) {
        await Taro.showToast({ title: '图片不能与视频或音频同时添加', icon: 'none' });
        return;
      }
      const remaining = 9 - imageCount;
      if (remaining <= 0) {
        await Taro.showToast({ title: '最多添加 9 张图片', icon: 'none' });
        return;
      }
      if (!await ensureWechatPrivacyAuthorization()) return;
      const result = await nativeChooseMedia({ count: remaining, mediaType: ['image'] });
      const selected = await Promise.all(result.tempFiles.slice(0, remaining).map(async (file) => makeAttachment('image', nativeFilePath(file), file.size, file.width, file.height)));
      setAttachments((current) => [...current, ...selected]);
    } catch (error) {
      await showMediaError(error, '图片选择失败');
    }
  };

  const chooseVideo = async () => {
    try {
      if (hasImages || hasAudio) {
        await Taro.showToast({ title: '视频不能与图片或音频同时添加', icon: 'none' });
        return;
      }
      if (!await ensureWechatPrivacyAuthorization()) return;
      const result = await nativeChooseMedia({ count: 1, mediaType: ['video'] });
      const file = result.tempFiles[0];
      if (!file) return;
      const selected = await makeAttachment(
        'video',
        nativeFilePath(file),
        file.size,
        file.width,
        file.height,
        file.duration ? file.duration * 1000 : null,
        file.name,
        file.thumbTempFilePath,
      );
      setAttachments((current) => [...current.filter((attachment) => attachment.kind !== 'video'), selected].slice(0, 20));
    } catch (error) {
      await showMediaError(error, '视频选择失败');
    }
  };

  const chooseAudio = async () => {
    try {
      if (hasImages || hasVideo) {
        await Taro.showToast({ title: '音频不能与图片或视频同时添加', icon: 'none' });
        return;
      }
      if (recordingRef.current) {
        recorderRef.current?.stop();
        return;
      }
      if (!await ensureWechatPrivacyAuthorization()) return;
      const recorder = recorderRef.current ?? Taro.getRecorderManager();
      recorderRef.current = recorder;
      recordingRef.current = true;
      recordingStartedAt.current = Date.now();
      setRecordingMs(0);
      setRecording(true);
      startRecordingTimer();
      recorder.start({ duration: 600_000, sampleRate: 44_100, numberOfChannels: 1, encodeBitRate: 192_000, format: 'aac' });
    } catch (error) {
      recordingRef.current = false;
      setRecording(false);
      stopRecordingTimer();
      await showMediaError(error, '录音启动失败');
    }
  };

  const chooseFile = async () => {
    try {
      if (!await ensureWechatPrivacyAuthorization()) return;
      const result = await nativeChooseMessageFile({ count: Math.max(1, 20 - attachments.length) });
      const selected = await Promise.all(result.tempFiles.map((file) => makeAttachment('document', nativeFilePath(file), file.size, null, null, null, file.name)));
      setAttachments((current) => [...current, ...selected].slice(0, 20));
    } catch (error) {
      await showMediaError(error, '文件选择失败');
    }
  };

  const chooseAudioCover = async (attachmentId: string) => {
    try {
      if (!await ensureWechatPrivacyAuthorization()) return;
      const result = await nativeChooseMedia({ count: 1, mediaType: ['image'] });
      const file = result.tempFiles[0];
      if (!file) return;
      let coverUri = nativeFilePath(file);
      try {
        const saved = await nativeSaveFile(coverUri);
        if (typeof saved.savedFilePath === 'string') coverUri = saved.savedFilePath;
      } catch {
        // Keep the temporary path when the development tool cannot persist it.
      }
      setAttachments((current) => current.map((attachment) => attachment.id === attachmentId ? { ...attachment, coverUri } : attachment));
    } catch (error) {
      await showMediaError(error, '封面选择失败');
    }
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const draft = {
        title,
        body,
        attachments,
        tags: tags.split(/[,，\s]+/).map((tag) => tag.trim()).filter(Boolean).slice(0, 5),
        location,
        authorName: session?.user.displayName ?? '我',
        teamNames: projectIds.length > 0 ? projects.filter((project) => projectIds.includes(project.id)).map((project) => project.name) : ['无'],
        projectIds,
        isPublic,
      };
      if (!editing) {
        await publish(draft);
      } else if (currentItem) {
        await update(editId, draft, version);
      } else if (baseSnapshot) {
        const generated = createContentItem(draft, { id: () => editId, now: () => new Date() });
        await submitVersion(editId, {
          ...baseSnapshot,
          kind: generated.kind,
          title: generated.title,
          body: generated.body,
          excerpt: generated.excerpt,
          location: generated.location,
          attachments: generated.attachments,
          tags: generated.tags,
          isPublic: generated.isPublic,
          updatedAt: generated.updatedAt,
          version,
        }, version);
      } else {
        throw new Error('没有可编辑的内容快照');
      }
      await Taro.showToast({ title: editing ? '新版本已提交' : '已收录', icon: 'success' });
      if (!editing && session && attachments.length > 0 && process.env.TARO_APP_ENV === 'development') {
        await Taro.showModal({
          title: '已保存到本机',
          content: '当前开发环境尚未配置对象存储，附件已本地保留，配置后可上传云端。',
          showCancel: false,
          confirmText: '知道了',
        });
      }
      await Taro.navigateBack();
    } catch (error) {
      await Taro.showToast({ title: error instanceof Error ? error.message : '发布失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="atlas-page atlas-safe-bottom compose">
      <View className="compose__intro">
        <Text className="compose__intro-label">{editing ? `编辑内容 · 新版本 ${version}` : '新内容 · 初始版本 0.0.1'}</Text>
        <Text className="compose__intro-copy">{editing ? '保留每一次修改，也保留回到过去的选择。' : '写下一点此刻值得留下的内容。'}</Text>
      </View>
      {loadingBase ? <View className="compose__card"><Text className="compose__hint">正在加载版本快照…</Text></View> : null}
      <View className="compose__card">
        <Input className="compose__title" maxlength={120} onInput={(event) => setTitle(event.detail.value)} placeholder="标题（长文章必填）" value={title} />
        <Textarea className="compose__body" maxlength={100000} onInput={(event) => setBody(event.detail.value)} placeholder="正文" value={body} />
      </View>
      <View className="compose__card">
        <Text className="compose__section-title">附件</Text>
        <View className="compose__media-actions">
          <Button disabled={hasVideo || hasAudio || imageCount >= 9} onClick={() => void chooseImages()}>图片</Button>
          <Button disabled={hasImages || hasAudio} onClick={() => void chooseVideo()}>视频</Button>
          <Button className={recording ? 'compose__recording-button' : ''} disabled={hasImages || hasVideo} onClick={() => void chooseAudio()}>{recording ? '停止录音' : hasAudio ? '重新录音' : '录音'}</Button>
          <Button onClick={() => void chooseFile()}>文件</Button>
        </View>
        {attachments.length > 0 ? <ComposeAttachments
          attachments={attachments}
          onAddImages={() => void chooseImages()}
          imageViewerIndex={imageViewerIndex}
          onAudioCover={(attachmentId) => void chooseAudioCover(attachmentId)}
          onCloseImageViewer={() => setImageViewerIndex(null)}
          onOpenImageViewer={setImageViewerIndex}
          onRemove={(attachmentId) => {
            setAttachments((current) => current.filter((item) => item.id !== attachmentId));
            setImageViewerIndex((current) => {
              if (current === null) return current;
              const imageCountBeforeRemove = attachments.filter((item) => item.kind === 'image').length;
              if (imageCountBeforeRemove <= 1) return null;
              return Math.min(current, imageCountBeforeRemove - 2);
            });
          }}
        /> : null}
        {recording ? <Text className="compose__recording-hint">正在录音 {formatRecordingTime(recordingMs)}，再次点击“停止录音”</Text> : null}
        <Text className="compose__hint">内容类型将自动识别；图片最多 9 张，图片、视频和音频不可混合添加。</Text>
      </View>
      <View className="compose__card compose__fields">
        {editing ? <View><Text className="compose__field-label">新版本号</Text><Input maxlength={24} onInput={(event) => setVersion(event.detail.value)} placeholder="例如 0.0.2" value={version} /></View> : null}
        <View><Text className="compose__field-label">标签</Text><Input onInput={(event) => setTags(event.detail.value)} placeholder="最多 5 个，用空格分隔" value={tags} /></View>
        <View><Text className="compose__field-label">位置</Text><Input maxlength={80} onInput={(event) => setLocation(event.detail.value)} placeholder="可选" value={location} /></View>
        <View className="compose__switch-row"><View><Text className="compose__field-label">公开内容</Text><Text className="compose__hint">后续接入服务端后会向其他用户展示</Text></View><Switch checked={isPublic} color="#E7603C" onChange={(event) => setIsPublic(event.detail.value)} /></View>
      </View>
      {session ? (
        <View className="compose__card">
          <Text className="compose__section-title">关联团队项目</Text>
          {projects.length === 0 ? <Text className="compose__hint">尚未加入项目，可从首页进入团队项目创建或关注。</Text> : (
            <View className="compose__projects">
              {projects.map((project) => {
                const selected = projectIds.includes(project.id);
                return <View className={`compose__project ${selected ? 'compose__project--selected' : ''}`} key={project.id} onClick={() => {
                  if (editing && !currentItem) return;
                  const next = selected ? projectIds.filter((id) => id !== project.id) : [...projectIds, project.id];
                  setProjectIds(next);
                  if (next.length > 0) setIsPublic(next.every((id) => projects.find((candidate) => candidate.id === id)?.isPublic));
                }}><Text>{project.name}</Text><Text>{selected ? '已关联' : project.currentRole === 'follower' ? '粉丝讨论' : '协作发布'}</Text></View>;
              })}
            </View>
          )}
        </View>
      ) : null}
      <Button className="compose__submit" disabled={submitting || loadingBase} loading={submitting} onClick={() => void submit()}>{submitting ? '正在提交' : editing ? '提交新版本' : '发布内容'}</Button>
    </View>
  );
}

function ComposeAttachments({
  attachments,
  onAddImages,
  imageViewerIndex,
  onAudioCover,
  onCloseImageViewer,
  onOpenImageViewer,
  onRemove,
}: {
  attachments: readonly Attachment[];
  onAddImages: () => void;
  imageViewerIndex: number | null;
  onAudioCover: (attachmentId: string) => void;
  onCloseImageViewer: () => void;
  onOpenImageViewer: (index: number) => void;
  onRemove: (attachmentId: string) => void;
}) {
  const images = attachments.filter((attachment) => attachment.kind === 'image').slice(0, 9);
  const otherAttachments = attachments.filter((attachment) => attachment.kind !== 'image');
  const hasAddCell = images.length < 9;
  const imageCellCount = images.length > 0 ? Math.ceil((images.length + (hasAddCell ? 1 : 0)) / 3) * 3 : 0;

  return (
    <View className="compose__attachments">
      {images.length > 0 ? (
        <View className="compose__image-grid">
          {Array.from({ length: imageCellCount }, (_, index) => {
            const image = images[index];
            const isAddCell = !image && hasAddCell && index === images.length;
            return (
              <View className="compose__image-grid-cell" key={image?.id ?? (isAddCell ? 'add-image' : `empty-image-${index}`)}>
                {image ? (
                  <View className="compose__image-grid-item">
                    <Image
                      className="compose__image-grid-image"
                      mode="aspectFill"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenImageViewer(index);
                      }}
                      src={image.uri}
                    />
                    <Text className="compose__image-remove" onClick={(event) => { event.stopPropagation(); onRemove(image.id); }}>×</Text>
                  </View>
                ) : isAddCell ? (
                  <View className="compose__image-add" onClick={onAddImages}>
                    <Text>＋</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
      {otherAttachments.map((attachment) => (
        attachment.kind === 'audio' ? (
          <View className="compose__audio-attachment" key={attachment.id}>
            <ContentAudioPlayer attachment={attachment} className="compose__audio-player" onCoverPress={() => onAudioCover(attachment.id)} />
            <Text className="compose__media-remove compose__media-remove--audio" onClick={() => onRemove(attachment.id)}>×</Text>
          </View>
        ) : attachment.kind === 'video' ? (
          <View className="compose__video-attachment" key={attachment.id}>
            <ContentVideoPlayer attachment={attachment} className="compose__video-player" />
            <View className="compose__video-caption"><Text>{attachment.name || '视频'}</Text><Text className="compose__media-remove" onClick={() => onRemove(attachment.id)}>移除</Text></View>
          </View>
        ) : (
          <View className="compose__document-attachment" key={attachment.id}>
            <View className="compose__file-symbol">文</View>
            <Text className="compose__document-name">{attachment.name}</Text>
            <Text className="compose__media-remove" onClick={() => onRemove(attachment.id)}>移除</Text>
          </View>
        )
      ))}
      {imageViewerIndex !== null && imageViewerIndex >= 0 ? <ContentImageViewer images={images} initialIndex={imageViewerIndex} onClose={onCloseImageViewer} /> : null}
    </View>
  );
}

async function makeAttachment(
  kind: AttachmentKind,
  path: string,
  size: number | null | undefined,
  width: number | null | undefined,
  height: number | null | undefined,
  durationMs: number | null | undefined = null,
  originalName?: string,
  coverPath?: string,
): Promise<Attachment> {
  let uri = path;
  try {
    const saved = await nativeSaveFile(path);
    if (typeof saved.savedFilePath === 'string') uri = saved.savedFilePath;
  } catch {
    // Development tools can reject saving some virtual files. Keeping the
    // temporary path still lets the current session preview the attachment.
  }
  const fallbackName = path.split('/').pop() || `${kind}-${Date.now()}`;
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
    assetId: null,
    kind,
    name: originalName || fallbackName,
    uri,
    mimeType: null,
    size: finiteNumberOrNull(size),
    width: positiveNumberOrNull(width),
    height: positiveNumberOrNull(height),
    durationMs: finiteNumberOrNull(durationMs),
    coverUri: coverPath ? await persistNativeFile(coverPath) : null,
  };
}

async function persistNativeFile(path: string): Promise<string> {
  try {
    const saved = await nativeSaveFile(path);
    if (typeof saved.savedFilePath === 'string') return saved.savedFilePath;
  } catch {
    // Keep the temporary path when the development tool cannot persist it.
  }
  return path;
}

function finiteNumberOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function positiveNumberOrNull(value: number | null | undefined): number | null {
  const normalized = finiteNumberOrNull(value);
  return normalized !== null && normalized > 0 ? normalized : null;
}

function nativeFilePath(file: NativeMediaFile): string {
  const path = file.tempFilePath || file.path;
  if (!path) throw new Error('微信未返回有效的附件路径，请重新选择');
  return path;
}

function formatRecordingTime(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

async function showMediaError(error: unknown, fallback: string): Promise<void> {
  const message = error && typeof error === 'object' && 'errMsg' in error && typeof error.errMsg === 'string'
    ? error.errMsg
    : error instanceof Error ? error.message : fallback;
  if (/cancel/i.test(message)) return;
  await Taro.showToast({ title: message || fallback, icon: 'none' });
}

interface NativeMediaFile {
  tempFilePath?: string;
  path?: string;
  name?: string;
  size?: number;
  width?: number | null;
  height?: number | null;
  duration?: number;
  thumbTempFilePath?: string;
}

interface NativeWechatMediaApi {
  chooseMedia(option: {
    count: number;
    mediaType: Array<'image' | 'video'>;
    sourceType: Array<'album' | 'camera'>;
    success: (result: { tempFiles: NativeMediaFile[] }) => void;
    fail: (error: unknown) => void;
  }): void;
  chooseMessageFile(option: {
    count: number;
    type: 'file';
    extension?: string[];
    success: (result: { tempFiles: NativeMediaFile[] }) => void;
    fail: (error: unknown) => void;
  }): void;
  saveFile(option: {
    tempFilePath: string;
    success: (result: { savedFilePath: string }) => void;
    fail: (error: unknown) => void;
  }): void;
}

function nativeMediaApi(): NativeWechatMediaApi {
  const candidate = (globalThis as typeof globalThis & { wx?: Partial<NativeWechatMediaApi> }).wx;
  if (
    !candidate
    || typeof candidate.chooseMedia !== 'function'
    || typeof candidate.chooseMessageFile !== 'function'
    || typeof candidate.saveFile !== 'function'
  ) throw new Error('当前微信版本不支持媒体选择');
  return candidate as NativeWechatMediaApi;
}

function nativeChooseMedia(input: { count: number; mediaType: Array<'image' | 'video'> }): Promise<{ tempFiles: NativeMediaFile[] }> {
  const api = nativeMediaApi();
  return new Promise((resolve, reject) => api.chooseMedia({ ...input, sourceType: ['album', 'camera'], success: resolve, fail: reject }));
}

function nativeChooseMessageFile(input: { count: number; extensions?: string[] }): Promise<{ tempFiles: NativeMediaFile[] }> {
  const api = nativeMediaApi();
  return new Promise((resolve, reject) => api.chooseMessageFile({ count: input.count, type: 'file', ...(input.extensions ? { extension: input.extensions } : {}), success: resolve, fail: reject }));
}

function nativeSaveFile(tempFilePath: string): Promise<{ savedFilePath: string }> {
  const api = nativeMediaApi();
  return new Promise((resolve, reject) => api.saveFile({ tempFilePath, success: resolve, fail: reject }));
}
