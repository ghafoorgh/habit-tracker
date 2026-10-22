import { StyleSheet, Text as RNText, type TextProps, type TextStyle } from 'react-native';

// Custom fonts on Android ignore fontWeight, so each weight maps to its own
// Vazirmatn family. Use this instead of react-native's Text everywhere.
export const FONT_FAMILY: Record<string, string> = {
  '400': 'Vazirmatn_400Regular',
  '500': 'Vazirmatn_500Medium',
  '600': 'Vazirmatn_600SemiBold',
  '700': 'Vazirmatn_700Bold',
  '800': 'Vazirmatn_800ExtraBold',
};

export function fontFor(weight: TextStyle['fontWeight'] = '400'): string {
  const key = weight === 'bold' ? '700' : weight === 'normal' ? '400' : String(weight);
  return FONT_FAMILY[key] ?? FONT_FAMILY['400'];
}

export function Text({ style, ...props }: TextProps) {
  const fontFamily = fontFor(StyleSheet.flatten(style)?.fontWeight);
  return <RNText {...props} style={[style, { fontFamily, fontWeight: 'normal' }]} />;
}
