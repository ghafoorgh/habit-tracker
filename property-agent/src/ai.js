import Anthropic from '@anthropic-ai/sdk';
import { config, loadBusinessProfile } from './config.js';

const client = new Anthropic();

const BASE_INSTRUCTIONS = `You are the messaging assistant of a real-estate agent. You talk to property owners and
clients on WhatsApp and Instagram on the agent's behalf. Every message you write is reviewed and approved
by the agent before it is sent, so write the exact text that should be sent.

Goals:
- Find out whether the owner wants to SELL or RENT OUT their property, or neither.
- If they are interested, politely collect the useful details: property type, location/area, size (m²),
  rooms, floor, age, asking price or rent/deposit, and a good time for the agent to call or visit.
  Ask one or two things at a time, never a long questionnaire.
- Answer questions using only the business information below. If you don't know something (exact
  commission, legal questions, a specific listing you have no data about), say the agent will follow up
  personally, and set needs_human to true.

Style:
- Reply in the language the person writes in (default: Persian/Farsi), warm, respectful and short —
  like a real person on WhatsApp, 1–4 sentences, no markdown, no bullet lists.
- Never invent facts, prices or listings. Never pressure anyone.
- If the person says they don't want messages, or asks how you got their number, apologise briefly,
  confirm they won't be contacted again, and set intent to "opted_out".`;

function systemBlocks() {
  const profile = loadBusinessProfile();
  return [
    {
      type: 'text',
      text: `${BASE_INSTRUCTIONS}\n\n<business_information>\n${profile}\n</business_information>`,
      cache_control: { type: 'ephemeral' },
    },
  ];
}

const REPLY_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string', description: 'Exact message text to send. Empty string if no reply is needed.' },
    intent: {
      type: 'string',
      enum: ['for_sale', 'for_rent', 'not_interested', 'opted_out', 'question', 'unclear'],
      description: 'What the person wants, based on the whole conversation so far.',
    },
    property_summary: {
      type: 'string',
      description: 'Short Persian summary of every property detail learned so far (type, area, size, price...). Empty if none.',
    },
    needs_human: { type: 'boolean', description: 'True if the agent should personally handle this conversation.' },
  },
  required: ['reply', 'intent', 'property_summary', 'needs_human'],
  additionalProperties: false,
};

const OUTREACH_SCHEMA = {
  type: 'object',
  properties: { message: { type: 'string' } },
  required: ['message'],
  additionalProperties: false,
};

async function ask(messages, schema) {
  const response = await client.beta.messages.create({
    model: config.model,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: systemBlocks(),
    messages,
    output_config: { effort: config.effort, format: { type: 'json_schema', schema } },
  });

  if (response.stop_reason === 'refusal') {
    throw new Error(`Claude declined this request (${response.stop_details?.category ?? 'unknown'})`);
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error('Claude response was cut off (max_tokens)');
  }
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(text);
}

function contactCard(c) {
  return [
    c.name && `Name: ${c.name}`,
    c.address && `Property address/area on file: ${c.address}`,
    c.property_type && `Property type on file: ${c.property_type}`,
    c.notes && `Agent's notes: ${c.notes}`,
    c.ai_summary && `Details learned so far: ${c.ai_summary}`,
  ].filter(Boolean).join('\n') || '(no details on file)';
}

// First WhatsApp message to a property owner from the imported list.
export async function draftOutreach(contact) {
  const prompt = `Write the FIRST WhatsApp message to this property owner. They have never talked to us.
Introduce the agent briefly (from the business information), mention their property if we know the area,
and ask politely whether they would like to sell or rent it out. Keep it under 3 short sentences, friendly,
not salesy. End by making it easy to say no (e.g. they can reply "لغو" to stop messages).

<contact>
${contactCard(contact)}
</contact>`;
  const out = await ask([{ role: 'user', content: prompt }], OUTREACH_SCHEMA);
  return out.message.trim();
}

// Reply to an incoming message, given the conversation so far (oldest first).
export async function draftReply(contact, history, channel) {
  const transcript = history
    .map((m) => `${m.direction === 'in' ? 'THEM' : 'US'}: ${m.body}`)
    .join('\n');
  const prompt = `Channel: ${channel}
<contact>
${contactCard(contact)}
</contact>

<conversation>
${transcript}
</conversation>

Write our next reply to THEM's latest message, and classify the conversation.`;
  return ask([{ role: 'user', content: prompt }], REPLY_SCHEMA);
}
