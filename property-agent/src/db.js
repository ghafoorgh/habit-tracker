import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

fs.mkdirSync(path.dirname(path.resolve(config.dbPath)), { recursive: true });
export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS contacts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT,
  phone         TEXT UNIQUE,          -- digits only, with country code (e.g. 98912...)
  instagram_id  TEXT UNIQUE,          -- Instagram-scoped user id (IGSID)
  instagram_username TEXT,
  address       TEXT,
  property_type TEXT,
  notes         TEXT,
  -- new | drafted | contacted | replied | for_sale | for_rent | not_interested | opted_out | needs_human
  status        TEXT NOT NULL DEFAULT 'new',
  ai_summary    TEXT,                 -- details the agent extracted (price, size, ...)
  ai_paused     INTEGER NOT NULL DEFAULT 0,  -- 1 = you took over, agent stops drafting
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id  INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  channel     TEXT NOT NULL,          -- whatsapp | instagram
  direction   TEXT NOT NULL,          -- in | out
  kind        TEXT NOT NULL DEFAULT 'reply', -- outreach | reply | manual
  body        TEXT NOT NULL,
  -- in: received | out: pending | approved | sending | sent | rejected | failed
  status      TEXT NOT NULL,
  error       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages(contact_id, id);
CREATE INDEX IF NOT EXISTS idx_messages_status  ON messages(status);
`);

db.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);

export const Settings = {
  get: (key, fallback = null) => db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? fallback,
  set: (key, value) => db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(key, String(value)),
};

// Columns added after the first release.
const messageCols = db.prepare('PRAGMA table_info(messages)').all().map((c) => c.name);
// options: JSON {question, choices:[{title, intent?}]} sent as a WhatsApp poll / Instagram quick replies
if (!messageCols.includes('options')) db.exec('ALTER TABLE messages ADD COLUMN options TEXT');
// alternatives: JSON array of other wordings the AI suggested, for you to pick from in the panel
if (!messageCols.includes('alternatives')) db.exec('ALTER TABLE messages ADD COLUMN alternatives TEXT');

export const STATUSES = {
  new: 'جدید',
  drafted: 'پیش‌نویس آماده',
  contacted: 'پیام ارسال شد',
  replied: 'پاسخ داده',
  for_sale: 'فروش',
  for_rent: 'اجاره',
  not_interested: 'تمایل ندارد',
  opted_out: 'لغو دریافت پیام',
  needs_human: 'نیاز به شما',
};

export const Contacts = {
  get: (id) => db.prepare('SELECT * FROM contacts WHERE id = ?').get(id),
  byPhone: (phone) => db.prepare('SELECT * FROM contacts WHERE phone = ?').get(phone),
  byInstagram: (igId) => db.prepare('SELECT * FROM contacts WHERE instagram_id = ?').get(igId),

  upsertFromImport(c) {
    const existing = this.byPhone(c.phone);
    if (existing) {
      db.prepare(`UPDATE contacts SET
          name = COALESCE(@name, name), address = COALESCE(@address, address),
          property_type = COALESCE(@property_type, property_type), notes = COALESCE(@notes, notes),
          updated_at = datetime('now') WHERE id = @id`).run({ ...c, id: existing.id });
      return { id: existing.id, created: false };
    }
    const r = db.prepare(`INSERT INTO contacts (name, phone, address, property_type, notes)
        VALUES (@name, @phone, @address, @property_type, @notes)`).run(c);
    return { id: r.lastInsertRowid, created: true };
  },

  createInbound({ phone = null, instagram_id = null, name = null, instagram_username = null }) {
    const r = db.prepare(`INSERT INTO contacts (phone, instagram_id, name, instagram_username, status)
        VALUES (?, ?, ?, ?, 'replied')`).run(phone, instagram_id, name, instagram_username);
    return this.get(r.lastInsertRowid);
  },

  update(id, fields) {
    const allowed = ['name', 'address', 'property_type', 'notes', 'status', 'ai_summary', 'ai_paused', 'instagram_username'];
    const keys = Object.keys(fields).filter((k) => allowed.includes(k));
    if (!keys.length) return;
    const set = keys.map((k) => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE contacts SET ${set}, updated_at = datetime('now') WHERE id = @id`).run({ ...fields, id });
  },

  list({ status, q, limit = 200, offset = 0 } = {}) {
    const where = [];
    const params = { limit, offset };
    if (status) {
      const list = String(status).split(',').filter(Boolean);
      where.push(`status IN (${list.map((_, i) => `@s${i}`).join(', ')})`);
      list.forEach((v, i) => { params[`s${i}`] = v; });
    }
    if (q) { where.push('(name LIKE @q OR phone LIKE @q OR address LIKE @q OR instagram_username LIKE @q)'); params.q = `%${q}%`; }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return db.prepare(`SELECT c.*,
        (SELECT body FROM messages m WHERE m.contact_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message
        FROM contacts c ${w} ORDER BY c.updated_at DESC LIMIT @limit OFFSET @offset`).all(params);
  },

  // Contacts that were imported and never messaged, and have a phone number.
  pickForOutreach(limit) {
    return db.prepare(`SELECT * FROM contacts WHERE status = 'new' AND phone IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.contact_id = contacts.id)
        ORDER BY id LIMIT ?`).all(limit);
  },

  stats() {
    const rows = db.prepare('SELECT status, COUNT(*) AS n FROM contacts GROUP BY status').all();
    return Object.fromEntries(rows.map((r) => [r.status, r.n]));
  },
};

