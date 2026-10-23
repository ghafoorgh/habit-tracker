import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

const num = (v, d) => (v === undefined || v === '' ? d : Number(v));

export const config = {
  port: num(process.env.PORT, 3000),
  adminUser: process.env.ADMIN_USER || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  dbPath: process.env.DB_PATH || './data/agent.db',

  model: process.env.CLAUDE_MODEL || 'claude-opus-5-5',
  effort: process.env.CLAUDE_EFFORT || 'low',

  whatsappEnabled: process.env.WHATSAPP_ENABLED !== 'false',
  chromePath: process.env.CHROME_PATH || undefined,

  instagramEnabled: process.env.INSTAGRAM_ENABLED === 'true',
  instagramToken: process.env.INSTAGRAM_ACCESS_TOKEN || '',
  instagramVerifyToken: process.env.INSTAGRAM_VERIFY_TOKEN || '',
  instagramApiVersion: process.env.INSTAGRAM_API_VERSION || 'v21.0',

  // Anti-ban throttling for the unofficial WhatsApp connection
  dailyOutreachLimit: num(process.env.DAILY_OUTREACH_LIMIT, 30),
  minDelaySec: num(process.env.MIN_DELAY_SECONDS, 60),
  maxDelaySec: num(process.env.MAX_DELAY_SECONDS, 180),
  sendHourStart: num(process.env.SEND_HOUR_START, 9),
  sendHourEnd: num(process.env.SEND_HOUR_END, 20),
  defaultCountryCode: process.env.DEFAULT_COUNTRY_CODE || '98',
};

export function loadBusinessProfile() {
  const file = path.resolve('config/business.md');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}
