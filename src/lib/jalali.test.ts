/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { addDays } from './dates.ts';
import { daysSinceSaturday, formatJalali, toJalali, toPersianDigits } from './jalali.ts';

test('Nowruz falls on 1 Farvardin', () => {
  assert.deepEqual(toJalali(new Date(2025, 2, 21)), { jy: 1404, jm: 1, jd: 1 });
  assert.deepEqual(toJalali(new Date(2026, 2, 21)), { jy: 1405, jm: 1, jd: 1 });
  assert.deepEqual(toJalali(new Date(2024, 2, 20)), { jy: 1403, jm: 1, jd: 1 });
});

test('last day of a leap year is 30 Esfand', () => {
  assert.deepEqual(toJalali(new Date(2025, 2, 20)), { jy: 1403, jm: 12, jd: 30 });
});

test('months 1-6 have 31 days and 7-11 have 30', () => {
  assert.deepEqual(toJalali(new Date(2026, 8, 22)), { jy: 1405, jm: 6, jd: 31 });
  assert.deepEqual(toJalali(new Date(2026, 8, 23)), { jy: 1405, jm: 7, jd: 1 });
  assert.deepEqual(toJalali(new Date(2026, 9, 22)), { jy: 1405, jm: 7, jd: 30 });
});

test('dates before Nowruz belong to the previous Jalali year', () => {
  assert.deepEqual(toJalali(new Date(2026, 0, 1)), { jy: 1404, jm: 10, jd: 11 });
});

test('every day advances the Jalali date by exactly one', () => {
  let prev = toJalali(new Date(2020, 0, 1));
  for (let i = 1; i < 365 * 8; i++) {
    const cur = toJalali(addDays(new Date(2020, 0, 1), i));
    const sameMonth = cur.jy === prev.jy && cur.jm === prev.jm && cur.jd === prev.jd + 1;
    const nextMonth = cur.jy === prev.jy && cur.jm === prev.jm + 1 && cur.jd === 1;
    const nextYear = cur.jy === prev.jy + 1 && cur.jm === 1 && cur.jd === 1 && prev.jm === 12;
    assert.ok(sameMonth || nextMonth || nextYear, `${JSON.stringify(prev)} -> ${JSON.stringify(cur)}`);
    prev = cur;
  }
});

test('formats with Persian digits and names', () => {
  assert.equal(toPersianDigits('12 / 30%'), '۱۲ / ۳۰%');
  assert.equal(formatJalali(new Date(2026, 9, 22)), 'پنجشنبه ۳۰ مهر ۱۴۰۵');
  assert.equal(formatJalali(new Date(2026, 9, 22), { weekday: false }), '۳۰ مهر ۱۴۰۵');
});

test('the Iranian week starts on Saturday', () => {
  assert.equal(daysSinceSaturday(new Date(2026, 9, 17)), 0); // Saturday
  assert.equal(daysSinceSaturday(new Date(2026, 9, 23)), 6); // Friday
});
