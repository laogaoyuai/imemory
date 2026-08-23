import type { Attachment } from '@atlas/core';
import { Image, View } from '@tarojs/components';
import { useState } from 'react';

import { ContentImageViewer } from './content-image-viewer';
import './content-image-grid.css';

export function ContentImageGrid({
  images,
  className = '',
}: {
  images: readonly Attachment[];
  className?: string;
}) {
  const visible = images.filter((attachment) => attachment.kind === 'image').slice(0, 9);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  if (visible.length === 0) return null;
  const columns = visible.length === 1 ? 1 : visible.length <= 4 ? 2 : 3;
  const cellCount = columns === 1 ? 1 : Math.ceil(visible.length / columns) * columns;
  const cells = Array.from({ length: cellCount }, (_, index) => visible[index] ?? null);

  return (
    <View className={`atlas-image-grid atlas-image-grid--${columns} ${className}`.trim()}>
      {cells.map((attachment, index) => {
        if (!attachment) return <View className="atlas-image-grid__cell atlas-image-grid__cell--empty" key={`empty-${index}`} />;
        const image = (
          <Image
            className="atlas-image-grid__image"
            mode={columns === 1 ? 'aspectFit' : 'aspectFill'}
            onClick={(event) => {
              event.stopPropagation();
              setPreviewIndex(index);
            }}
            src={attachment.uri}
            {...(columns === 1 ? { style: singleImageStyle(attachment) } : {})}
          />
        );
        return <View className="atlas-image-grid__cell" key={attachment.id}>{image}</View>;
      })}
      {previewIndex !== null ? <ContentImageViewer images={visible} initialIndex={previewIndex} onClose={() => setPreviewIndex(null)} /> : null}
    </View>
  );
}

function singleImageStyle(attachment: Attachment): { width: string; height: string } {
  const ratio = attachment.width && attachment.height ? attachment.width / attachment.height : 1;
  return ratio >= 1
    ? { width: '100%', height: `${Math.min(100, 100 / ratio)}%` }
    : { width: `${Math.max(1, ratio * 100)}%`, height: '100%' };
}
