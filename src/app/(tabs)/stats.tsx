import { ScrollView, StyleSheet, View } from 'react-native';

import { Heatmap } from '../../components/Heatmap';
import { Text } from '../../components/Text';
import { bestStreak, completionRate, currentStreak, totalCompletions } from '../../lib/habits';
import { toPersianDigits } from '../../lib/jalali';
import { useHabits } from '../../lib/store';
import { useTheme } from '../../lib/theme';

const days = (n: number) => `${toPersianDigits(n)} روز`;

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

export default function StatsScreen() {
  const theme = useTheme();
  const { habits } = useHabits();

  if (habits.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.emptyText, { color: theme.muted }]}>
          یک عادت اضافه کن تا زنجیره‌ها و سابقه‌ات را اینجا ببینی.
        </Text>
      </View>
    );
  }

  const totalCheckIns = habits.reduce((sum, h) => sum + totalCompletions(h), 0);
  const longest = Math.max(...habits.map(bestStreak));

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <View style={[styles.card, styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Stat label="عادت" value={toPersianDigits(habits.length)} />
        <Stat label="بار انجام" value={toPersianDigits(totalCheckIns)} />
        <Stat label="بلندترین زنجیره" value={days(longest)} />
      </View>

      {habits.map((habit) => (
        <View key={habit.id} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {habit.emoji} {habit.name}
          </Text>
          <View style={styles.row}>
            <Stat label="زنجیرهٔ فعلی" value={days(currentStreak(habit))} />
            <Stat label="بهترین" value={days(bestStreak(habit))} />
            <Stat label="۳۰ روز اخیر" value={`${toPersianDigits(Math.round(completionRate(habit, 30) * 100))}٪`} />
          </View>
          <Heatmap habit={habit} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 15, textAlign: 'center' },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 14 },
  row: { flexDirection: 'row' },
  title: { fontSize: 17, fontWeight: '600' },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 12 },
});
