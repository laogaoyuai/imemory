import type { Attachment } from '@atlas/core';
import { Ionicons } from '@expo/vector-icons';
import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useState } from 'react';
import { Dimensions, Modal, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '../theme';

export function VideoCover({ attachment, width, height, onPress }: { attachment: Attachment; width: number; height: number; onPress: () => void }) {
  const player = useVideoPlayer(attachment.uri, (videoPlayer) => {
    videoPlayer.pause();
    videoPlayer.currentTime = 0;
  });

  return (
    <Pressable accessibilityLabel="播放视频" onPress={onPress} style={[styles.cover, { width, height }]}>
      <VideoView contentFit="contain" nativeControls={false} player={player} style={StyleSheet.absoluteFill} />
      <View style={styles.coverPlay}><Ionicons color={colors.card} name="play" size={24} /></View>
    </Pressable>
  );
}

export function VideoViewerModal({ attachment, visible, onClose }: { attachment: Attachment; visible: boolean; onClose: () => void }) {
  const { width, height } = Dimensions.get('window');
  const player = useVideoPlayer(attachment.uri, (videoPlayer) => {
    videoPlayer.pause();
    videoPlayer.timeUpdateEventInterval = 0.1;
  });
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);

  useEventListener(player, 'timeUpdate', ({ currentTime: nextTime }) => {
    setCurrentTime(nextTime);
    if (player.duration > 0) setDuration(player.duration);
  });
  useEventListener(player, 'statusChange', () => {
    if (player.duration > 0) setDuration(player.duration);
  });
  useEffect(() => {
    if (visible) {
      player.currentTime = 0;
      setCurrentTime(0);
      setDuration(player.duration > 0 ? player.duration : 0);
      player.play();
    } else {
      player.pause();
    }
  }, [player, visible]);

  const seek = (locationX: number) => {
    if (!trackWidth || !duration) return;
    const ratio = Math.max(0, Math.min(1, locationX / trackWidth));
    player.currentTime = ratio * duration;
    setCurrentTime(ratio * duration);
  };
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => seek(event.nativeEvent.locationX),
    onPanResponderMove: (event) => seek(event.nativeEvent.locationX),
  }), [duration, trackWidth]);
  const playing = player.playing;

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.viewerBackdrop}>
        <VideoView contentFit="contain" nativeControls={false} player={player} style={{ width, height: height - 150 }} />
        <Pressable accessibilityLabel={playing ? '暂停视频' : '播放视频'} onPress={() => (playing ? player.pause() : player.play())} style={styles.viewerPlay}>
          <Ionicons color={colors.card} name={playing ? 'pause' : 'play'} size={28} />
        </Pressable>
        <View style={styles.controls}>
          <Text style={styles.time}>{formatTime(currentTime)}</Text>
          <View
            {...panResponder.panHandlers}
            onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
            style={styles.track}
          >
            <View style={styles.trackBase} />
            <View style={[styles.progress, { width: `${duration ? Math.min(100, (currentTime / duration) * 100) : 0}%` }]} />
            <View style={[styles.thumb, { left: `${duration ? Math.min(100, (currentTime / duration) * 100) : 0}%` }]} />
          </View>
          <Text style={styles.time}>{formatTime(duration)}</Text>
        </View>
        <Pressable accessibilityLabel="关闭视频预览" hitSlop={12} onPress={onClose} style={styles.close}>
          <Ionicons color={colors.card} name="close" size={27} />
        </Pressable>
      </View>
    </Modal>
  );
}

function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  cover: { overflow: 'hidden', borderRadius: radius.medium, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  coverPlay: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(0,0,0,0.48)', alignItems: 'center', justifyContent: 'center' },
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.97)', justifyContent: 'center' },
  viewerPlay: { position: 'absolute', left: '50%', top: '50%', marginLeft: -27, marginTop: -27, width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(0,0,0,0.46)', alignItems: 'center', justifyContent: 'center' },
  controls: { position: 'absolute', left: 18, right: 18, bottom: 35, flexDirection: 'row', alignItems: 'center', gap: 8 },
  time: { color: colors.card, fontSize: 11, fontVariant: ['tabular-nums'], minWidth: 30, textAlign: 'center' },
  track: { flex: 1, height: 24, justifyContent: 'center' },
  trackBase: { position: 'absolute', left: 0, right: 0, top: 10, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
  progress: { position: 'absolute', left: 0, top: 10, height: 4, borderRadius: 2, backgroundColor: colors.card },
  thumb: { position: 'absolute', top: 7, width: 10, height: 10, marginLeft: -5, borderRadius: 5, backgroundColor: colors.card },
  close: { position: 'absolute', top: 54, right: 20, width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
});
