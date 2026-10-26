import { isAuthorized, parseAdvisorRequest } from '../../lib/advisor.ts';

// Server-only route: OPENAI_API_KEY and ADVISOR_ACCESS_CODE have no
// EXPO_PUBLIC_ prefix, so they are never bundled into the app. Set them in
// .env for development and as EAS environment variables for the deployed
// server. Without an access code the route refuses every request, so the
// OpenAI key can't be used by anyone who merely finds the URL.

const SYSTEM_PROMPT = `You are «مشاور عادت‌ها», a warm, practical habit coach inside a Persian habit-tracking app.
Always answer in fluent, natural Persian (Farsi), using Persian digits.
Keep answers short and actionable: a few sentences or a short list, no long essays.
Base your advice on the user's real habit data below when it is relevant; point out patterns (broken streaks, weak days, strong habits) and suggest one or two concrete next steps.
Use proven habit techniques (tiny habits, habit stacking, implementation intentions, environment design) without jargon.
You are not a doctor or therapist: for medical, mental-health or medication questions, give general guidance only and suggest seeing a professional.

User's habit data:
`;

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY;
  const accessCode = process.env.ADVISOR_ACCESS_CODE;
  if (!apiKey || !accessCode) {
    return Response.json({ error: 'سرور مشاور هنوز تنظیم نشده است.' }, { status: 500 });
  }
  if (!isAuthorized(request.headers.get('Authorization'), accessCode)) {
    return Response.json({ error: 'کد دسترسی نادرست است.' }, { status: 401 });
  }

  const input = parseAdvisorRequest(await request.json().catch(() => null));
  if (!input) {
    return Response.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? 'gpt-5-mini',
      messages: [{ role: 'system', content: SYSTEM_PROMPT + input.context }, ...input.messages],
      max_completion_tokens: 2000,
    }),
  }).catch(() => null);

  if (!upstream?.ok) {
    console.error('OpenAI request failed', upstream?.status, await upstream?.text().catch(() => ''));
    return Response.json({ error: 'پاسخ از مشاور دریافت نشد. کمی بعد دوباره امتحان کن.' }, { status: 502 });
  }

  const data = (await upstream.json()) as { choices?: { message?: { content?: string | null } }[] };
  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    return Response.json({ error: 'مشاور پاسخی نداد. دوباره امتحان کن.' }, { status: 502 });
  }
  return Response.json({ reply });
}
