import { router } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, Share, StyleSheet } from 'react-native';

import { BottomNav } from '../src/components/bottom-nav';
import { ContentCard } from '../src/components/content-card';
import { EmptyLibrary } from '../src/components/empty-library';
import { Screen } from '../src/components/screen';
import { useContentStore } from '../src/state/content-store';

export default function AudioScreen() {
  const { items, locations, hydrate, toggleFavorite, toggleLike, incrementMetric } = useContentStore();
  const audios = items.filter((item) => item.kind === 'audio' && (locations.length === 0 || locations.includes(item.location)));

  useEffect(() => { void hydrate(); }, [hydrate]);

  return (
    <Screen>
      <FlatList
        contentContainerStyle={styles.list}
        data={audios}
        keyExtractor={(item) => item.id}
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
});
