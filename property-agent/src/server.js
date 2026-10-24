import express from 'express';
import XLSX from 'xlsx';
import { config } from './config.js';
import { Contacts, Messages, STATUSES } from './db.js';
import { channelStatus } from './channels.js';
import { draftReplyFor, generateOutreach } from './agent.js';
import { draftOutreach } from './ai.js';
import { importBuffer } from './import.js';
import { prefs, OUTREACH_STYLES, LANGUAGES } from './prefs.js';

function basicAuth(req, res, next) {
  if (!config.adminPassword) return next(); // only reachable from localhost in that case
  const [user, pass] = Buffer.from((req.headers.authorization || '').split(' ')[1] || '', 'base64').toString().split(':');
  if (user === config.adminUser && pass === config.adminPassword) return next();
  res.set('WWW-Authenticate', 'Basic realm="property-agent"').status(401).send('Authentication required');
}

// Options edited in the panel: keep each choice's intent by position, drop empty titles, null = no poll.
function cleanOptions(input, storedJson) {
  if (!input || !Array.isArray(input.choices)) return null;
  const stored = storedJson ? JSON.parse(storedJson) : { choices: [] };
  const choices = input.choices
    .map((t, i) => ({ title: String(t).trim().slice(0, 100), intent: stored.choices[i]?.intent }))
    .filter((c) => c.title)
    .slice(0, 12);
  if (choices.length < 2) return null;
  const question = typeof input.question === 'string' && input.question.trim() ? input.question.trim().slice(0, 255) : stored.question ?? null;
  return { question, choices };
}

const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
  console.error('[api]', e);
  res.status(500).json({ error: e.message });
});

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  return app;
}

export function mountAdmin(app) {
  const api = express.Router();
  api.use(express.json({ limit: '1mb' }));

  api.get('/status', (req, res) => res.json({
    channels: channelStatus(),
    stats: Contacts.stats(),
    statuses: STATUSES,
    pending: Messages.pending().length,
    outreachSentToday: Messages.outreachSentToday(),
    limits: {
      daily: config.dailyOutreachLimit,
      hours: [config.sendHourStart, config.sendHourEnd],
      delay: [config.minDelaySec, config.maxDelaySec],
    },
  }));

  api.get('/daily', (req, res) => res.json(Messages.daily(14)));

  api.get('/settings', (req, res) => res.json({
    ...prefs.all(),
    languages: LANGUAGES,
    styles: Object.fromEntries(Object.entries(OUTREACH_STYLES).map(([k, v]) => [k, { label: v.label, sample: v.sample }])),
  }));
  api.put('/settings', (req, res) => { prefs.update(req.body || {}); res.json(prefs.all()); });

  api.get('/queue', (req, res) => res.json(Messages.pending()));

  api.post('/messages/:id/approve', (req, res) => {
    const msg = Messages.get(req.params.id);
    if (!msg || msg.status !== 'pending') return res.status(409).json({ error: 'پیام در صف تأیید نیست' });
    const body = typeof req.body.body === 'string' && req.body.body.trim() ? req.body.body.trim() : null;
    const extra = { body };
    if (req.body.options !== undefined) extra.options = cleanOptions(req.body.options, msg.options);
    Messages.setStatus(msg.id, 'approved', extra);
    res.json({ ok: true });
  });

  api.post('/messages/:id/reject', (req, res) => {
    const msg = Messages.get(req.params.id);
    if (!msg || msg.status !== 'pending') return res.status(409).json({ error: 'پیام در صف تأیید نیست' });
    Messages.setStatus(msg.id, 'rejected');
    if (msg.kind === 'outreach') Contacts.update(msg.contact_id, { status: 'new' });
    res.json({ ok: true });
  });

  api.post('/messages/:id/redraft', wrap(async (req, res) => {
    const msg = Messages.get(req.params.id);
    if (!msg || msg.status !== 'pending') return res.status(409).json({ error: 'پیام در صف تأیید نیست' });
    if (msg.kind === 'outreach') {
      const [body, ...alternatives] = await draftOutreach(Contacts.get(msg.contact_id));
      Messages.setStatus(msg.id, 'pending', { body, alternatives });
    } else {
      await draftReplyFor(msg.contact_id, msg.channel);
    }
    res.json({ ok: true });
  }));

  api.post('/messages/:id/retry', (req, res) => {
    const msg = Messages.get(req.params.id);
    if (!msg || msg.status !== 'failed') return res.status(409).json({ error: 'فقط پیام‌های ناموفق' });
    Messages.setStatus(msg.id, 'approved');
    res.json({ ok: true });
  });

  api.get('/contacts', (req, res) => res.json(Contacts.list({ status: req.query.status, q: req.query.q })));

  api.get('/contacts/:id', (req, res) => {
    const contact = Contacts.get(req.params.id);
    if (!contact) return res.sendStatus(404);
    res.json({ contact, messages: Messages.thread(contact.id) });
  });

  api.patch('/contacts/:id', (req, res) => {
    const { status, notes, ai_paused, name, address, property_type } = req.body;
    if (status && !STATUSES[status]) return res.status(400).json({ error: 'وضعیت نامعتبر' });
    const fields = Object.fromEntries(Object.entries({ status, notes, name, address, property_type,
      ai_paused: ai_paused === undefined ? undefined : ai_paused ? 1 : 0 }).filter(([, v]) => v !== undefined));
    Contacts.update(Number(req.params.id), fields);
    if (status === 'opted_out') Messages.supersedePending(Number(req.params.id));
    res.json({ ok: true });
  });

  // A message you typed yourself: no approval step, goes straight to the send queue.
  api.post('/contacts/:id/send', (req, res) => {
    const contact = Contacts.get(req.params.id);
    const body = (req.body.body || '').trim();
    if (!contact || !body) return res.status(400).json({ error: 'متن پیام خالی است' });
    const channel = req.body.channel || (contact.instagram_id && !contact.phone ? 'instagram' : 'whatsapp');
    Messages.supersedePending(contact.id);
    const msg = Messages.add({ contact_id: contact.id, channel, direction: 'out', kind: 'manual', body, status: 'approved' });
    res.json(msg);
  });

  api.post('/contacts/:id/draft', wrap(async (req, res) => {
    const contact = Contacts.get(req.params.id);
    if (!contact) return res.sendStatus(404);
    const channel = contact.phone ? 'whatsapp' : 'instagram';
    res.json(await draftReplyFor(contact.id, channel) || { ok: true, empty: true });
  }));

  api.post('/outreach', wrap(async (req, res) => {
    const count = Math.max(1, Math.min(100, Number(req.body.count) || 10));
    res.json(await generateOutreach(count));
  }));

  api.post('/import', express.raw({ type: '*/*', limit: '20mb' }), wrap(async (req, res) => {
    if (!req.body?.length) return res.status(400).json({ error: 'فایلی ارسال نشد' });
    res.json(importBuffer(req.body));
  }));

  api.get('/export', (req, res) => {
    const rows = Contacts.list({ limit: 100000 }).map((c) => ({
      'نام': c.name, 'شماره': c.phone, 'اینستاگرام': c.instagram_username, 'آدرس': c.address,
      'نوع ملک': c.property_type, 'وضعیت': STATUSES[c.status] || c.status, 'جزئیات ملک': c.ai_summary,
      'یادداشت': c.notes, 'آخرین پیام': c.last_message, 'به‌روزرسانی': c.updated_at,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'contacts');
    res.set('Content-Disposition', 'attachment; filename="contacts.xlsx"');
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  });

  app.use('/api', basicAuth, api);
  app.use('/', basicAuth, express.static('public'));
}
