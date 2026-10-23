import { config } from './config.js';

const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC = '٠١٢٣٤٥٦٧٨٩';

// Normalises "0912 345 6789", "+98912...", "۰۹۱۲..." to "98912...". Returns null if unusable.
export function normalizePhone(raw, cc = config.defaultCountryCode) {
  if (raw === undefined || raw === null) return null;
  let s = String(raw).replace(/[۰-۹]/g, (d) => PERSIAN.indexOf(d)).replace(/[٠-٩]/g, (d) => ARABIC.indexOf(d));
  s = s.replace(/\D/g, '');
  if (!s) return null;
  if (s.startsWith('00')) s = s.slice(2);
  else if (s.startsWith('0')) s = cc + s.slice(1);
  else if (!s.startsWith(cc) && s.length <= 10) s = cc + s;
  return s.length >= 10 && s.length <= 15 ? s : null;
}
