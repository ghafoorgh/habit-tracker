import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { HabitRow } from '../../components/HabitRow';
import { Text } from '../../components/Text';
import { todayKey } from '../../lib/dates';
import { isDone } from '../../lib/habits';
import { formatJalali, toPersianDigits } from '../../lib/jalali';
import { useHabits } from '../../lib/store';
import { useTheme } from '../../lib/theme';

export default function TodayScreen() {
  const theme = useTheme();
  const { loaded, habits, toggleDay } = useHabits();
  const today = todayKey();

  if (!loaded) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (habits.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={styles.bigEmoji}>🌱</Text>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>اولین عادتت را بساز</Text>
        <Text style={[styles.emptyText, { color: theme.muted }]}>
          کارهای کوچکِ هر روز، کم‌کم بزرگ می‌شوند. یک عادت اضافه کن و هر روز تیکش را بزن.
        </Text>
        <Pressable
          onPress={() => router.push('/habit/new')}
          style={[styles.button, { backgroundColor: theme.primary }]}
        >
          <Text style={styles.buttonText}>افزودن عادت</Text>
        </Pressable>
      </View>
    );
  }

  const doneCount = habits.filter((h) => isDone(h, today)).length;
  const progress = doneCount / habits.length;
  const dateLabel = formatJalali(new Date());

  return (
    <FlatList
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.list}
      data={habits}
      keyExtractor={(h) => h.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={[styles.date, { color: theme.muted }]}>{dateLabel}</Text>
          <Text style={[styles.summary, { color: theme.text }]}>
            {doneCount === habits.length
              ? 'همهٔ عادت‌های امروز انجام شد 🎉'
              : `${toPersianDigits(doneCount)} از ${toPersianDigits(habits.length)} انجام شد`}
          </Text>
          <View style={[styles.track, { backgroundColor: theme.empty }]}>
            <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: theme.primary }]} />
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <HabitRow habit={item} today={today} onToggle={(day) => toggleDay(item.id, day)} />
      )}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  bigEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: 22, fontWeight: '700' },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 21, marginBottom: 8 },
  button: { paddingHorizontal: 22, paddingVertical: 13, borderRadius: 12 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  list: { padding: 16, paddingBottom: 32 },
  header: { marginBottom: 16, gap: 6 },
  date: { fontSize: 14, fontWeight: '500' },
  summary: { fontSize: 26, fontWeight: '700' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 4 },
  fill: { height: '100%', borderRadius: 4 },
});
