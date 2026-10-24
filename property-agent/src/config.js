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
  defaultCountryCode: process.env.DEFAULT_COUNTRY_CODE || '971',

  // Language of the first message to owners (they are answered in whatever language they reply in).
  outreachLanguage: process.env.OUTREACH_LANGUAGE || 'English',
};

// Choices attached to the first message as a WhatsApp poll. Edit the titles freely; keep the intents.
const OUTREACH_OPTIONS = {
  English: { question: 'Please choose an option:', choices: ['I want to sell', 'I want to rent it out', 'Call me', 'Not interested'] },
  Persian: { question: 'لطفاً یک گزینه را انتخاب کنید:', choices: ['می‌خواهم بفروشم', 'می‌خواهم اجاره بدهم', 'با من تماس بگیرید', 'فعلاً نه'] },
  Arabic: { question: 'يرجى اختيار أحد الخيارات:', choices: ['أرغب في البيع', 'أرغب في التأجير', 'اتصلوا بي', 'غير مهتم'] },
};
const OUTREACH_INTENTS = ['for_sale', 'for_rent', 'needs_human', 'not_interested'];

export function outreachOptions() {
  const o = OUTREACH_OPTIONS[config.outreachLanguage] || OUTREACH_OPTIONS.English;
  return { question: o.question, choices: o.choices.map((title, i) => ({ title, intent: OUTREACH_INTENTS[i] })) };
}

export function loadBusinessProfile() {
  const file = path.resolve('config/business.md');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}
