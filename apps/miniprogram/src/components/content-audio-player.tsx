import type { Attachment } from '@atlas/core';
import { Image, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useEffect, useRef, useState } from 'react';

import './content-audio-player.css';

export function ContentAudioPlayer({
  attachment,
  active = true,
  autoPlay = false,
  className = '',
  onCoverPress,
  onEnded,
}: {
  attachment: Attachment;
  active?: boolean;
  autoPlay?: boolean;
  className?: string;
  onCoverPress?: () => void;
  onEnded?: () => void;
}) {
  const playerRef = useRef<ReturnType<typeof Taro.createInnerAudioContext> | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(Math.max(0, (attachment.durationMs ?? 0) / 1000));
  const [error, setError] = useState(false);

  useEffect(() => {
    const player = Taro.createInnerAudioContext();
    player.src = attachment.uri;
    player.autoplay = false;
    player.onPlay(() => setPlaying(true));
    player.onPause(() => setPlaying(false));
    player.onStop(() => setPlaying(false));
    player.onTimeUpdate(() => {
      setCurrentTime(player.currentTime || 0);
      if (player.duration > 0) setDuration(player.duration);
    });
    player.onCanplay(() => {
      if (player.duration > 0) setDuration(player.duration);
    });
    player.onEnded(() => {
      setPlaying(false);
      setCurrentTime(0);
      onEnded?.();
    });
    player.onError(() => {
      setPlaying(false);
      setError(true);
    });
    playerRef.current = player;
    if (autoPlay && active) {
      player.play();
    } else {
      player.pause();
    }
    return () => {
      player.stop();
      player.destroy();
      playerRef.current = null;
    };
  }, [attachment.uri, autoPlay]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    if (!active && playing) {
      player.pause();
      setPlaying(false);
    } else if (active && autoPlay && !playing) {
      player.play();
    }
  }, [active, autoPlay, playing]);

  const togglePlayback = () => {
    const player = playerRef.current;
    if (!player) return;
    setError(false);
    if (playing) {
      player.pause();
      return;
    }
    if (duration > 0 && currentTime >= duration - 0.05) {
      player.seek(0);
      setCurrentTime(0);
    }
    player.play();
  };

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  return (
    <View className={`atlas-audio-player ${className}`.trim()} onClick={(event) => event.stopPropagation()}>
      <View className={`atlas-audio-player__cover ${playing ? 'atlas-audio-player__cover--playing' : ''}`} onClick={() => onCoverPress ? onCoverPress() : togglePlayback()}>
        {attachment.coverUri ? <Image className="atlas-audio-player__cover-image" mode="aspectFill" src={attachment.coverUri} /> : <View className="atlas-audio-player__record"><View /></View>}
        {!playing ? <View className="atlas-audio-player__cover-overlay"><Text>{onCoverPress ? '封面' : '▶'}</Text></View> : null}
      </View>
      <View className="atlas-audio-player__content" onClick={togglePlayback}>
        <View className="atlas-audio-player__waveform">
          {Array.from({ length: 24 }, (_, index) => <View className={`atlas-audio-player__wave ${index / 24 <= progress ? 'atlas-audio-player__wave--active' : ''}`} key={index} style={{ height: `${7 + ((index * 7) % 13)}px` }} />)}
        </View>
        <View className="atlas-audio-player__meta"><Text className="atlas-audio-player__name">{attachment.name}</Text><Text className="atlas-audio-player__time">{formatDuration(currentTime || duration)}</Text></View>
        {error ? <Text className="atlas-audio-player__error">播放失败，点击重试</Text> : null}
      </View>
    </View>
  );
}

function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
