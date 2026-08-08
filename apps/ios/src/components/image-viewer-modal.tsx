import type { Attachment } from '@atlas/core';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Dimensions, FlatList, Image, Modal, Pressable, StyleSheet, View } from 'react-native';

import { colors } from '../theme';

export function ImageViewerModal({
  images,
  initialIndex,
  visible,
  onClose,
  onDelete,
}: {
  images: readonly Attachment[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
  onDelete?: (index: number) => void;
}) {
  const listRef = useRef<FlatList<Attachment>>(null);
  const { width, height } = Dimensions.get('window');
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    if (!visible) return;
    const safeIndex = Math.min(initialIndex, Math.max(images.length - 1, 0));
    setCurrentIndex(safeIndex);
    const timer = setTimeout(() => listRef.current?.scrollToIndex({ index: safeIndex, animated: false }), 0);
    return () => clearTimeout(timer);
  }, [images.length, initialIndex, visible]);

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.backdrop}>
        <FlatList
          ref={listRef}
          data={images}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          horizontal
          initialScrollIndex={initialIndex}
          keyExtractor={(item) => item.id}
          onMomentumScrollEnd={(event) => setCurrentIndex(Math.round(event.nativeEvent.contentOffset.x / width))}
          pagingEnabled
          renderItem={({ item }) => (
            <View style={{ width, height }}>
              <Image resizeMode="contain" source={{ uri: item.uri }} style={{ width, height }} />
            </View>
          )}
          showsHorizontalScrollIndicator={false}
        />
        <Pressable accessibilityLabel="返回图片预览" hitSlop={12} onPress={onClose} style={[styles.close, onDelete ? styles.back : styles.closeRight]}>
          <Ionicons color={colors.card} name={onDelete ? 'chevron-back' : 'close'} size={27} />
        </Pressable>
        {onDelete ? <Pressable accessibilityLabel="删除当前图片" hitSlop={12} onPress={() => onDelete(currentIndex)} style={styles.delete}>
          <Ionicons color={colors.card} name="trash-outline" size={23} />
        </Pressable> : null}
        {images.length > 1 ? (
          <View accessibilityLabel={`第 ${currentIndex + 1} 张，共 ${images.length} 张`} style={styles.pagination}>
            {images.map((image, index) => (
              <View key={image.id} style={[styles.dot, index === currentIndex && styles.activeDot]} />
            ))}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' },
  close: { position: 'absolute', top: 54, width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  closeRight: { right: 20 },
  back: { left: 20 },
  delete: { position: 'absolute', top: 54, right: 20, width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  pagination: { position: 'absolute', left: 20, right: 20, bottom: 42, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.42)' },
  activeDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.card },
});
