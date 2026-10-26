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

export function AdvisorIcon({ color }: { color: ColorValue }) {
  return (
    <View style={styles.advisor}>
      <View style={[styles.bubble, { borderColor: color }]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.dot, { backgroundColor: color }]} />
        ))}
      </View>
      <View style={[styles.tail, { borderTopColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  advisor: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  bubble: {
    width: 22,
    height: 16,
    borderRadius: 6,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dot: { width: 3, height: 3, borderRadius: 1.5 },
  tail: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
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
