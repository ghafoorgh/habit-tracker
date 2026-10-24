// Import contacts from Excel/CSV:  npm run import -- ./data/contacts.xlsx
import XLSX from 'xlsx';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Contacts, db } from './db.js';
import { normalizePhone } from './phone.js';

// Accepted column headers (Persian or English) for each field.
const COLUMNS = {
  name: ['name', 'نام', 'نام و نام خانوادگی', 'مالک', 'نام مالک', 'full name'],
  phone: ['phone', 'mobile', 'شماره', 'موبایل', 'تلفن', 'شماره تماس', 'شماره موبایل', 'whatsapp', 'واتساپ'],
  address: ['address', 'آدرس', 'نشانی', 'محل', 'منطقه', 'location'],
  property_type: ['type', 'property type', 'نوع ملک', 'نوع', 'ملک'],
  notes: ['notes', 'note', 'توضیحات', 'یادداشت'],
};

const clean = (h) => String(h).trim().toLowerCase().replace(/\s+/g, ' ');

function mapRow(row) {
  const out = {};
  const keys = Object.keys(row);
  for (const [field, aliases] of Object.entries(COLUMNS)) {
    const key = keys.find((k) => aliases.includes(clean(k)));
    const v = key === undefined ? null : String(row[key]).trim();
    out[field] = v || null;
  }
  return out;
}

export const importFile = (filePath) => importBuffer(fs.readFileSync(filePath));

export function importBuffer(buf) {
  // .xlsx is a zip ("PK"), .xls is an OLE file (D0 CF); anything else is CSV text, read as UTF-8 so Persian survives.
  const binary = (buf[0] === 0x50 && buf[1] === 0x4b) || (buf[0] === 0xd0 && buf[1] === 0xcf);
  const wb = binary
    ? XLSX.read(buf, { type: 'buffer', raw: false })
    : XLSX.read(buf.toString('utf8').replace(/^\uFEFF/, ''), { type: 'string', raw: false });
  return importWorkbook(wb);
}

function importWorkbook(wb) {
  // The cleaned owner file has a ready-made "Contacts for Agent" sheet; otherwise use the first sheet.
  const sheet = wb.SheetNames.find((n) => n.trim().toLowerCase() === 'contacts for agent') || wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: '', raw: false });
  const result = { total: rows.length, created: 0, updated: 0, skipped: [] };

  db.transaction(() => {
    rows.forEach((row, i) => {
      const c = mapRow(row);
      c.phone = normalizePhone(c.phone);
      if (!c.phone) {
        result.skipped.push({ row: i + 2, reason: 'شماره نامعتبر یا خالی' });
        return;
      }
      const r = Contacts.upsertFromImport(c);
      r.created ? result.created++ : result.updated++;
    });
  })();
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: npm run import -- <file.xlsx|file.csv>');
    process.exit(1);
  }
  const r = importFile(file);
  console.log(`کل ردیف‌ها: ${r.total} | جدید: ${r.created} | به‌روزرسانی: ${r.updated} | ردشده: ${r.skipped.length}`);
  for (const s of r.skipped) console.log(`  ردیف ${s.row}: ${s.reason}`);
}
