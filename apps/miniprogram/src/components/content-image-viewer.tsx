import type { Attachment } from '@atlas/core';
import { Image, Swiper, SwiperItem, Text, View } from '@tarojs/components';
import { useEffect, useState } from 'react';

import './content-image-viewer.css';

export function ContentImageViewer({
  images,
  initialIndex,
  onClose,
}: {
  images: readonly Attachment[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(Math.min(initialIndex, Math.max(images.length - 1, 0)));

  useEffect(() => {
    setCurrentIndex(Math.min(initialIndex, Math.max(images.length - 1, 0)));
  }, [images.length, initialIndex]);

  return (
    <View className="atlas-image-viewer" onClick={(event) => event.stopPropagation()}>
      <Swiper
        className="atlas-image-viewer__swiper"
        current={currentIndex}
        duration={240}
        displayMultipleItems={1}
        nextMargin="0px"
        onChange={(event) => setCurrentIndex(event.detail.current)}
        previousMargin="0px"
        circular={false}
        skipHiddenItemLayout
      >
        {images.map((image) => (
          <SwiperItem key={image.id}>
            <View className="atlas-image-viewer__slide"><Image mode="aspectFit" showMenuByLongpress={false} src={image.uri} /></View>
          </SwiperItem>
        ))}
      </Swiper>
      <Text className="atlas-image-viewer__close" onClick={onClose}>×</Text>
      {images.length > 1 ? (
        <View className="atlas-image-viewer__pagination">
          {images.map((image, index) => <View className={`atlas-image-viewer__dot ${index === currentIndex ? 'atlas-image-viewer__dot--active' : ''}`} key={image.id} />)}
        </View>
      ) : null}
    </View>
  );
}
