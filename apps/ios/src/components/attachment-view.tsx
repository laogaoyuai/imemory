import { Ionicons } from '@expo/vector-icons';
import type { Attachment } from '@atlas/core';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image, StyleSheet, Text, View } from 'react-native';

import { AudioAttachmentRow } from './audio-attachment-row';
import { colors, radius } from '../theme';

export function AttachmentView({ attachment }: { attachment: Attachment }) {
  if (attachment.kind === 'image') {
    return <Image resizeMode="cover" source={{ uri: attachment.uri }} style={styles.image} />;
  }
  if (attachment.kind === 'video') return <VideoAttachment attachment={attachment} />;
  if (attachment.kind === 'audio') return <AudioAttachmentRow attachment={attachment} />;
  return <FileAttachment attachment={attachment} />;
}

function VideoAttachment({ attachment }: { attachment: Attachment }) {
  const player = useVideoPlayer(attachment.uri);
  return <VideoView contentFit="contain" nativeControls player={player} style={styles.video} />;
}

function FileAttachment({ attachment }: { attachment: Attachment }) {
  return (
    <View style={styles.file}>
      <View style={styles.fileIcon}>
        <Ionicons color={colors.blue} name="document-text-outline" size={24} />
      </View>
      <View style={styles.fileText}>
        <Text numberOfLines={2} style={styles.fileName}>{attachment.name}</Text>
        <Text style={styles.fileMeta}>{fileType(attachment)} · {formatBytes(attachment.size)}</Text>
      </View>
    </View>
  );
}

function fileType(attachment: Attachment): string {
  const extension = attachment.name.split('.').pop()?.toLocaleUpperCase();
  return extension && extension !== attachment.name.toLocaleUpperCase() ? extension : '文件';
}

function formatBytes(value: number | null): string {
  if (value === null) return '大小未知';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  image: { width: '100%', height: 260, borderRadius: radius.large, backgroundColor: colors.line },
  video: { width: '100%', height: 230, borderRadius: radius.large, backgroundColor: colors.ink },
  file: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.blueSoft,
    borderRadius: radius.medium,
    padding: 14,
  },
  fileIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  fileText: { flex: 1, gap: 4 },
  fileName: { color: colors.ink, fontSize: 14, lineHeight: 19, fontWeight: '600' },
  fileMeta: { color: colors.secondary, fontSize: 12 },
});
