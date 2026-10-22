import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';

import { todayKey, type DateKey } from './dates';
import { toggleCompletion, type Habit } from './habits';

const STORAGE_KEY = 'habit-tracker/habits/v1';

type State = { loaded: boolean; habits: Habit[] };

type Action =
  | { type: 'load'; habits: Habit[] }
  | { type: 'add'; habit: Habit }
  | { type: 'update'; id: string; changes: Pick<Habit, 'name' | 'emoji' | 'color'> }
  | { type: 'remove'; id: string }
  | { type: 'toggle'; id: string; day: DateKey };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'load':
      return { loaded: true, habits: action.habits };
    case 'add':
      return { ...state, habits: [...state.habits, action.habit] };
    case 'update':
      return {
        ...state,
        habits: state.habits.map((h) => (h.id === action.id ? { ...h, ...action.changes } : h)),
      };
    case 'remove':
      return { ...state, habits: state.habits.filter((h) => h.id !== action.id) };
    case 'toggle':
      return {
        ...state,
        habits: state.habits.map((h) => (h.id === action.id ? toggleCompletion(h, action.day) : h)),
      };
  }
}

type HabitsContextValue = State & {
  addHabit: (input: Pick<Habit, 'name' | 'emoji' | 'color'>) => void;
  updateHabit: (id: string, changes: Pick<Habit, 'name' | 'emoji' | 'color'>) => void;
  removeHabit: (id: string) => void;
  toggleDay: (id: string, day: DateKey) => void;
};

const HabitsContext = createContext<HabitsContextValue | null>(null);

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function HabitsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { loaded: false, habits: [] });

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => dispatch({ type: 'load', habits: raw ? (JSON.parse(raw) as Habit[]) : [] }))
      .catch(() => dispatch({ type: 'load', habits: [] }));
  }, []);

  useEffect(() => {
    // Don't overwrite saved data with the empty initial state before it loads.
    if (!state.loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state.habits)).catch(() => {});
  }, [state]);

  const value = useMemo<HabitsContextValue>(
    () => ({
      ...state,
      addHabit: (input) =>
        dispatch({
          type: 'add',
          habit: { ...input, id: newId(), createdAt: todayKey(), completions: {} },
        }),
      updateHabit: (id, changes) => dispatch({ type: 'update', id, changes }),
      removeHabit: (id) => dispatch({ type: 'remove', id }),
      toggleDay: (id, day) => dispatch({ type: 'toggle', id, day }),
    }),
    [state],
  );

  return <HabitsContext.Provider value={value}>{children}</HabitsContext.Provider>;
}

export function useHabits(): HabitsContextValue {
  const ctx = useContext(HabitsContext);
  if (!ctx) throw new Error('useHabits must be used inside <HabitsProvider>');
  return ctx;
}
