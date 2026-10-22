import * as Haptics from 'expo-haptics';
import { Link } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { lastNDays, toDateKey, weekdayInitial, type DateKey } from '../lib/dates';
import { currentStreak, isDone, type Habit } from '../lib/habits';
import { useTheme } from '../lib/theme';

type Props = {
  habit: Habit;
  today: DateKey;
  onToggle: (day: DateKey) => void;
};

function tapFeedback(done: boolean) {
  if (Platform.OS === 'web') return;
  if (done) {
    Haptics.selectionAsync();
  } else {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
}

export function HabitRow({ habit, today, onToggle }: Props) {
  const theme = useTheme();
  const doneToday = isDone(habit, today);
  const streak = currentStreak(habit);
  const week = lastNDays(7);

  const toggle = (day: DateKey) => {
    tapFeedback(isDone(habit, day));
    onToggle(day);
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.top}>
        <Link href={{ pathname: '/habit/[id]', params: { id: habit.id } }} asChild>
          <Pressable style={styles.info} accessibilityHint="Edit habit">
            <View style={[styles.emoji, { backgroundColor: habit.color + '22' }]}>
              <Text style={styles.emojiText}>{habit.emoji}</Text>
            </View>
            <View style={styles.titles}>
              <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                {habit.name}
              </Text>
              <Text style={[styles.streak, { color: theme.muted }]}>
                {streak > 0 ? `🔥 ${streak} day streak` : 'No streak yet'}
              </Text>
            </View>
          </Pressable>
        </Link>

        <Pressable
          onPress={() => toggle(today)}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: doneToday }}
          accessibilityLabel={`Mark ${habit.name} done today`}
          style={({ pressed }) => [
            styles.check,
            { borderColor: habit.color, backgroundColor: doneToday ? habit.color : 'transparent' },
            pressed && { opacity: 0.7 },
          ]}
        >
          {doneToday && <Text style={styles.checkMark}>✓</Text>}
        </Pressable>
      </View>

      <View style={styles.week}>
        {week.map((date) => {
          const key = toDateKey(date);
          const done = isDone(habit, key);
          const isToday = key === today;
          return (
            <Pressable
              key={key}
              onPress={() => toggle(key)}
              hitSlop={4}
              style={styles.day}
              accessibilityLabel={`${key} ${done ? 'done' : 'not done'}`}
            >
              <Text style={[styles.dayLabel, { color: isToday ? theme.text : theme.muted }]}>
                {weekdayInitial(date)}
              </Text>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: done ? habit.color : theme.empty },
                  isToday && { borderWidth: 2, borderColor: habit.color },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 12,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  info: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  emoji: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 22 },
  titles: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: '600' },
  streak: { fontSize: 13 },
  check: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: '#fff', fontSize: 20, fontWeight: '800' },
  week: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
  day: { alignItems: 'center', gap: 4, minWidth: 28 },
  dayLabel: { fontSize: 11, fontWeight: '600' },
  dot: { width: 22, height: 22, borderRadius: 11 },
});
