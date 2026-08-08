import { Ionicons } from '@expo/vector-icons';
import type { Attachment, ContentItem } from '@atlas/core';
import * as Haptics from 'expo-haptics';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { Screen } from '../src/components/screen';
import { AudioAttachmentRow } from '../src/components/audio-attachment-row';
import { ImageViewerModal } from '../src/components/image-viewer-modal';
import { VideoCover, VideoViewerModal } from '../src/components/video-preview';
import { deleteImportedFiles, persistFile, pickDocuments, pickImagesOrVideo } from '../src/media/importer';
import { useContentStore } from '../src/state/content-store';
import { useAuthStore } from '../src/state/auth-store';
import { useTeamStore } from '../src/state/team-store';
import { colors, radius } from '../src/theme';

export default function ComposeScreen() {
  const publish = useContentStore((state) => state.publish);
  const update = useContentStore((state) => state.update);
  const items = useContentStore((state) => state.items);
  const getVersion = useContentStore((state) => state.getVersion);
  const user = useAuthStore((state) => state.user);
  const teams = useTeamStore((state) => state.teams);
  const followedTeamNames = useTeamStore((state) => state.followedTeamNames);
  const hydrateTeams = useTeamStore((state) => state.hydrate);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [location, setLocation] = useState('');
  const [teamNames, setTeamNames] = useState<string[]>(['无']);
  const [isPublic, setIsPublic] = useState(true);
  const [versionInput, setVersionInput] = useState('0.0.1');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [previewVideo, setPreviewVideo] = useState<Attachment | null>(null);
  const [imageViewerIndex, setImageViewerIndex] = useState<number | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const { width: screenWidth } = useWindowDimensions();
  const { editId, version: requestedVersion, sourceVersionId } = useLocalSearchParams<{ editId?: string; version?: string; sourceVersionId?: string }>();
  const currentItem = editId ? items.find((item) => item.id === editId) : undefined;
  const [sourceItem, setSourceItem] = useState<ContentItem | null>(null);
  const editingItem = sourceItem ?? currentItem;
  const initialized = useRef(false);
  const selectedProjectName = teamNames.find((team) => team !== '无');
  const previewWidth = Math.max(1, screenWidth - 44);
  const selectedProject = selectedProjectName ? teams.find((team) => team.name === selectedProjectName) : undefined;
  const canEditVersion = Boolean(
    editingItem && user && (
      user.name === editingItem.authorName ||
      selectedProject?.ownerName === user.name ||
      selectedProject?.adminNames.includes(user.name)
    ),
  );
  const versionBase = currentItem?.version ?? editingItem?.version ?? '0.0.1';
  const nextVersion = editingItem ? incrementPatch(versionBase) : '0.0.1';
  const editingHistoricalVersion = sourceVersionId && sourceItem && sourceItem.version !== currentItem?.version;
  const versionHint = editingHistoricalVersion
    ? `基于历史版本 ${sourceItem.version}`
    : `基于最新版本 ${versionBase}`;
  const tags = useMemo(
    () => tagInput.split(/[,，#\s]+/).map((tag) => tag.trim()).filter(Boolean).slice(0, 5),
    [tagInput],
  );
  const hasRequiredTextForMedia = !attachments.some((attachment) => attachment.kind === 'audio' || attachment.kind === 'video') || Boolean(title.trim() || body.trim());
  const canPublish = editingItem
    ? hasContentChanges(editingItem, { title, body, tags, location, teamNames, isPublic, attachments }) && hasRequiredTextForMedia
    : Boolean(title.trim() || body.trim() || attachments.length) && hasRequiredTextForMedia;
  const teamOptions = useMemo(() => {
    const available = new Set([...teams.map((team) => team.name), ...items.flatMap((item) => item.teamNames)]);
    const currentName = user?.name ?? '我';
    return Array.from(available).filter((team) => {
      const record = teams.find((item) => item.name === team);
      return followedTeamNames.includes(team) || record?.ownerName === currentName || record?.adminNames.includes(currentName) || record?.memberNames.includes(currentName);
    }).slice(0, 20);
  }, [followedTeamNames, items, teams, user?.name]);

  useEffect(() => { void hydrateTeams(); }, [hydrateTeams]);
  useEffect(() => {
    if (!recording) { setRecordingSeconds(0); return; }
    const timer = setInterval(() => setRecordingSeconds(recorder.currentTime), 250);
    return () => clearInterval(timer);
  }, [recorder, recording]);
  useEffect(() => {
    if (!sourceVersionId) { setSourceItem(null); return; }
    void getVersion(sourceVersionId).then((version) => setSourceItem(version?.snapshot ?? null));
  }, [getVersion, sourceVersionId]);
  useEffect(() => {
    if (!editingItem || initialized.current || (sourceVersionId && (!sourceItem || !currentItem))) return;
    initialized.current = true;
    setTitle(editingItem.title);
    setBody(editingItem.body);
    setAttachments(editingItem.attachments);
    setLocation(editingItem.location);
    setTeamNames(editingItem.teamNames);
    setIsPublic(editingItem.isPublic);
    setVersionInput(requestedVersion ?? incrementPatch(currentItem?.version ?? editingItem.version));
    setTagInput(editingItem.tags.map((tag) => `#${tag}`).join(' '));
  }, [currentItem, editingItem, requestedVersion, sourceItem, sourceVersionId]);
  useEffect(() => {
    const selectedProjects = teamNames.filter((team) => team !== '无');
    if (!selectedProjects.length) {
      setIsPublic(true);
      return;
    }
    setIsPublic(selectedProjects.every((name) => teams.find((team) => team.name === name)?.isPublic === true));
  }, [teamNames, teams]);

  const addMedia = async () => {
    try {
      const selected = await pickImagesOrVideo();
      const hasVideo = attachments.some((attachment) => attachment.kind === 'video');
      if (hasVideo && selected.some((attachment) => attachment.kind === 'video')) {
        await deleteImportedFiles(selected);
        throw new Error('一次只能添加一个视频');
      }
      const imageCount = attachments.filter(isImageAttachment).length;
      const imageCapacity = Math.max(0, 9 - imageCount);
      const selectedImages = selected.filter(isImageAttachment);
      const existingImageKeys = new Set(attachments.filter(isImageAttachment).map(attachmentKey));
      const selectedImageKeys = new Set<string>();
      const duplicateImages: Attachment[] = [];
      const uniqueImages: Attachment[] = [];
      selectedImages.forEach((attachment) => {
        const key = attachmentKey(attachment);
        if (existingImageKeys.has(key) || selectedImageKeys.has(key)) duplicateImages.push(attachment);
        else {
          selectedImageKeys.add(key);
          uniqueImages.push(attachment);
        }
      });
      const acceptedImages = uniqueImages.slice(0, imageCapacity);
      const overflowImages = uniqueImages.slice(imageCapacity);
      const discardedImages = [...duplicateImages, ...overflowImages];
      if (discardedImages.length) await deleteImportedFiles(discardedImages);
      const notices: string[] = [];
      if (duplicateImages.length) notices.push('已选中的图片不会重复添加。');
      if (overflowImages.length) notices.push('最多添加9张图片，超出部分未添加。');
      if (notices.length) {
        Alert.alert('图片未全部添加', notices.join('\n'));
      }
      const accepted = [...acceptedImages, ...selected.filter((attachment) => !isImageAttachment(attachment))];
      setAttachments((current) => [...current, ...accepted].slice(0, 20));
    } catch (error) {
      Alert.alert('无法添加媒体', error instanceof Error ? error.message : '请稍后重试');
    }
  };

  const addDocuments = async () => {
    try {
      const selected = await pickDocuments();
      setAttachments((current) => [...current, ...selected].slice(0, 20));
    } catch (error) {
      Alert.alert('无法添加文件', error instanceof Error ? error.message : '请稍后重试');
    }
  };

  const recordAudio = async () => {
    try {
      if (recording) {
        await recorder.stop();
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        setRecording(false);
        if (!recorder.uri) return;
        const uri = await persistFile(recorder.uri, `录音-${Date.now()}.m4a`);
        const audioAttachment: Attachment = {
          id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
          kind: 'audio',
          name: `录音-${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}.m4a`,
          uri,
          mimeType: 'audio/mp4',
          size: null,
          width: null,
          height: null,
          durationMs: Math.round(recorder.currentTime * 1000),
          coverUri: null,
        };
        const previousAudio = attachments.filter((attachment) => attachment.kind === 'audio');
        await deleteImportedFiles(previousAudio);
        await Promise.all(previousAudio.filter((attachment) => attachment.coverUri).map((attachment) => deleteImportedFiles([{ ...attachment, uri: attachment.coverUri as string }])));
        setAttachments((current) => [...current.filter((attachment) => attachment.kind !== 'audio'), audioAttachment].slice(0, 20));
        setRecordingSeconds(0);
        return;
      }
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) throw new Error('需要麦克风权限才能录音');
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch (error) {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
      setRecording(false);
      Alert.alert('无法录音', error instanceof Error ? error.message : '请稍后重试');
    }
  };

  const addLink = () => {
    Alert.prompt('添加链接', '请输入链接地址', (value) => {
      const link = value?.trim();
      if (!link) return;
      const normalized = /^https?:\/\//i.test(link) ? link : `https://${link}`;
      setBody((current) => `${current.trim()}${current.trim() ? '\n\n' : ''}${normalized}`);
    }, 'plain-text');
  };

  const selectAudioCover = async (attachment: Attachment) => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    if (result.canceled || !result.assets[0]) return;
    const selected = result.assets[0];
    const coverUri = await persistFile(selected.uri, selected.fileName ?? 'audio-cover.jpg');
    if (attachment.coverUri) await deleteImportedFiles([{ ...attachment, uri: attachment.coverUri }]);
    setAttachments((current) => current.map((item) => item.id === attachment.id ? { ...item, coverUri } : item));
  };

  const removeAttachment = async (attachment: Attachment) => {
    setAttachments((current) => current.filter((item) => item.id !== attachment.id));
    await deleteImportedFiles([attachment]);
    if (attachment.coverUri) await deleteImportedFiles([{ ...attachment, uri: attachment.coverUri }]);
  };

  const removeImageFromViewer = async (index: number) => {
    const imageAttachments = attachments.filter(isImageAttachment);
    const attachment = imageAttachments[index];
    if (!attachment) return;
    await removeAttachment(attachment);
    if (imageAttachments.length <= 1) {
      setImageViewerIndex(null);
    } else {
      setImageViewerIndex((current) => Math.min(current ?? 0, imageAttachments.length - 2));
    }
  };

  const submit = async () => {
    if (!canPublish || submitting) return;
    if (!user) {
      Alert.alert('请先登录', '登录后才能发布内容。', [{ text: '去登录', onPress: () => router.push('/auth') }, { text: '取消', style: 'cancel' }]);
      return;
    }
    if (editingItem && !/^\d+\.\d+\.\d+$/.test(versionInput.trim())) {
      Alert.alert('版本号格式错误', '请输入符合 x.x.x 规则的版本号。');
      return;
    }
    setSubmitting(true);
    try {
      const draft = { title, body, tags, location, teamNames, isPublic, attachments, authorName: user?.name };
      const item = editingItem ? await update(editingItem.id, draft, versionInput.trim() || requestedVersion) : await publish(draft);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: '/content/[id]', params: { id: item.id } });
    } catch {
      Alert.alert('还不能发布', '请输入文字或添加至少一个附件。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.nav}>
          <Pressable hitSlop={12} onPress={() => router.back()} style={styles.navButton}>
            <Ionicons color={colors.ink} name="close" size={23} />
          </Pressable>
          <Text style={styles.navTitle}>{editingItem ? '编辑内容' : '新建收录'}</Text>
          <Pressable
            disabled={!canPublish || submitting}
            onPress={() => void submit()}
            style={[styles.publish, (!canPublish || submitting) && styles.publishDisabled]}
          >
            <Text style={styles.publishText}>{submitting ? '保存中' : '发布'}</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TextInput
            autoFocus
            multiline
            onChangeText={setBody}
            placeholder="写下一段文字、一个故事，或此刻的灵感……"
            placeholderTextColor={colors.muted}
            scrollEnabled={false}
            style={styles.bodyInput}
            textAlignVertical="top"
            value={body}
          />

          {recording ? (
            <View style={styles.recordingBar}>
              <View style={styles.recordingWave}>{Array.from({ length: 28 }, (_, index) => <View key={index} style={[styles.recordingWaveBar, { height: 6 + ((index * 9) % 15) }]} />)}</View>
              <Text style={styles.recordingTime}>正在录音 {formatRecordingDuration(recordingSeconds)}</Text>
              <Pressable accessibilityLabel="停止录音" onPress={() => void recordAudio()} style={styles.recordingStop}><Ionicons color={colors.card} name="stop" size={14} /></Pressable>
            </View>
          ) : null}

          {attachments.length ? (
            <View style={styles.attachmentGrid}>
              {attachments.filter(isImageAttachment).length ? (
                <View style={styles.imageGrid}>
                  {Array.from({ length: Math.ceil((Math.min(attachments.filter(isImageAttachment).length, 9) + (attachments.filter(isImageAttachment).length < 9 ? 1 : 0)) / 3) }, (_, rowIndex) => {
                    const imageAttachments = attachments.filter(isImageAttachment).slice(0, 9);
                    const hasAddCell = imageAttachments.length < 9;
                    return (
                      <View key={`image-row-${rowIndex}`} style={styles.imageGridRow}>
                        {Array.from({ length: 3 }, (_, columnIndex) => {
                          const index = rowIndex * 3 + columnIndex;
                          const attachment = imageAttachments[index];
                          if (attachment) {
                            return <Pressable key={attachment.id} onPress={() => setImageViewerIndex(index)} style={styles.imageGridCell}><Image source={{ uri: attachment.uri }} resizeMode="cover" style={styles.imageGridImage} /></Pressable>;
                          }
                          if (hasAddCell && index === imageAttachments.length) {
                            return <Pressable key="add-image" accessibilityLabel="添加图片" onPress={() => void addMedia()} style={[styles.imageGridCell, styles.addImageCell]}><Ionicons color={colors.accent} name="add" size={28} /></Pressable>;
                          }
                          return <View key={`image-empty-${rowIndex}-${columnIndex}`} style={styles.imageGridCell} />;
                        })}
                      </View>
                    );
                  })}
                </View>
              ) : null}
              {attachments.filter((attachment) => !isImageAttachment(attachment)).map((attachment) => (
                attachment.kind === 'audio' ? <View key={attachment.id} style={styles.audioAttachmentWrap}><AudioAttachmentRow attachment={attachment} onCoverPress={() => void selectAudioCover(attachment)} /><Pressable hitSlop={8} onPress={() => void removeAttachment(attachment)} style={styles.audioRemove}><Ionicons color={colors.muted} name="close-circle" size={21} /></Pressable></View> : attachment.kind === 'video' ? (
                  <View key={attachment.id} style={styles.videoAttachmentWrap}>
                    <VideoCover attachment={attachment} onPress={() => setPreviewVideo(attachment)} {...videoSize(previewWidth, attachment.width, attachment.height)} />
                    <Pressable hitSlop={8} onPress={() => void removeAttachment(attachment)} style={styles.videoRemove}><Ionicons color={colors.card} name="close-circle" size={22} /></Pressable>
                  </View>
                ) : (
                  <View key={attachment.id} style={styles.attachmentCard}>
                    {attachment.kind === 'image' ? (
                      <Image source={{ uri: attachment.uri }} style={styles.thumbnail} />
                    ) : (
                      <View style={styles.attachmentIcon}>
                        <Ionicons color={colors.blue} name="document-text-outline" size={27} />
                      </View>
                    )}
                    <View style={styles.attachmentInfo}>
                      <Text numberOfLines={1} style={styles.attachmentName}>{attachment.name}</Text>
                      <Text style={styles.attachmentType}>{attachmentLabel(attachment.kind)}</Text>
                    </View>
                    <Pressable hitSlop={8} onPress={() => void removeAttachment(attachment)}>
                      <Ionicons color={colors.muted} name="close-circle" size={21} />
                    </Pressable>
                  </View>
                )
              ))}
            </View>
          ) : null}

          <View style={styles.rule} />
          <TextInput
            maxLength={120}
            onChangeText={setTitle}
            placeholder="加个标题？"
            placeholderTextColor={colors.muted}
            style={styles.titleInput}
            value={title}
          />

          <View style={styles.tagsBlock}>
            <Text style={styles.fieldLabel}>标签</Text>
            <TextInput
              autoCapitalize="none"
              onChangeText={setTagInput}
            placeholder="#标签 使用空格分割，最多5个"
              placeholderTextColor={colors.muted}
              style={styles.tagsInput}
              value={tagInput}
            />
            {tags.length ? (
              <View style={styles.tagPreview}>
                {tags.map((tag) => <Text key={tag} style={styles.tag}>#{tag}</Text>)}
              </View>
            ) : null}
          </View>
          <View style={styles.tagsBlock}>
            <Text style={styles.fieldLabel}>所在位置</Text>
            <View style={styles.locationInputRow}>
              <Ionicons color={colors.muted} name="location-outline" size={18} />
              <TextInput
                onChangeText={setLocation}
                placeholder="例如：上海 · 徐汇滨江"
                placeholderTextColor={colors.muted}
                style={styles.locationInput}
                value={location}
              />
            </View>
          </View>
          {teamOptions.length ? (
            <View style={styles.metaBlock}>
              <Text style={styles.fieldLabel}>项目</Text>
              <Text style={styles.teamHint}>选择一个已关注项目</Text>
              <View style={styles.teamOptions}>
                {teamOptions.map((team) => {
                  const selected = teamNames.includes(team);
                  return <Pressable key={team} onPress={() => setTeamNames(selected ? ['无'] : [team])} style={[styles.teamChip, selected && styles.teamChipSelected]}><Text style={[styles.teamChipText, selected && styles.teamChipTextSelected]}>#{team}</Text></Pressable>;
                })}
              </View>
            </View>
          ) : null}
          <View style={styles.publicRow}>
            <View style={styles.publicCopy}>
              <Text style={styles.publicTitle}>是否公开</Text>
              <Text style={styles.publicHint}>{teamNames.some((team) => team !== '无') ? `继承项目隐私 · ${isPublic ? '公开' : '私密'}` : isPublic ? '公开内容' : '仅保存在你的设备上'}</Text>
            </View>
            <Switch
              ios_backgroundColor={colors.line}
              onValueChange={setIsPublic}
              thumbColor={colors.card}
              trackColor={{ false: colors.line, true: colors.sage }}
              disabled={teamNames.some((team) => team !== '无')}
              value={isPublic}
            />
          </View>
          {editingItem ? (
            <View style={styles.versionRow}>
              <View style={styles.publicCopy}>
                <Text style={styles.publicTitle}>版本号</Text>
                <Text style={styles.publicHint}>{versionHint} → 创作 {versionInput || nextVersion}</Text>
              </View>
              <View style={styles.versionValue}>
                <TextInput
                  editable={canEditVersion && Boolean(sourceVersionId)}
                  keyboardType="numbers-and-punctuation"
                  maxLength={20}
                  onChangeText={setVersionInput}
                  selectTextOnFocus={canEditVersion && Boolean(sourceVersionId)}
                  style={[styles.versionInput, !(canEditVersion && sourceVersionId) && styles.versionInputDisabled]}
                  value={versionInput || nextVersion}
                />
                {!sourceVersionId ? <Text style={styles.versionLock}>当前编辑自动递增</Text> : !canEditVersion ? <Text style={styles.versionLock}>仅可查看</Text> : null}
              </View>
            </View>
          ) : null}
        </ScrollView>

        <ImageViewerModal
          images={attachments.filter(isImageAttachment).slice(0, 9)}
          initialIndex={imageViewerIndex ?? 0}
          onClose={() => setImageViewerIndex(null)}
          onDelete={(index) => void removeImageFromViewer(index)}
          visible={imageViewerIndex !== null}
        />
        {previewVideo ? <VideoViewerModal attachment={previewVideo} onClose={() => setPreviewVideo(null)} visible /> : null}

        <View style={styles.toolbar}>
          <Text style={styles.toolbarHint}>添加到内容</Text>
          <View style={styles.actions}>
            <ToolButton icon="images-outline" label="图片/视频" onPress={() => void addMedia()} />
            <ToolButton icon={recording ? 'stop-circle-outline' : 'mic-outline'} label={recording ? '停止录音' : '录音'} onPress={() => void recordAudio()} />
            <ToolButton icon="document-attach-outline" label="文档/文件" onPress={() => void addDocuments()} />
            <ToolButton icon="link-outline" label="链接" onPress={addLink} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function ToolButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tool, pressed && { opacity: 0.7 }]}>
      <View style={styles.toolIcon}><Ionicons color={colors.accent} name={icon} size={20} /></View>
      <Text numberOfLines={1} style={styles.toolText}>{label}</Text>
    </Pressable>
  );
}

function attachmentLabel(kind: Attachment['kind']): string {
  return { image: '图片', video: '视频', audio: '音频', document: '文件' }[kind];
}

function isImageAttachment(attachment: Attachment): boolean {
  return attachment.kind === 'image' || Boolean(attachment.mimeType?.startsWith('image/'));
}

function attachmentKey(attachment: Attachment): string {
  if (attachment.assetId) return `asset:${attachment.assetId}`;
  return [attachment.kind, attachment.name, attachment.size ?? '', attachment.width ?? '', attachment.height ?? '', attachment.mimeType ?? ''].join('|');
}

function incrementPatch(version: string): string {
  const [major, minor, patch] = version.split('.').map(Number);
  return `${major || 0}.${minor || 0}.${(patch || 0) + 1}`;
}

function formatRecordingDuration(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function videoSize(containerWidth: number, width: number | null, height: number | null): { width: number; height: number } {
  const ratio = width && height ? width / height : 1;
  return ratio >= 1
    ? { width: containerWidth, height: containerWidth / ratio }
    : { width: containerWidth * ratio, height: containerWidth };
}

function hasContentChanges(
  item: ContentItem,
  draft: { title: string; body: string; tags: string[]; location: string; teamNames: string[]; isPublic: boolean; attachments: Attachment[] },
): boolean {
  return JSON.stringify({
    title: draft.title.trim(), body: draft.body.trim(), tags: draft.tags,
    location: draft.location.trim(), teamNames: draft.teamNames, isPublic: draft.isPublic, attachments: draft.attachments,
  }) !== JSON.stringify({
    title: item.title, body: item.body, tags: item.tags,
    location: item.location, teamNames: item.teamNames, isPublic: item.isPublic, attachments: item.attachments,
  });
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  nav: { height: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  navTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  publish: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 17, paddingVertical: 9 },
  publishDisabled: { backgroundColor: colors.line },
  publishText: { color: colors.card, fontSize: 14, fontWeight: '700' },
  content: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 34 },
  titleInput: { color: colors.ink, fontSize: 27, lineHeight: 35, fontWeight: '700', minHeight: 46 },
  rule: { width: 36, height: 3, borderRadius: 2, backgroundColor: colors.accent, marginVertical: 18 },
  bodyInput: { color: colors.ink, fontSize: 17, lineHeight: 26, minHeight: 100 },
  recordingBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, padding: 11, borderRadius: radius.medium, backgroundColor: colors.accentSoft },
  recordingWave: { flex: 1, height: 26, flexDirection: 'row', alignItems: 'center', gap: 2 },
  recordingWaveBar: { width: 3, borderRadius: 2, backgroundColor: colors.accent },
  recordingTime: { color: colors.accent, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  recordingStop: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  attachmentGrid: { gap: 10, marginTop: 18 },
  imageGrid: { gap: 4 },
  imageGridRow: { flexDirection: 'row', gap: 4 },
  imageGridCell: { flex: 1, aspectRatio: 1, borderRadius: 6, overflow: 'hidden', backgroundColor: colors.line },
  imageGridImage: { width: '100%', height: '100%' },
  addImageCell: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  audioAttachmentWrap: { position: 'relative' },
  audioRemove: { position: 'absolute', top: 7, right: 7 },
  videoAttachmentWrap: { position: 'relative', alignSelf: 'stretch', borderRadius: radius.medium, overflow: 'hidden' },
  videoRemove: { position: 'absolute', top: 8, right: 8 },
  attachmentCard: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: colors.card, padding: 10, borderRadius: radius.medium, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  thumbnail: { width: 52, height: 52, borderRadius: 12, backgroundColor: colors.line },
  attachmentIcon: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blueSoft },
  attachmentInfo: { flex: 1, gap: 4 },
  attachmentName: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  attachmentType: { color: colors.muted, fontSize: 11 },
  tagsBlock: { marginTop: 30, backgroundColor: colors.card, borderRadius: radius.medium, padding: 15 },
  fieldLabel: { color: colors.secondary, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  tagsInput: { color: colors.ink, fontSize: 14, minHeight: 34 },
  locationInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locationInput: { color: colors.ink, fontSize: 14, minHeight: 34, flex: 1 },
  metaBlock: { marginTop: 12, backgroundColor: colors.card, borderRadius: radius.medium, padding: 15 },
  teamHint: { color: colors.muted, fontSize: 12, marginTop: 3 },
  teamOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 11 },
  teamChip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.paper },
  teamChipSelected: { backgroundColor: colors.sage },
  teamChipText: { color: colors.secondary, fontSize: 12, fontWeight: '600' },
  teamChipTextSelected: { color: colors.card },
  publicRow: { marginTop: 12, padding: 15, backgroundColor: colors.card, borderRadius: radius.medium, flexDirection: 'row', alignItems: 'center' },
  versionRow: { marginTop: 12, padding: 15, backgroundColor: colors.card, borderRadius: radius.medium, flexDirection: 'row', alignItems: 'center' },
  versionInput: { minWidth: 72, color: colors.accent, fontSize: 16, fontWeight: '800', textAlign: 'right', paddingVertical: 4 },
  versionValue: { alignItems: 'flex-end' },
  versionLock: { color: colors.muted, fontSize: 10 },
  versionInputDisabled: { color: colors.muted },
  publicCopy: { flex: 1, gap: 4 },
  publicTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  publicHint: { color: colors.muted, fontSize: 12 },
  tagPreview: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  tag: { color: colors.sage, backgroundColor: colors.sageSoft, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 5, fontSize: 12, fontWeight: '600' },
  toolbar: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14, backgroundColor: colors.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  toolbarHint: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 9 },
  actions: { flexDirection: 'row', gap: 6 },
  tool: { flex: 1, flexDirection: 'column', alignItems: 'center', gap: 3, backgroundColor: colors.paper, borderRadius: radius.medium, paddingVertical: 7, paddingHorizontal: 3 },
  toolIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  toolText: { color: colors.ink, fontSize: 10, fontWeight: '600' },
});
