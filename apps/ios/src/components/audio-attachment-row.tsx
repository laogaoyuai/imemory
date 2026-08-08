import type { Attachment } from '@atlas/core';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useRef } from 'react';

import { colors, radius } from '../theme';

export function AudioAttachmentRow({ attachment, onCoverPress }: { attachment: Attachment; onCoverPress?: () => void }) {
  const player = useAudioPlayer(attachment.uri, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const playing = status.playing;
  const duration = status.duration || (attachment.durationMs ?? 0) / 1000;
  const progress = duration ? Math.min(1, status.currentTime / duration) : 0;
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (playing) {
      const animation = Animated.loop(Animated.timing(rotation, { toValue: 1, duration: 5000, easing: Easing.linear, useNativeDriver: true }));
      animation.start();
      return () => animation.stop();
    }
    rotation.stopAnimation();
    return undefined;
  }, [playing, rotation]);
  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const togglePlayback = async () => {
    if (playing) {
      player.pause();
      return;
    }
    if (duration > 0 && status.currentTime >= duration - 0.05) await player.seekTo(0);
    player.play();
  };

  return (
    <View style={styles.row}>
      <Pressable accessibilityLabel={onCoverPress ? '上传音频封面' : (playing ? '暂停音频' : '播放音频')} onPress={(event) => { event.stopPropagation(); (onCoverPress ?? togglePlayback)(); }} style={[styles.cover, !playing && styles.coverPaused]}>
        <Animated.View style={[styles.coverSpinner, { transform: [{ rotate }] }]}>
          {attachment.coverUri ? <Image source={{ uri: attachment.coverUri }} style={styles.coverImage} /> : <View style={styles.cd}><View style={styles.cdHole} /></View>}
          {!playing ? <View pointerEvents="none" style={styles.coverOverlay} /> : null}
          {!attachment.coverUri ? <Text pointerEvents="none" style={styles.coverHint}>上传封面</Text> : null}
        </Animated.View>
      </Pressable>
      <Pressable accessibilityLabel={playing ? '暂停音频' : '播放音频'} onPress={(event) => { event.stopPropagation(); void togglePlayback(); }} style={styles.content}>
        <View style={styles.waveform}>
          {Array.from({ length: 24 }, (_, index) => <View key={index} style={[styles.wave, { height: 5 + ((index * 7) % 12), opacity: index / 30 < progress ? 1 : 0.32 }]} />)}
        </View>
        <View style={styles.meta}>
          <Text numberOfLines={1} style={styles.name}>{attachment.name}</Text>
          <Text style={styles.duration}>{formatDuration(status.currentTime || duration)}</Text>
        </View>
      </Pressable>
    </View>
  );
}

function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: radius.medium, backgroundColor: colors.sageSoft },
  cover: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  coverSpinner: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center' },
  coverImage: { width: '100%', height: '100%' },
  coverPaused: { opacity: 0.72 },
  coverOverlay: { ...StyleSheet.absoluteFill, borderRadius: 27, backgroundColor: 'rgba(128,128,128,0.42)' },
  cd: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#171717', borderWidth: 2, borderColor: '#3b3b3b', alignItems: 'center', justifyContent: 'center' },
  cdHole: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#a3a3a3' },
  coverHint: { position: 'absolute', left: 0, right: 0, bottom: 3, color: colors.card, fontSize: 8, fontWeight: '700', textAlign: 'center' },
  content: { flex: 1, alignSelf: 'stretch', justifyContent: 'center', gap: 6 },
  waveform: { width: '100%', height: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wave: { flex: 1, maxWidth: 4, minWidth: 2, marginHorizontal: 1, borderRadius: 2, backgroundColor: colors.sage },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, color: colors.ink, fontSize: 12, fontWeight: '600' },
  duration: { color: colors.secondary, fontSize: 11, fontVariant: ['tabular-nums'] },
});
