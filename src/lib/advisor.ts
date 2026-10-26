import { addDays, lastNDays, toDateKey } from './dates.ts';
import { bestStreak, completionRate, currentStreak, isDone, type Habit } from './habits.ts';

export type ChatRole = 'user' | 'assistant';
export type ChatMessage = { role: ChatRole; content: string };

/** Limits shared by the app and the /api/advisor route. */
export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_HISTORY = 20;
export const MAX_CONTEXT_LENGTH = 6000;

/**
 * A compact, plain-text picture of the user's habits for the model, so its
 * advice is about their real streaks rather than generic tips.
 */
export function habitsSummary(habits: Habit[], today: Date = new Date()): string {
  if (habits.length === 0) return 'The user has not added any habits yet.';

  const week = lastNDays(7, today).map(toDateKey);
  const lines = habits.map((h) => {
    const pattern = week.map((key) => (key < h.createdAt ? '-' : isDone(h, key) ? '✓' : '✗')).join('');
    return [
      `- ${h.emoji} ${h.name}`,
      `done today: ${isDone(h, toDateKey(today)) ? 'yes' : 'no'}`,
      `current streak: ${currentStreak(h, today)} days`,
      `best streak: ${bestStreak(h)} days`,
      `last 30 days: ${Math.round(completionRate(h, 30, today) * 100)}%`,
      `last 7 days (oldest→today): ${pattern}`,
      `tracking since: ${h.createdAt}`,
    ].join(' | ');
  });

  return [`Today is ${toDateKey(today)} (yesterday ${toDateKey(addDays(today, -1))}).`, ...lines]
    .join('\n')
    .slice(0, MAX_CONTEXT_LENGTH);
}

/** Validates an untrusted request body; returns null if it is malformed. */
export function parseAdvisorRequest(body: unknown): { messages: ChatMessage[]; context: string } | null {
  if (typeof body !== 'object' || body === null) return null;
  const { messages, context } = body as { messages?: unknown; context?: unknown };
  if (!Array.isArray(messages) || messages.length === 0) return null;

  const parsed: ChatMessage[] = [];
  for (const m of messages.slice(-MAX_HISTORY)) {
    if (typeof m !== 'object' || m === null) return null;
    const { role, content } = m as { role?: unknown; content?: unknown };
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string' || !content.trim()) return null;
    parsed.push({ role, content: content.slice(0, MAX_MESSAGE_LENGTH) });
  }
  if (parsed[parsed.length - 1].role !== 'user') return null;

  return { messages: parsed, context: typeof context === 'string' ? context.slice(0, MAX_CONTEXT_LENGTH) : '' };
}

/** Thrown when the server rejects the access code, so the app can ask for it again. */
export class AdvisorAccessError extends Error {}

/**
 * Checks an `Authorization: Bearer <code>` header against the server's access
 * code. Compares every character so the response time doesn't leak how much
 * of a guess was right.
 */
export function isAuthorized(header: string | null, expected: string): boolean {
  const given = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (!expected || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/**
 * Calls the app's own /api/advisor route, which holds the OpenAI key on the
 * server. In development the dev server serves it; for release builds set
 * EXPO_PUBLIC_API_URL to the deployed origin (e.g. https://my-app.expo.app).
 */
export async function askAdvisor(messages: ChatMessage[], habits: Habit[], accessCode: string): Promise<string> {
  const base = process.env.EXPO_PUBLIC_API_URL ?? '';
  const res = await fetch(`${base}/api/advisor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessCode}` },
    body: JSON.stringify({ messages: messages.slice(-MAX_HISTORY), context: habitsSummary(habits) }),
  });
  const data = (await res.json().catch(() => null)) as { reply?: string; error?: string } | null;
  if (res.status === 401) throw new AdvisorAccessError(data?.error ?? 'کد دسترسی نادرست است.');
  if (!res.ok || !data?.reply) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data.reply;
}
