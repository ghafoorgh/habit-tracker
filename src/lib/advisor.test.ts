/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { habitsSummary, MAX_HISTORY, MAX_MESSAGE_LENGTH, parseAdvisorRequest } from './advisor.ts';
import { addDays, toDateKey } from './dates.ts';
import type { Habit } from './habits.ts';

const today = new Date(2026, 2, 10); // 10 March 2026

const habit: Habit = {
  id: 'h1',
  name: 'Read',
  emoji: '📚',
  color: '#000',
  createdAt: toDateKey(addDays(today, -3)),
  completions: Object.fromEntries([-2, -1, 0].map((o) => [toDateKey(addDays(today, o)), true as const])),
};

test('habitsSummary describes streaks and the last week', () => {
  const summary = habitsSummary([habit], today);
  assert.match(summary, /Today is 2026-03-10/);
  assert.match(summary, /📚 Read/);
  assert.match(summary, /done today: yes/);
  assert.match(summary, /current streak: 3 days/);
  assert.match(summary, /last 7 days \(oldest→today\): ---✗✓✓✓/);
});

test('habitsSummary handles no habits', () => {
  assert.equal(habitsSummary([], today), 'The user has not added any habits yet.');
});

test('parseAdvisorRequest accepts a valid conversation and trims it', () => {
  const messages = Array.from({ length: MAX_HISTORY + 5 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: 'x'.repeat(MAX_MESSAGE_LENGTH + 10),
  }));
  const parsed = parseAdvisorRequest({ messages, context: 'ctx' });
  assert.ok(parsed);
  assert.equal(parsed.messages.length, MAX_HISTORY);
  assert.equal(parsed.messages[0].content.length, MAX_MESSAGE_LENGTH);
  assert.equal(parsed.context, 'ctx');
});

test('parseAdvisorRequest rejects malformed bodies', () => {
  assert.equal(parseAdvisorRequest(null), null);
  assert.equal(parseAdvisorRequest({ messages: [] }), null);
  assert.equal(parseAdvisorRequest({ messages: [{ role: 'system', content: 'hi' }] }), null);
  assert.equal(parseAdvisorRequest({ messages: [{ role: 'user', content: '  ' }] }), null);
  assert.equal(parseAdvisorRequest({ messages: [{ role: 'assistant', content: 'hi' }] }), null);
});
