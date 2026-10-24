// WhatsApp via whatsapp-web.js (unofficial: logs in as WhatsApp Web with a QR code).
// Keep volumes low: sending many messages to people who never saved your number can get it banned.
import wweb from 'whatsapp-web.js';
import qrTerminal from 'qrcode-terminal';
import QRCode from 'qrcode';
import { config } from './config.js';
import { registerChannel } from './channels.js';
import { handleIncoming } from './agent.js';
import { normalizePhone } from './phone.js';

const { Client, LocalAuth, Poll } = wweb;
const POLL_QUESTION_MAX = 255;
const state = { ready: false, qr: null, info: null };
const chatIds = new Map(); // phone -> chat id we last heard from (handles @lid chats)

export function startWhatsApp() {
  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './data/wa-session' }),
    puppeteer: {
      headless: true,
      executablePath: config.chromePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    },
  });

  client.on('qr', async (qr) => {
    state.ready = false;
    state.qr = await QRCode.toDataURL(qr);
    console.log('[whatsapp] scan this QR in WhatsApp > Linked devices (also shown in the admin panel):');
    qrTerminal.generate(qr, { small: true });
  });
  client.on('ready', () => {
    state.ready = true;
    state.qr = null;
    state.info = client.info?.wid?.user || null;
    console.log(`[whatsapp] connected as ${state.info}`);
  });
  client.on('auth_failure', (m) => console.error('[whatsapp] auth failure:', m));
  client.on('disconnected', (reason) => {
    state.ready = false;
    console.warn('[whatsapp] disconnected:', reason, '- reconnecting in 15s');
    setTimeout(() => client.initialize().catch((e) => console.error('[whatsapp] reconnect failed:', e.message)), 15000);
  });

  // Someone tapped an option in a poll we sent.
  client.on('vote_update', async (vote) => {
    try {
      const picked = vote.selectedOptions?.[0]?.name;
      if (!picked || !vote.voter) return; // empty = they removed their vote
      let pn = vote.voter.endsWith('@c.us') ? vote.voter : null;
      if (!pn) [{ pn } = {}] = await client.getContactLidAndPhone([vote.voter]);
      const phone = normalizePhone((pn || '').split('@')[0]);
      if (!phone) return console.warn('[whatsapp] vote from unknown number', vote.voter);
      chatIds.set(phone, vote.voter);
      handleIncoming({ channel: 'whatsapp', phone, body: picked, votedTitle: picked });
    } catch (e) {
      console.error('[whatsapp] vote error:', e.message);
    }
  });

  client.on('message', async (msg) => {
    try {
      if (msg.fromMe || msg.isStatus || msg.from.endsWith('@g.us') || msg.from === 'status@broadcast') return;
      if (msg.type === 'poll_creation') return;
      const contact = await msg.getContact();
      const phone = normalizePhone(contact.number || msg.from.split('@')[0]);
      if (!phone) return;
      chatIds.set(phone, msg.from);

      let body = msg.body;
      if (msg.type !== 'chat') body = msg.body ? `[${msg.type}] ${msg.body}` : `[${msg.type} — پیام غیرمتنی]`;
      handleIncoming({ channel: 'whatsapp', phone, name: contact.pushname || contact.name || null, body });
    } catch (e) {
      console.error('[whatsapp] incoming error:', e.message);
    }
  });

  registerChannel('whatsapp', {
    status: () => ({ ready: state.ready, qr: state.qr, account: state.info }),
    async send(contact, text, options) {
      if (!contact.phone) throw new Error('contact has no phone number');
      let chatId = chatIds.get(contact.phone);
      if (!chatId) {
        const wid = await client.getNumberId(contact.phone);
        if (!wid) throw new Error('این شماره در واتس‌اپ نیست');
        chatId = wid._serialized;
      }
      const chat = await client.getChatById(chatId);
      await chat.sendStateTyping();
      await new Promise((r) => setTimeout(r, Math.min(8000, 1500 + text.length * 40)));
      const titles = options?.choices?.map((c) => c.title).filter(Boolean) || [];
      if (titles.length < 2) {
        await client.sendMessage(chatId, text);
      } else if (!options.question && text.length <= POLL_QUESTION_MAX) {
        await client.sendMessage(chatId, new Poll(text, titles)); // the text is the poll question
      } else {
        await client.sendMessage(chatId, text);
        await new Promise((r) => setTimeout(r, 1500));
        await client.sendMessage(chatId, new Poll((options.question || '👇').slice(0, POLL_QUESTION_MAX), titles));
      }
    },
  });

  client.initialize().catch((e) => console.error('[whatsapp] failed to start:', e.message));
}
