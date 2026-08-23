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
  const columns = visible.length === 1 ? 1 : visible.length === 2 || visible.length === 4 ? 2 : 3;
  const cellCount = columns === 1 ? 1 : Math.ceil(visible.length / columns) * columns;
  const cells = Array.from({ length: cellCount }, (_, index) => visible[index] ?? null);

  return (
    <View className={`atlas-image-grid atlas-image-grid--${columns} ${className}`.trim()}>
      {cells.map((attachment, index) => {
        if (!attachment) return <View className="atlas-image-grid__cell atlas-image-grid__cell--empty" key={`empty-${index}`} />;
        const singleImage = columns === 1;
        const image = (
          <Image
            className={`atlas-image-grid__image${singleImage ? ' atlas-image-grid__image--single' : ''}`}
            key={attachment.id}
            mode={singleImage ? 'widthFix' : 'aspectFill'}
            onClick={(event) => {
              event.stopPropagation();
              setPreviewIndex(index);
            }}
            src={attachment.uri}
            {...(singleImage ? { style: singleImageStyle(attachment) } : {})}
          />
        );
        if (singleImage) return image;
        return <View className="atlas-image-grid__cell" key={attachment.id}>{image}</View>;
      })}
      {previewIndex !== null ? <ContentImageViewer images={visible} initialIndex={previewIndex} onClose={() => setPreviewIndex(null)} /> : null}
    </View>
  );
}

function singleImageStyle(attachment: Attachment): { width: string; height: 'auto' } {
  const ratio = attachment.width && attachment.height ? attachment.width / attachment.height : 1;
  const maxWidth = 100;
  // Two rows of three-column cells are slightly shorter than 2/3 of the
  // content width because the grid gap is included between the rows.
  const maxHeight = 66;

  // A nine-image grid is three columns wide. A six-image grid is two rows
  // high, so a single image must fit inside that 3-column by 2-row frame.
  // widthFix then derives the actual height without adding a placeholder area.
  return {
    width: `${ratio >= maxWidth / maxHeight ? maxWidth : Math.max(1, maxHeight * ratio)}%`,
    height: 'auto',
  };
}
