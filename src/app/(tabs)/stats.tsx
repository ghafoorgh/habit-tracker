import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Heatmap } from '../../components/Heatmap';
import { bestStreak, completionRate, currentStreak, totalCompletions } from '../../lib/habits';
import { useHabits } from '../../lib/store';
import { useTheme } from '../../lib/theme';

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
          Add a habit to see your streaks and history here.
        </Text>
      </View>
    );
  }

  const totalCheckIns = habits.reduce((sum, h) => sum + totalCompletions(h), 0);
  const longest = Math.max(...habits.map(bestStreak));

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <View style={[styles.card, styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Stat label="Habits" value={String(habits.length)} />
        <Stat label="Check-ins" value={String(totalCheckIns)} />
        <Stat label="Longest streak" value={`${longest}d`} />
      </View>

      {habits.map((habit) => (
        <View key={habit.id} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {habit.emoji} {habit.name}
          </Text>
          <View style={styles.row}>
            <Stat label="Current" value={`${currentStreak(habit)}d`} />
            <Stat label="Best" value={`${bestStreak(habit)}d`} />
            <Stat label="Last 30 days" value={`${Math.round(completionRate(habit, 30) * 100)}%`} />
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
