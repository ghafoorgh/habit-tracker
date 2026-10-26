/// <reference types="node" />
// Exercises the /api/advisor route handler with OpenAI stubbed out. Lives in
// lib/ because every file under app/ is treated as a route.
import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { POST } from '../app/api/advisor+api.ts';
import { isAuthorized } from './advisor.ts';

const realFetch = globalThis.fetch;
let openAiCalls: { url: string; body: any; auth: string | null }[] = [];

beforeEach(() => {
  process.env.OPENAI_API_KEY = 'sk-test';
  process.env.ADVISOR_ACCESS_CODE = 'my-secret-code';
  openAiCalls = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    openAiCalls.push({
      url,
      body: JSON.parse(String(init.body)),
      auth: new Headers(init.headers).get('Authorization'),
    });
    return Response.json({ choices: [{ message: { content: ' سلام! ' } }] });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.OPENAI_API_KEY;
  delete process.env.ADVISOR_ACCESS_CODE;
});

function request(code: string | null, body: unknown = { messages: [{ role: 'user', content: 'سلام' }], context: 'ctx' }) {
  return new Request('http://localhost/api/advisor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(code === null ? {} : { Authorization: `Bearer ${code}` }) },
    body: JSON.stringify(body),
  });
}

test('answers with the model reply when the access code is right', async () => {
  const res = await POST(request('my-secret-code'));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { reply: 'سلام!' });
  assert.equal(openAiCalls.length, 1);
  assert.equal(openAiCalls[0].url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(openAiCalls[0].auth, 'Bearer sk-test');
  assert.equal(openAiCalls[0].body.messages[0].role, 'system');
  assert.match(openAiCalls[0].body.messages[0].content, /ctx$/);
  assert.deepEqual(openAiCalls[0].body.messages[1], { role: 'user', content: 'سلام' });
});

test('rejects a wrong or missing access code without calling OpenAI', async () => {
  assert.equal((await POST(request('wrong'))).status, 401);
  assert.equal((await POST(request(null))).status, 401);
  assert.equal(openAiCalls.length, 0);
});

test('refuses every request when the server has no access code configured', async () => {
  delete process.env.ADVISOR_ACCESS_CODE;
  assert.equal((await POST(request(''))).status, 500);
  assert.equal(openAiCalls.length, 0);
});

test('rejects malformed bodies', async () => {
  assert.equal((await POST(request('my-secret-code', { messages: 'hi' }))).status, 400);
  assert.equal(openAiCalls.length, 0);
});

test('reports an OpenAI failure as 502', async () => {
  globalThis.fetch = (async () => new Response('{"error":"bad key"}', { status: 401 })) as unknown as typeof fetch;
  const res = await POST(request('my-secret-code'));
  assert.equal(res.status, 502);
  assert.ok((await res.json()).error);
});

test('isAuthorized needs the exact code', () => {
  assert.equal(isAuthorized('Bearer abc', 'abc'), true);
  assert.equal(isAuthorized('Bearer abd', 'abc'), false);
  assert.equal(isAuthorized('abc', 'abc'), false);
  assert.equal(isAuthorized(null, 'abc'), false);
  assert.equal(isAuthorized('Bearer ', ''), false);
});
