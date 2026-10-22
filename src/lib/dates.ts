// Dates are stored as local-time "YYYY-MM-DD" keys so a completion always
// belongs to the calendar day the user saw on their phone.

export type DateKey = string;

export function toDateKey(date: Date): DateKey {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

export function todayKey(): DateKey {
  return toDateKey(new Date());
}

/** The last `count` days ending at `end` (inclusive), oldest first. */
export function lastNDays(count: number, end: Date = new Date()): Date[] {
  return Array.from({ length: count }, (_, i) => addDays(end, i - count + 1));
}
