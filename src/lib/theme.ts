import { useColorScheme } from 'react-native';

// Turquoise (firouzeh) accent, as on Persian tiles.
const light = {
  background: '#F4F5F7',
  card: '#FFFFFF',
  text: '#111418',
  muted: '#6B7280',
  border: '#E5E7EB',
  empty: '#E9EBEF',
  primary: '#0F9D97',
  danger: '#DC2626',
};

const dark: typeof light = {
  background: '#0B0D10',
  card: '#16191E',
  text: '#F3F4F6',
  muted: '#9CA3AF',
  border: '#262A31',
  empty: '#22262D',
  primary: '#2DD4BF',
  danger: '#F87171',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const HABIT_COLORS = [
  '#0F9D97', // فیروزه‌ای
  '#1C39BB', // آبی ایرانی
  '#F2A900', // زعفرانی
  '#BE123C', // اناری
  '#93C572', // پسته‌ای
  '#F97316', // نارنجی
  '#7C3AED', // بنفش
  '#EC4899', // صورتی
  '#0EA5E9', // آبی آسمانی
  '#64748B', // خاکستری
];

export const HABIT_EMOJIS = [
  '💧', '🏃', '📚', '🧘', '💪', '🥗',
  '😴', '✍️', '📿', '🕌', '📖', '🫖',
  '🧹', '💊', '🚶', '🧠', '🌱', '☀️',
  '🚭', '📵', '🦷', '🙏', '💰', '🎵',
];
