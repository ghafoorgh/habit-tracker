import { Contacts, Messages } from './db.js';
import { draftOutreach, draftReply } from './ai.js';

const OPT_OUT = /^\s*(لغو|stop|unsubscribe|مزاحم نشوید|مزاحم نشید|پیام ندهید|پیام ندید)\s*[.!]*\s*$/i;
const DRAFT_DELAY_MS = 8000; // wait for people who send several short messages in a row
const timers = new Map();
const INTENT_STATUS = {
  for_sale: 'for_sale',
  for_rent: 'for_rent',
  not_interested: 'not_interested',
  opted_out: 'opted_out',
};

export function handleIncoming({ channel, phone = null, instagramId = null, name = null, username = null, body }) {
  if (!body?.trim()) return;
  let contact = phone ? Contacts.byPhone(phone) : Contacts.byInstagram(instagramId);
  if (!contact) contact = Contacts.createInbound({ phone, instagram_id: instagramId, name, instagram_username: username });
  else if (username && !contact.instagram_username) Contacts.update(contact.id, { instagram_username: username });

  Messages.add({ contact_id: contact.id, channel, direction: 'in', body, status: 'received' });

  if (OPT_OUT.test(body)) {
    Contacts.update(contact.id, { status: 'opted_out' });
    Messages.supersedePending(contact.id);
    console.log(`[agent] contact ${contact.id} opted out`);
    return;
  }
  if (contact.status === 'opted_out' || contact.ai_paused) return;
  if (['new', 'drafted', 'contacted'].includes(contact.status)) Contacts.update(contact.id, { status: 'replied' });

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
  return Messages.add({ contact_id: contactId, channel, direction: 'out', kind: 'reply', body: result.reply.trim(), status: 'pending' });
}

// Create first-message drafts for up to `count` imported contacts; they wait for your approval.
export async function generateOutreach(count) {
  const contacts = Contacts.pickForOutreach(count);
  const results = { drafted: 0, failed: 0 };
  for (const c of contacts) {
    try {
      const body = await draftOutreach(c);
      Messages.add({ contact_id: c.id, channel: 'whatsapp', direction: 'out', kind: 'outreach', body, status: 'pending' });
      Contacts.update(c.id, { status: 'drafted' });
      results.drafted++;
    } catch (e) {
      console.error(`[agent] outreach draft failed for ${c.id}:`, e.message);
      results.failed++;
    }
  }
  return results;
}
