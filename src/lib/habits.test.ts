/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { addDays, lastNDays, toDateKey } from './dates.ts';
import { bestStreak, completionRate, currentStreak, toggleCompletion, type Habit } from './habits.ts';

const today = new Date(2026, 2, 10); // 10 March 2026

function habitDoneOn(offsets: number[], createdOffset = -60): Habit {
  return {
    id: 'h1',
    name: 'Read',
    emoji: '📚',
    color: '#000',
    createdAt: toDateKey(addDays(today, createdOffset)),
    completions: Object.fromEntries(offsets.map((o) => [toDateKey(addDays(today, o)), true as const])),
  };
}

test('toDateKey pads and uses local time', () => {
  assert.equal(toDateKey(new Date(2026, 0, 5)), '2026-01-05');
});

test('addDays crosses month boundaries', () => {
  assert.equal(toDateKey(addDays(new Date(2026, 1, 28), 1)), '2026-03-01');
});

test('lastNDays returns oldest first, ending today', () => {
  const days = lastNDays(3, today).map(toDateKey);
  assert.deepEqual(days, ['2026-03-08', '2026-03-09', '2026-03-10']);
});

test('toggleCompletion adds and removes a day without mutating', () => {
  const habit = habitDoneOn([]);
  const done = toggleCompletion(habit, '2026-03-10');
  assert.equal(done.completions['2026-03-10'], true);
  assert.deepEqual(habit.completions, {});
  assert.deepEqual(toggleCompletion(done, '2026-03-10').completions, {});
});

test('currentStreak counts back from today', () => {
  assert.equal(currentStreak(habitDoneOn([0, -1, -2, -4]), today), 3);
});

test('currentStreak keeps yesterday’s streak while today is pending', () => {
  assert.equal(currentStreak(habitDoneOn([-1, -2]), today), 2);
});

test('currentStreak is zero after a missed day', () => {
  assert.equal(currentStreak(habitDoneOn([-2, -3]), today), 0);
});

test('bestStreak finds the longest run', () => {
  assert.equal(bestStreak(habitDoneOn([0, -5, -6, -7, -8, -10, -11])), 4);
  assert.equal(bestStreak(habitDoneOn([])), 0);
});

test('completionRate only counts days since creation', () => {
  const habit = habitDoneOn([0, -1], -3); // 4 days old, 2 done
  assert.equal(completionRate(habit, 30, today), 0.5);
});
