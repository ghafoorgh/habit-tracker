// Instagram DMs via the official Instagram API (Instagram Login). Requires a Professional
// (Business/Creator) account and a Meta app with instagram_business_manage_messages.
// Instagram only allows replying to people who messaged you (within 24 hours), so there is no cold outreach here.
import express from 'express';
import { config } from './config.js';
import { registerChannel } from './channels.js';
import { handleIncoming } from './agent.js';

const GRAPH = `https://graph.instagram.com/${config.instagramApiVersion}`;
let myId = null;

async function graph(path, options = {}) {
  const res = await fetch(`${GRAPH}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${config.instagramToken}`, 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Instagram API ${res.status}`);
  return data;
}

async function lookupUsername(igsid) {
  try {
    return (await graph(`/${igsid}?fields=username,name`)).username || null;
  } catch {
    return null;
  }
}

export async function startInstagram(app) {
  try {
    myId = (await graph('/me?fields=user_id,username')).user_id;
    console.log(`[instagram] connected (account ${myId})`);
  } catch (e) {
    console.error('[instagram] token check failed:', e.message);
  }

  const router = express.Router();
  // Webhook verification (Meta calls this once when you save the webhook URL).
  router.get('/', (req, res) => {
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === config.instagramVerifyToken) {
      return res.send(req.query['hub.challenge']);
    }
    res.sendStatus(403);
  });
  router.post('/', express.json(), async (req, res) => {
    res.sendStatus(200);
    for (const entry of req.body?.entry || []) {
      for (const ev of entry.messaging || []) {
        const senderId = ev.sender?.id;
        if (!senderId || senderId === myId || ev.message?.is_echo || !ev.message) continue;
        const text = ev.message.text || (ev.message.attachments ? '[پیوست / تصویر]' : '');
        // A tapped quick reply carries payload "opt_<index>"; pass it as its number so it maps to the full option title.
        const qr = ev.message.quick_reply?.payload;
        const body = qr?.startsWith('opt_') ? String(Number(qr.slice(4)) + 1) : text;
        const username = await lookupUsername(senderId);
        handleIncoming({ channel: 'instagram', instagramId: senderId, username, name: username, body });
      }
    }
  });
  app.use('/webhooks/instagram', router);

  registerChannel('instagram', {
    status: () => ({ ready: Boolean(myId) }),
    async send(contact, text, options) {
      if (!contact.instagram_id) throw new Error('contact has no Instagram id');
      const message = { text };
      const titles = options?.choices?.map((c) => c.title).filter(Boolean) || [];
      if (titles.length >= 2) {
        // Instagram quick replies: max 13, title max 20 characters
        message.quick_replies = titles.slice(0, 13).map((t, i) => ({ content_type: 'text', title: t.slice(0, 20), payload: `opt_${i}` }));
      }
      await graph('/me/messages', {
        method: 'POST',
        body: JSON.stringify({ recipient: { id: contact.instagram_id }, message }),
      });
    },
  });
}
