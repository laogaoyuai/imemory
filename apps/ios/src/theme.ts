export const colors = {
  ink: '#171811',
  secondary: '#6F7067',
  muted: '#A3A599',
  paper: '#F6F5EE',
  card: '#FFFFFF',
  line: '#E8E6DB',
  accent: '#E7603C',
  accentSoft: '#FCE9E2',
  sage: '#9CB19A',
  sageSoft: '#E8EFE6',
  blue: '#7292A7',
  blueSoft: '#E7EFF4',
  warning: '#D59A3A',
  shadow: '#202119',
} as const;

export const radius = {
  small: 10,
  medium: 16,
  large: 24,
  pill: 999,
} as const;

export const shadow = {
  shadowColor: colors.shadow,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.07,
  shadowRadius: 18,
  elevation: 3,
} as const;
