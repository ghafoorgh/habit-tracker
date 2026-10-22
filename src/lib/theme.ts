import { useColorScheme } from 'react-native';

const light = {
  background: '#F4F5F7',
  card: '#FFFFFF',
  text: '#111418',
  muted: '#6B7280',
  border: '#E5E7EB',
  empty: '#E9EBEF',
  primary: '#4F46E5',
  danger: '#DC2626',
};

const dark: typeof light = {
  background: '#0B0D10',
  card: '#16191E',
  text: '#F3F4F6',
  muted: '#9CA3AF',
  border: '#262A31',
  empty: '#22262D',
  primary: '#818CF8',
  danger: '#F87171',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const HABIT_COLORS = [
  '#4F46E5',
  '#0EA5E9',
  '#10B981',
  '#84CC16',
  '#F59E0B',
  '#F97316',
  '#EF4444',
  '#EC4899',
  '#A855F7',
  '#64748B',
];

export const HABIT_EMOJIS = [
  '💧', '🏃', '📚', '🧘', '💪', '🥗', '😴', '✍️',
  '🎸', '🧹', '💊', '🚶', '🧠', '🌱', '☀️', '🚭',
  '📵', '🦷', '🙏', '💰',
];
