import { Contacts, Messages } from './db.js';
import { draftOutreach, draftReply } from './ai.js';
import { outreachOptions } from './config.js';

const OPT_OUT = /^\s*(لغو|stop|unsubscribe|مزاحم نشوید|مزاحم نشید|پیام ندهید|پیام ندید)\s*[.!]*\s*$/i;
const DRAFT_DELAY_MS = 8000; // wait for people who send several short messages in a row
const timers = new Map();
const INTENT_STATUS = {
  for_sale: 'for_sale',
  for_rent: 'for_rent',
  not_interested: 'not_interested',
  opted_out: 'opted_out',
  needs_human: 'needs_human',
};
const DIGITS = { '۱': '1', '۲': '2', '۳': '3', '۴': '4', '١': '1', '٢': '2', '٣': '3', '٤': '4' };

// Match a tapped poll option, an Instagram quick reply, or a bare "2" against the last options we sent.
function matchOption(contactId, body, votedTitle) {
  const opts = Messages.lastSentOptions(contactId);
  if (!opts) return null;
  const text = (votedTitle ?? body).trim();
  const digit = text.replace(/[۱-۴١-٤]/g, (d) => DIGITS[d]);
  if (/^[1-4]$/.test(digit) && opts.choices[Number(digit) - 1]) return opts.choices[Number(digit) - 1];
  return opts.choices.find((c) => c.title.toLowerCase() === text.toLowerCase()) || null;
}

export function handleIncoming({ channel, phone = null, instagramId = null, name = null, username = null, body, votedTitle = null }) {
  if (!body?.trim() && !votedTitle) return;
  let contact = phone ? Contacts.byPhone(phone) : Contacts.byInstagram(instagramId);
  if (!contact) contact = Contacts.createInbound({ phone, instagram_id: instagramId, name, instagram_username: username });
  else if (username && !contact.instagram_username) Contacts.update(contact.id, { instagram_username: username });

  const choice = matchOption(contact.id, body, votedTitle);
  if (choice) body = `[selected option] ${choice.title}`;
  else if (votedTitle) body = `[selected option] ${votedTitle}`;
  Messages.add({ contact_id: contact.id, channel, direction: 'in', body, status: 'received' });

  if (OPT_OUT.test(body)) {
    Contacts.update(contact.id, { status: 'opted_out' });
    Messages.supersedePending(contact.id);
    console.log(`[agent] contact ${contact.id} opted out`);
    return;
  }
  if (contact.status === 'opted_out' || contact.ai_paused) return;
  if (choice?.intent) Contacts.update(contact.id, { status: INTENT_STATUS[choice.intent] });
  else if (['new', 'drafted', 'contacted'].includes(contact.status)) Contacts.update(contact.id, { status: 'replied' });

  clearTimeout(timers.get(contact.id));
  timers.set(contact.id, setTimeout(() => {
    timers.delete(contact.id);
    draftReplyFor(contact.id, channel).catch((e) => console.error(`[agent] draft failed for ${contact.id}:`, e.message));
  }, DRAFT_DELAY_MS));
}

export async function draftReplyFor(contactId, channel) {
  const contact = Contacts.get(contactId);
  if (!contact || contact.status === 'opted_out' || contact.ai_paused) return null;
  const result = await draftReply(contact, Messages.history(contactId), channel);

  const status = result.needs_human ? 'needs_human' : INTENT_STATUS[result.intent] || contact.status;
  Contacts.update(contactId, { status, ai_summary: result.property_summary || contact.ai_summary });

  Messages.supersedePending(contactId);
  if (!result.reply.trim()) return null;
  const choices = result.options.map((t) => t.trim().slice(0, 100)).filter(Boolean).slice(0, 12);
  return Messages.add({
    contact_id: contactId, channel, direction: 'out', kind: 'reply', body: result.reply.trim(), status: 'pending',
        // question: null = the reply text itself becomes the poll question (no duplicate message)
    options: choices.length >= 2 ? { question: null, choices: choices.map((title) => ({ title })) } : null,
    alternatives: result.alternatives.map((a) => a.trim()).filter(Boolean),
  });
}

// Create first-message drafts for up to `count` imported contacts; they wait for your approval.
export async function generateOutreach(count) {
  const contacts = Contacts.pickForOutreach(count);
  const results = { drafted: 0, failed: 0 };
  for (const c of contacts) {
    try {
      const [body, ...alternatives] = await draftOutreach(c);
      Messages.add({ contact_id: c.id, channel: 'whatsapp', direction: 'out', kind: 'outreach', body, status: 'pending',
        options: outreachOptions(), alternatives });
      Contacts.update(c.id, { status: 'drafted' });
      results.drafted++;
    } catch (e) {
      console.error(`[agent] outreach draft failed for ${c.id}:`, e.message);
      results.failed++;
    }
  }
  return results;
}