export const Messages = {
  get: (id) => db.prepare('SELECT * FROM messages WHERE id = ?').get(id),

  add({ contact_id, channel, direction, kind = 'reply', body, status, options = null, alternatives = null }) {
    const r = db.prepare(`INSERT INTO messages (contact_id, channel, direction, kind, body, status, options, alternatives)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(contact_id, channel, direction, kind, body, status,
      options ? JSON.stringify(options) : null, alternatives?.length ? JSON.stringify(alternatives) : null);
    db.prepare(`UPDATE contacts SET updated_at = datetime('now') WHERE id = ?`).run(contact_id);
    return this.get(r.lastInsertRowid);
  },

  history(contact_id, limit = 30) {
    return db.prepare(`SELECT * FROM (SELECT * FROM messages WHERE contact_id = ?
        AND (direction = 'in' OR status = 'sent') ORDER BY id DESC LIMIT ?) ORDER BY id`).all(contact_id, limit);
  },

  thread: (contact_id) => db.prepare('SELECT * FROM messages WHERE contact_id = ? ORDER BY id').all(contact_id),

  pending() {
    return db.prepare(`SELECT m.*, c.name, c.phone, c.instagram_username, c.status AS contact_status,
        (SELECT body FROM messages i WHERE i.contact_id = m.contact_id AND i.direction = 'in'
           AND i.id < m.id ORDER BY i.id DESC LIMIT 1) AS in_reply_to
        FROM messages m JOIN contacts c ON c.id = m.contact_id
        WHERE m.status = 'pending' ORDER BY m.id`).all();
  },

  // Drop older unsent drafts for a contact when a newer one supersedes them.
  supersedePending(contact_id) {
    db.prepare(`UPDATE messages SET status = 'rejected', error = 'superseded'
        WHERE contact_id = ? AND status = 'pending'`).run(contact_id);
  },

  setStatus(id, status, extra = {}) {
    db.prepare(`UPDATE messages SET status = @status, error = @error, body = COALESCE(@body, body),
        sent_at = CASE WHEN @status = 'sent' THEN datetime('now') ELSE sent_at END WHERE id = @id`)
      .run({ id, status, error: extra.error ?? null, body: extra.body ?? null });
    if (extra.options !== undefined) {
      db.prepare('UPDATE messages SET options = ? WHERE id = ?').run(extra.options ? JSON.stringify(extra.options) : null, id);
    }
    if (extra.alternatives !== undefined) {
      db.prepare('UPDATE messages SET alternatives = ? WHERE id = ?').run(extra.alternatives?.length ? JSON.stringify(extra.alternatives) : null, id);
    }
  },

  // The options of the last message we sent this contact (to understand "2" or a tapped poll option).
  lastSentOptions(contact_id) {
    const row = db.prepare(`SELECT options FROM messages WHERE contact_id = ? AND direction = 'out'
        AND status = 'sent' AND options IS NOT NULL ORDER BY id DESC LIMIT 1`).get(contact_id);
    return row ? JSON.parse(row.options) : null;
  },

  // Replies first (people are waiting), then outreach; outreach is skipped while it is throttled.
  nextApproved: (allowOutreach) => db.prepare(`SELECT * FROM messages WHERE status = 'approved'
      AND (@allow = 1 OR kind != 'outreach') ORDER BY kind = 'outreach', id LIMIT 1`).get({ allow: allowOutreach ? 1 : 0 }),

  // Per-day counts for the dashboard chart (local dates, oldest first).
  daily(days = 14) {
    const rows = db.prepare(`SELECT date(COALESCE(sent_at, created_at), 'localtime') AS day,
        SUM(direction = 'out' AND status = 'sent' AND kind = 'outreach') AS outreach,
        SUM(direction = 'out' AND status = 'sent' AND kind != 'outreach') AS replies,
        SUM(direction = 'in') AS incoming
      FROM messages WHERE COALESCE(sent_at, created_at) >= datetime('now', ?)
      GROUP BY day`).all(`-${days} days`);
    const byDay = Object.fromEntries(rows.map((r) => [r.day, r]));
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      out.push({ day, outreach: byDay[day]?.outreach || 0, replies: byDay[day]?.replies || 0, incoming: byDay[day]?.incoming || 0 });
    }
    return out;
  },

  outreachSentToday() {
    return db.prepare(`SELECT COUNT(*) AS n FROM messages WHERE kind = 'outreach' AND status = 'sent'
        AND date(sent_at, 'localtime') = date('now', 'localtime')`).get().n;
  },
};
