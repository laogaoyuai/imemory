import type { Attachment } from '@atlas/core';
import { Video, View } from '@tarojs/components';
import Taro from '@tarojs/taro';

import './content-video-player.css';

export function ContentVideoPlayer({ attachment, className = '' }: { attachment: Attachment; className?: string }) {
  return (
    <View className={`atlas-video-player ${className}`.trim()} onClick={(event) => event.stopPropagation()}>
      <Video
        className="atlas-video-player__video"
        controls
        direction={0}
        enableProgressGesture
        loop={false}
        onError={() => void Taro.showToast({ title: '视频加载失败，请检查网络后重试', icon: 'none' })}
        poster={attachment.coverUri ?? ''}
        showCenterPlayBtn
        src={attachment.uri}
      />
    </View>
  );
}
