import { router } from 'expo-router';

import { HabitForm } from '../../components/HabitForm';
import { useHabits } from '../../lib/store';

export default function NewHabitScreen() {
  const { addHabit } = useHabits();

  return (
    <HabitForm
      submitLabel="Add habit"
      onSubmit={(values) => {
        addHabit(values);
        router.back();
      }}
    />
  );
}
