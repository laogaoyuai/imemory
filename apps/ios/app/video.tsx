import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, Share, StyleSheet, Text, View } from 'react-native';

import { BottomNav } from '../src/components/bottom-nav';
import { ContentCard } from '../src/components/content-card';
import { EmptyLibrary } from '../src/components/empty-library';
import { Screen } from '../src/components/screen';
import { useContentStore } from '../src/state/content-store';
import { colors } from '../src/theme';

export default function VideoScreen() {
  const { items, hydrate, toggleFavorite, toggleLike, incrementMetric } = useContentStore();
  const videos = items.filter((item) => item.kind === 'video');

  useEffect(() => { void hydrate(); }, [hydrate]);

  return (
    <Screen>
      <FlatList
        contentContainerStyle={styles.list}
        data={videos}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={<View style={styles.header}>
          <View style={styles.titleRow}>
            <View><Text style={styles.eyebrow}>MEDIA SPACE</Text><Text style={styles.title}>视频</Text></View>
            <View style={styles.icon}><Ionicons color={colors.accent} name="videocam-outline" size={25} /></View>
          </View>
          <Text style={styles.subtitle}>记录会动的瞬间</Text>
        </View>}
        ListEmptyComponent={<EmptyLibrary hasQuery={false} onCreate={() => router.push('/compose')} />}
        renderItem={({ item }) => (
          <ContentCard item={item} onFavorite={() => void toggleFavorite(item.id)} onLike={() => void toggleLike(item.id)} onShare={() => void Share.share({ message: `${item.title}\n${item.body}` }).then(() => incrementMetric(item.id, 'shareCount'))} onPress={() => void incrementMetric(item.id, 'readCount').then(() => router.push({ pathname: '/content/[id]', params: { id: item.id } }))} />
        )}
        showsVerticalScrollIndicator={false}
      />
      <BottomNav />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 118 },
  header: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 22 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: colors.accent, fontSize: 10, letterSpacing: 2, fontWeight: '800' },
  title: { color: colors.ink, fontSize: 36, fontWeight: '800', marginTop: 4 },
  subtitle: { color: colors.secondary, fontSize: 14, marginTop: 4 },
  icon: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
});
