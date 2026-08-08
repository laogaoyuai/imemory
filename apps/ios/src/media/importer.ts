import type { Attachment } from '@atlas/core';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

const LIBRARY_DIRECTORY = `${FileSystem.documentDirectory ?? ''}library/`;

export async function pickImagesOrVideo(): Promise<Attachment[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('需要相册权限才能添加图片或视频');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: true,
    selectionLimit: 12,
    quality: 0.9,
  });
  if (result.canceled) return [];
  if (result.assets.filter((asset) => asset.type === 'video').length > 1) {
    throw new Error('一次只能选择一个视频');
  }

  return Promise.all(
    result.assets.map(async (asset, index) => ({
      id: createId(),
      assetId: asset.assetId ?? null,
      kind: asset.type === 'video' ? 'video' : 'image',
      name: asset.fileName ?? `媒体-${index + 1}`,
      uri: await persistFile(asset.uri, asset.fileName),
      mimeType: asset.mimeType ?? null,
      size: asset.fileSize ?? null,
      width: asset.width || null,
      height: asset.height || null,
      durationMs: asset.duration ?? null,
    })),
  );
}

export async function pickDocuments(): Promise<Attachment[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/*',
      'application/zip',
    ],
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return [];

  return Promise.all(
    result.assets.map(async (asset) => ({
      id: createId(),
      kind: asset.mimeType?.startsWith('audio/') ? 'audio' : 'document',
      name: asset.name,
      uri: await persistFile(asset.uri, asset.name),
      mimeType: asset.mimeType ?? null,
      size: asset.size ?? null,
      width: null,
      height: null,
      durationMs: null,
    })),
  );
}

export async function deleteImportedFiles(attachments: readonly Attachment[]): Promise<void> {
  await Promise.all(
    attachments
      .filter((attachment) => attachment.uri.startsWith(LIBRARY_DIRECTORY))
      .map((attachment) => FileSystem.deleteAsync(attachment.uri, { idempotent: true })),
  );
}

export async function persistFile(sourceUri: string, originalName?: string | null): Promise<string> {
  await FileSystem.makeDirectoryAsync(LIBRARY_DIRECTORY, { intermediates: true });
  const extension = originalName?.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? '';
  const destination = `${LIBRARY_DIRECTORY}${createId()}${extension}`;
  await FileSystem.copyAsync({ from: sourceUri, to: destination });
  return destination;
}

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
