// Settings you can change from the panel (stored in the database), with .env values as defaults.
import { config } from './config.js';
import { Settings } from './db.js';

export const LANGUAGES = ['English', 'Persian', 'Arabic'];

// First-message styles. The text guides the AI; the sample is what the panel shows as a preview.
export const OUTREACH_STYLES = {
  warm: {
    label: 'گرم و کوتاه',
    guide: `Introduce the agent (name, agency, RERA-registered, specialist in the owner's community). Say we have buyers and
tenants actively looking for properties like theirs (mention their plot/project if known). Ask if they would be open to
selling or renting it out.`,
    sample: `Hi Mr. Ansari, this is [Name] from [Agency], a RERA-registered agent specialising in District One.

We have buyers and tenants actively looking for villas like yours on Plot 634. Would you be open to selling or renting it out?

Just tap an option below 👇
(Reply STOP if you'd rather not hear from us.)`,
  },
  valuation: {
    label: 'ارزش‌گذاری رایگان',
    guide: `Introduce the agent briefly. Mention demand in their community is strong (no specific numbers or deals unless they
are in the business information). Offer a free, no-obligation valuation if they have considered selling or leasing.`,
    sample: `Hello Mr. Ansari, I'm [Name] with [Agency].

Demand for District One villas has been strong this year. If you've ever considered selling or leasing your villa on Plot 634, I'd be happy to send you a free, no-obligation valuation.

Please choose below 👇
(Reply STOP if you'd rather not hear from us.)`,
  },
  short: {
    label: 'خیلی کوتاه و مستقیم',
    guide: `Two short lines only: a one-line greeting with the agent's name and agency, then ask directly whether their property
(mention plot/project if known) is available for sale or rent. No other claims.`,
    sample: `Hi Mr. Ansari 👋 [Name] from [Agency] here.

Is your District One villa (Plot 634) available for sale or rent?

Tap an option below.
(Reply STOP to opt out.)`,
  },
};

export const prefs = {
  outreachLanguage: () => Settings.get('outreach_language', config.outreachLanguage),
  outreachStyle: () => {
    const s = Settings.get('outreach_style', 'warm');
    return OUTREACH_STYLES[s] ? s : 'warm';
  },
  all() {
    return { outreach_language: this.outreachLanguage(), outreach_style: this.outreachStyle() };
  },
  update({ outreach_language, outreach_style }) {
    if (outreach_language && LANGUAGES.includes(outreach_language)) Settings.set('outreach_language', outreach_language);
    if (outreach_style && OUTREACH_STYLES[outreach_style]) Settings.set('outreach_style', outreach_style);
  },
};

// Choices attached to the first message as a WhatsApp poll. Edit the titles freely; keep the intents.
const OUTREACH_OPTIONS = {
  English: { question: 'Please choose an option:', choices: ['I want to sell', 'I want to rent it out', 'Call me', 'Not interested'] },
  Persian: { question: 'لطفاً یک گزینه را انتخاب کنید:', choices: ['می‌خواهم بفروشم', 'می‌خواهم اجاره بدهم', 'با من تماس بگیرید', 'فعلاً نه'] },
  Arabic: { question: 'يرجى اختيار أحد الخيارات:', choices: ['أرغب في البيع', 'أرغب في التأجير', 'اتصلوا بي', 'غير مهتم'] },
};
const OUTREACH_INTENTS = ['for_sale', 'for_rent', 'needs_human', 'not_interested'];

export function outreachOptions() {
  const o = OUTREACH_OPTIONS[prefs.outreachLanguage()] || OUTREACH_OPTIONS.English;
  return { question: o.question, choices: o.choices.map((title, i) => ({ title, intent: OUTREACH_INTENTS[i] })) };
}

