import { StyleSheet, Text, View, type ColorValue } from 'react-native';

// Small hand-drawn tab icons so the app needs no icon font.

export function TodayIcon({ color }: { color: ColorValue }) {
  return (
    <View style={[styles.circle, { borderColor: color }]}>
      <Text style={[styles.check, { color }]}>✓</Text>
    </View>
  );
}

export function StatsIcon({ color }: { color: ColorValue }) {
  return (
    <View style={styles.bars}>
      {[10, 18, 14].map((height, i) => (
        <View key={i} style={[styles.bar, { height, backgroundColor: color }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: { fontSize: 13, fontWeight: '800', lineHeight: 16 },
  bars: { width: 24, height: 24, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 3 },
  bar: { width: 5, borderRadius: 2 },
});
