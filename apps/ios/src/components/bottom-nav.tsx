import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadow } from '../theme';

type NavKey = 'home' | 'video' | 'create' | 'audio' | 'me';

const items: Array<{
  key: NavKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  path: '/' | '/video' | '/audio' | '/me';
}> = [
  { key: 'home', label: '首页', icon: 'home-outline', activeIcon: 'home', path: '/' },
  { key: 'video', label: '视频', icon: 'videocam-outline', activeIcon: 'videocam', path: '/video' },
  { key: 'create', label: '发布', icon: 'add', activeIcon: 'add', path: '/' },
  { key: 'audio', label: '音频', icon: 'headset-outline', activeIcon: 'headset', path: '/audio' },
  { key: 'me', label: '我的', icon: 'person-outline', activeIcon: 'person', path: '/me' },
];

export function BottomNav() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const active: NavKey = pathname === '/video'
    ? 'video'
    : pathname === '/audio'
      ? 'audio'
      : pathname === '/me'
        ? 'me'
        : 'home';

  return (
    <View pointerEvents="box-none" style={styles.wrapper}>
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {items.map((item) => {
          const selected = active === item.key;
          if (item.key === 'create') {
            return (
              <Pressable
                accessibilityLabel="发布内容"
                key={item.key}
                onPress={() => router.push('/compose')}
                style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}
              >
                <Ionicons color={colors.card} name="add" size={28} />
              </Pressable>
            );
          }

          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={item.label}
              key={item.key}
              onPress={() => router.replace(item.path)}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            >
              <Ionicons
                color={selected ? colors.accent : colors.muted}
                name={selected ? item.activeIcon : item.icon}
                size={22}
              />
              <Text style={[styles.label, selected && styles.labelSelected]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  bar: {
    minHeight: 72,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    ...shadow,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
  },
  item: { width: 54, alignItems: 'center', gap: 3 },
  label: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  labelSelected: { color: colors.accent },
  createButton: {
    width: 52,
    height: 52,
    marginTop: -25,
    borderRadius: 19,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: colors.paper,
    ...shadow,
    shadowOpacity: 0.16,
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.95 }] },
});
