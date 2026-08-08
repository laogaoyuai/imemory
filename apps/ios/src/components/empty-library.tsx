import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '../theme';

export function EmptyLibrary({ hasQuery, onCreate }: { hasQuery: boolean; onCreate: () => void }) {
  return (
    <View style={styles.container}>
      <View style={styles.art}>
        <View style={styles.backSheet} />
        <View style={styles.frontSheet}>
          <Ionicons color={colors.accent} name={hasQuery ? 'search' : 'bookmark-outline'} size={34} />
        </View>
      </View>
      <Text style={styles.title}>{hasQuery ? '没有找到相关内容' : '这里还很安静'}</Text>
      <Text style={styles.description}>
        {hasQuery ? '换个关键词或筛选条件试试' : '收藏第一段文字、照片或灵感，让它们都有归处。'}
      </Text>
      {!hasQuery ? (
        <Pressable onPress={onCreate} style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]}>
          <Ionicons color={colors.card} name="add" size={20} />
          <Text style={styles.buttonText}>新建内容</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingHorizontal: 44, paddingTop: 72 },
  art: { width: 100, height: 90, marginBottom: 22 },
  backSheet: {
    position: 'absolute',
    width: 70,
    height: 76,
    borderRadius: radius.medium,
    backgroundColor: colors.sageSoft,
    transform: [{ rotate: '-9deg' }],
    left: 6,
    top: 6,
  },
  frontSheet: {
    position: 'absolute',
    width: 72,
    height: 80,
    borderRadius: radius.medium,
    backgroundColor: colors.accentSoft,
    transform: [{ rotate: '7deg' }],
    right: 5,
    top: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.ink, fontSize: 21, fontWeight: '700' },
  description: { color: colors.secondary, fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 8 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginTop: 24,
  },
  buttonText: { color: colors.card, fontSize: 14, fontWeight: '700' },
});
