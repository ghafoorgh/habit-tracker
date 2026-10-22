import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';

import { HabitForm } from '../../components/HabitForm';
import { useHabits } from '../../lib/store';
import { useTheme } from '../../lib/theme';

function confirmDelete(name: string, onConfirm: () => void) {
  const message = `"${name}" and all its history will be removed.`;
  if (Platform.OS === 'web') {
    if (window.confirm(message)) onConfirm();
    return;
  }
  Alert.alert('Delete habit?', message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ]);
}

export default function EditHabitScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { habits, updateHabit, removeHabit } = useHabits();
  const habit = habits.find((h) => h.id === id);

  if (!habit) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.muted }}>This habit no longer exists.</Text>
      </View>
    );
  }

  return (
    <HabitForm
      initial={habit}
      submitLabel="Save changes"
      onSubmit={(values) => {
        updateHabit(habit.id, values);
        router.back();
      }}
      onDelete={() =>
        confirmDelete(habit.name, () => {
          router.back();
          removeHabit(habit.id);
        })
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
