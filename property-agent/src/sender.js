import { config } from './config.js';
import { Contacts, Messages } from './db.js';
import { getChannel } from './channels.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => min + Math.random() * (max - min);
let lastBlocked = '';

function outreachBlockedReason() {
  const hour = new Date().getHours();
  if (hour < config.sendHourStart || hour >= config.sendHourEnd) return 'outside sending hours';
  if (Messages.outreachSentToday() >= config.dailyOutreachLimit) return 'daily outreach limit reached';
  return null;
}

// Sends approved messages one at a time, with human-like pauses to lower the risk of a WhatsApp ban.
export async function runSender() {
  for (;;) {
    try {
      const outreachBlocked = outreachBlockedReason();
      const msg = Messages.nextApproved(!outreachBlocked);
      if (!msg) {
        if (outreachBlocked && Messages.nextApproved(true) && outreachBlocked !== lastBlocked) {
          console.log(`[sender] outreach paused: ${outreachBlocked}`);
          lastBlocked = outreachBlocked;
        }
        await sleep(3000);
        continue;
      }

      const contact = Contacts.get(msg.contact_id);
      if (!contact || contact.status === 'opted_out') {
        Messages.setStatus(msg.id, 'rejected', { error: 'contact opted out' });
        continue;
      }
      const channel = getChannel(msg.channel);
      if (!channel?.status().ready) {
        const reason = `${msg.channel} not connected`;
        if (reason !== lastBlocked) console.log(`[sender] waiting: ${reason}`);
        lastBlocked = reason;
        await sleep(30000);
        continue;
      }
      lastBlocked = '';

      Messages.setStatus(msg.id, 'sending');
      try {
        await channel.send(contact, msg.body);
        Messages.setStatus(msg.id, 'sent');
        if (msg.kind === 'outreach' && contact.status === 'drafted') Contacts.update(contact.id, { status: 'contacted' });
        console.log(`[sender] sent #${msg.id} to contact ${contact.id} via ${msg.channel}`);
      } catch (e) {
        Messages.setStatus(msg.id, 'failed', { error: e.message });
        console.error(`[sender] failed #${msg.id}:`, e.message);
      }

      const delay = msg.kind === 'outreach' ? rand(config.minDelaySec, config.maxDelaySec) : rand(4, 12);
      await sleep(delay * 1000);
    } catch (e) {
      console.error('[sender] loop error:', e);
      await sleep(10000);
    }
  }
}
