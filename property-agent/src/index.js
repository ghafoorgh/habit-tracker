import { config } from './config.js';
import { db } from './db.js';
import { createApp, mountAdmin } from './server.js';
import { runSender } from './sender.js';

// A message that was mid-send when the process stopped may or may not have gone out: don't resend blindly.
db.prepare(`UPDATE messages SET status = 'failed', error = 'interrupted while sending — check WhatsApp before retrying'
  WHERE status = 'sending'`).run();

const app = createApp();

if (config.instagramEnabled) {
  const { startInstagram } = await import('./instagram.js');
  await startInstagram(app);
}
mountAdmin(app);

const host = config.adminPassword ? '0.0.0.0' : '127.0.0.1';
app.listen(config.port, host, () => {
  console.log(`[panel] http://${host === '0.0.0.0' ? 'localhost' : host}:${config.port}`);
  if (!config.adminPassword) console.warn('[panel] ADMIN_PASSWORD is not set: panel only reachable from this machine.');
});

if (config.whatsappEnabled) {
  const { startWhatsApp } = await import('./whatsapp.js');
  startWhatsApp();
}
runSender();
