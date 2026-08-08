/**
 * Local Ionicons adapter.
 *
 * The font and glyph map are bundled under src/assets/icons. The local font
 * is loaded on first use and cached by expo-font. A small text fallback keeps
 * controls visible while the font is loading (or if a dev build cannot load
 * the font yet).
 */
import * as Font from 'expo-font';
import { useEffect, useState } from 'react';
import { Text, type TextProps } from 'react-native';

import glyphMap from '../assets/icons/Ionicons.json';
import font from '../assets/icons/Ionicons.ttf';

const FONT_FAMILY = 'atlas-ionicons';
const fallbackSymbols: Record<string, string> = {
  add: '+', 'add-circle': '⊕', 'arrow-redo-outline': '↗', 'arrow-up': '↑', 'chatbubble-outline': '◌',
  'chevron-back': '‹', 'chevron-forward': '›', close: '×', 'close-circle': '⊗', create: '✎',
  'create-outline': '✎', 'document-attach-outline': '▣', 'document-text-outline': '▤',
  'eye-outline': '◉', 'git-branch-outline': '⑂', heart: '♥', 'heart-outline': '♡',
  images: '▧', 'images-outline': '▧', location: '⌖', 'location-outline': '⌖', lock: '🔒',
  menu: '☰', people: '♟', 'people-outline': '♟', person: '●', 'person-add-outline': '♙',
  'play-circle-outline': '▶', search: '⌕', settings: '⚙', share: '↗', star: '★', 'star-outline': '☆',
  trash: '⌫', 'trash-outline': '⌫', 'time-outline': '◷', videocam: '▣', 'videocam-outline': '▣',
  volume: '♪', 'volume-high-outline': '♪', checkmark: '✓', 'checkmark-circle': '✓',
  'headset-outline': '◉', headset: '◉', 'mic-outline': '♪', 'stop-circle-outline': '■', stop: '■',
  'information-circle-outline': 'ⓘ', 'shield-checkmark-outline': '✓', 'bookmark-outline': '☆',
};

let fontLoad: Promise<void> | null = null;

function ensureFontLoaded(): Promise<void> {
  if (!fontLoad) fontLoad = Font.loadAsync({ [FONT_FAMILY]: font }).catch(() => undefined);
  return fontLoad;
}

type IconProps = TextProps & { name: string; size?: number; color?: string };

function Icon({ name, size = 24, color = '#1f2933', style, ...props }: IconProps) {
  const [fontReady, setFontReady] = useState(() => Font.isLoaded(FONT_FAMILY));

  useEffect(() => {
    if (fontReady) return;
    let active = true;
    void ensureFontLoaded().then(() => {
      if (active) setFontReady(Font.isLoaded(FONT_FAMILY));
    });
    return () => { active = false; };
  }, [fontReady]);

  const codePoint = (glyphMap as Record<string, number>)[name];
  const symbol = fontReady && typeof codePoint === 'number' ? String.fromCodePoint(codePoint) : (fallbackSymbols[name] ?? '•');
  return <Text {...props} style={[{ color, fontSize: size, lineHeight: size + 2, textAlign: 'center' }, style, fontReady && { fontFamily: FONT_FAMILY }]}>{symbol}</Text>;
}

export const Ionicons = Object.assign(Icon, { glyphMap });
