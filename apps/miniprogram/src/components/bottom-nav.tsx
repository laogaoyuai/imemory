import { Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';

import './bottom-nav.css';

export type BottomNavKey = 'home' | 'video' | 'create' | 'audio' | 'me';

const items: Array<{ key: BottomNavKey; label: string; glyph: string }> = [
  { key: 'home', label: '首页', glyph: '⌂' },
  { key: 'video', label: '视频', glyph: '▷' },
  { key: 'create', label: '发布', glyph: '＋' },
  { key: 'audio', label: '音频', glyph: '♫' },
  { key: 'me', label: '我的', glyph: '○' },
];

export function BottomNav({
  active,
  onSelect,
}: {
  active: BottomNavKey;
  onSelect?: (key: Exclude<BottomNavKey, 'create' | 'me'>) => void;
}) {
  const select = (key: BottomNavKey) => {
    if (key === 'create') {
      void Taro.navigateTo({ url: '/pages/compose/index' });
      return;
    }
    if (key === 'me') {
      if (active !== 'me') void Taro.navigateTo({ url: '/pages/profile/index' });
      return;
    }
    if (onSelect) {
      onSelect(key);
      return;
    }
    const filter = key === 'home' ? 'all' : key;
    void Taro.reLaunch({ url: `/pages/index/index?filter=${filter}` });
  };

  return (
    <View className="bottom-nav">
      {items.map((item) => item.key === 'create' ? (
        <View className="bottom-nav__create-wrap" key={item.key} onClick={() => select(item.key)}>
          <View className="bottom-nav__create"><Text>{item.glyph}</Text></View>
          <Text className="bottom-nav__create-label">{item.label}</Text>
        </View>
      ) : (
        <View
          className={`bottom-nav__item ${active === item.key ? 'bottom-nav__item--active' : ''}`}
          key={item.key}
          onClick={() => select(item.key)}
        >
          <Text className="bottom-nav__icon">{item.glyph}</Text>
          <Text className="bottom-nav__label">{item.label}</Text>
        </View>
      ))}
    </View>
  );
}
