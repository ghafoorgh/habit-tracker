// Gregorian → Jalali (Solar Hijri) conversion, adapted from the jalaali-js
// algorithm (Borkowski). Intl's Persian calendar isn't reliable under Hermes,
// so the conversion is done by hand.

export type JalaliDate = { jy: number; jm: number; jd: number };

const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394,
  2456, 3178,
];

const div = (a: number, b: number) => ~~(a / b);
const mod = (a: number, b: number) => a - ~~(a / b) * b;

/** Leap status of Jalali year `jy` and the March day Nowruz falls on. */
function jalCal(jy: number): { leap: number; march: number } {
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0];
  let jump = 0;
  for (let i = 1; i < BREAKS.length; i++) {
    const jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, march };
}

/** Julian day number of a Gregorian date. */
function g2d(gy: number, gm: number, gd: number): number {
  const d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  return d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
}

export function toJalali(date: Date): JalaliDate {
  const gy = date.getFullYear();
  const jdn = g2d(gy, date.getMonth() + 1, date.getDate());
  let jy = gy - 621;
  const { leap, march } = jalCal(jy);
  let k = jdn - g2d(gy, 3, march);
  if (k >= 0) {
    if (k <= 185) return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (leap === 1) k += 1;
  }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

export const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

// Indexed by Date.getDay(), so Sunday first.
export const PERSIAN_WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
const WEEKDAY_INITIALS = ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش'];

export function persianWeekdayInitial(date: Date): string {
  return WEEKDAY_INITIALS[date.getDay()];
}

/** Days since the most recent Saturday, the first day of the Iranian week. */
export function daysSinceSaturday(date: Date): number {
  return (date.getDay() + 1) % 7;
}

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function toPersianDigits(value: number | string): string {
  return String(value).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

/** e.g. "پنجشنبه ۳۰ مهر ۱۴۰۵" */
export function formatJalali(date: Date, { weekday = true } = {}): string {
  const { jy, jm, jd } = toJalali(date);
  const day = `${toPersianDigits(jd)} ${JALALI_MONTHS[jm - 1]} ${toPersianDigits(jy)}`;
  return weekday ? `${PERSIAN_WEEKDAYS[date.getDay()]} ${day}` : day;
}
