import { StyleSheet, View } from 'react-native';

import { addDays, toDateKey } from '../lib/dates';
import { isDone, type Habit } from '../lib/habits';
import { useTheme } from '../lib/theme';

const WEEKS = 15;

/** GitHub-style grid: one column per week, Sunday on top, ending this week. */
export function Heatmap({ habit }: { habit: Habit }) {
  const theme = useTheme();
  const today = new Date();
  const todayKey = toDateKey(today);
  const firstSunday = addDays(today, -today.getDay() - (WEEKS - 1) * 7);

  return (
    <View style={styles.grid}>
      {Array.from({ length: WEEKS }, (_, week) => (
        <View key={week} style={styles.column}>
          {Array.from({ length: 7 }, (_, weekday) => {
            const key = toDateKey(addDays(firstSunday, week * 7 + weekday));
            const future = key > todayKey;
            return (
              <View
                key={weekday}
                style={[
                  styles.cell,
                  { backgroundColor: isDone(habit, key) ? habit.color : theme.empty },
                  future && styles.future,
                ]}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: 3 },
  column: { flex: 1, gap: 3 },
  cell: { aspectRatio: 1, borderRadius: 3 },
  future: { opacity: 0 },
});
