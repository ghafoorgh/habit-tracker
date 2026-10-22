import { addDays, fromDateKey, lastNDays, toDateKey, type DateKey } from './dates.ts';

export type Habit = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  createdAt: DateKey;
  /** Set of completed days, keyed by DateKey. */
  completions: Record<DateKey, true>;
};

export function isDone(habit: Habit, key: DateKey): boolean {
  return habit.completions[key] === true;
}

export function toggleCompletion(habit: Habit, key: DateKey): Habit {
  const completions = { ...habit.completions };
  if (completions[key]) {
    delete completions[key];
  } else {
    completions[key] = true;
  }
  return { ...habit, completions };
}

/**
 * Consecutive completed days ending today. If today isn't done yet the
 * streak still counts from yesterday, so it doesn't reset until the day ends.
 */
export function currentStreak(habit: Habit, today: Date = new Date()): number {
  let day = isDone(habit, toDateKey(today)) ? today : addDays(today, -1);
  let streak = 0;
  while (isDone(habit, toDateKey(day))) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

export function bestStreak(habit: Habit): number {
  const days = Object.keys(habit.completions).sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const key of days) {
    const date = fromDateKey(key);
    run = prev && toDateKey(addDays(prev, 1)) === key ? run + 1 : 1;
    best = Math.max(best, run);
    prev = date;
  }
  return best;
}

/**
 * Share of the last `days` days that were completed, counting only days
 * since the habit was created. Returns a value between 0 and 1.
 */
export function completionRate(habit: Habit, days: number, today: Date = new Date()): number {
  const window = lastNDays(days, today).map(toDateKey).filter((key) => key >= habit.createdAt);
  if (window.length === 0) return 0;
  return window.filter((key) => isDone(habit, key)).length / window.length;
}

export function totalCompletions(habit: Habit): number {
  return Object.keys(habit.completions).length;
}
