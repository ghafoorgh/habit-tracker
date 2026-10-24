// Offline tests: run with `node --test tools/openai-advisor/`.
// A local HTTP server stands in for the Responses API, so no key or network is used.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SERVER = fileURLToPath(new URL("./server.mjs", import.meta.url));
const FAKE_KEY = "sk-test" + "x".repeat(40);

let mock;
let mockUrl;
let lastRequest;

before(async () => {
  mock = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      lastRequest = { url: req.url, auth: req.headers.authorization, body: JSON.parse(raw) };
      res.setHeader("Content-Type", "application/json");
      if (lastRequest.body.input.includes("FAIL")) {
        res.statusCode = 401;
        return res.end(JSON.stringify({ error: { message: `Incorrect API key provided: ${FAKE_KEY}` } }));
      }
      res.end(
        JSON.stringify({
          id: "resp_1",
          model: lastRequest.body.model,
          status: "completed",
          output: [{ type: "message", content: [{ type: "output_text", text: "Mock advice." }] }],
          usage: { input_tokens: 12, output_tokens: 3, total_tokens: 15 },
        }),
      );
    });
  });
  await new Promise((r) => mock.listen(0, "127.0.0.1", r));
  mockUrl = `http://127.0.0.1:${mock.address().port}/v1`;
});

after(() => mock.close());

function startServer(env = {}) {
  const child = spawn(process.execPath, [SERVER], {
    env: {
      PATH: process.env.PATH,
      OPENAI_BASE_URL: mockUrl,
      OPENAI_ADVISOR_USAGE_FILE: join(mkdtempSync(join(tmpdir(), "advisor-")), "usage.json"),
      ...env,
    },
    stdio: ["pipe", "pipe", "inherit"],
  });
  const pending = new Map();
  let buf = "";
  child.stdout.on("data", (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const msg = JSON.parse(buf.slice(0, i));
      buf = buf.slice(i + 1);
      pending.get(msg.id)?.(msg);
    }
  });
  let nextId = 1;
  const rpc = (method, params) =>
    new Promise((resolve) => {
      const id = nextId++;
      pending.set(id, resolve);
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  const ask = async (args) => (await rpc("tools/call", { name: "ask_openai", arguments: args })).result;
  return { rpc, ask, stop: () => child.kill() };
}

test("MCP handshake and tool listing", async () => {
  const s = startServer({ OPENAI_API_KEY: FAKE_KEY });
  const init = await s.rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t" } });
  assert.equal(init.result.serverInfo.name, "openai_advisor");
  const list = await s.rpc("tools/list", {});
  assert.deepEqual(list.result.tools.map((t) => t.name), ["ask_openai"]);
  s.stop();
});

test("successful call sends a bounded, non-stored Responses API request", async () => {
  const s = startServer({ OPENAI_API_KEY: FAKE_KEY, OPENAI_ADVISOR_MODEL: "test-model" });
  const r = await s.ask({ question: "Review this", task_type: "code_review", context: "const a = 1;", max_output_tokens: 99999 });
  assert.equal(r.isError, false);
  assert.match(r.content[0].text, /^Mock advice\./);
  assert.equal(lastRequest.url, "/v1/responses");
  assert.equal(lastRequest.auth, `Bearer ${FAKE_KEY}`);
  assert.equal(lastRequest.body.model, "test-model");
  assert.equal(lastRequest.body.store, false);
  assert.equal(lastRequest.body.max_output_tokens, 4000);
  assert.ok(!r.content[0].text.includes(FAKE_KEY));
  s.stop();
});

test("missing key is reported without calling the API", async () => {
  const s = startServer();
  lastRequest = undefined;
  const r = await s.ask({ question: "hi" });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /OPENAI_API_KEY is not set/);
  assert.equal(lastRequest, undefined);
  s.stop();
});

test("secrets are always blocked", async () => {
  const s = startServer({ OPENAI_API_KEY: FAKE_KEY });
  lastRequest = undefined;
  for (const context of ["token = ghp_" + "a".repeat(36), "-----BEGIN RSA PRIVATE KEY-----", 'API_KEY="abcd1234efgh5678"']) {
    const r = await s.ask({ question: "check", context, sensitive_data_approved: true });
    assert.equal(r.isError, true, context);
    assert.match(r.content[0].text, /Blocked/);
  }
  assert.equal(lastRequest, undefined);
  s.stop();
});

test("personal data needs explicit approval", async () => {
  const s = startServer({ OPENAI_API_KEY: FAKE_KEY });
  lastRequest = undefined;
  const denied = await s.ask({ question: "Lead: someone@example.com, +971 50 123 4567" });
  assert.equal(denied.isError, true);
  assert.match(denied.content[0].text, /Approval required/);
  assert.equal(lastRequest, undefined);
  const approved = await s.ask({ question: "Lead: someone@example.com", sensitive_data_approved: true });
  assert.equal(approved.isError, false);
  s.stop();
});

test("ordinary code numbers are not flagged as personal data", async () => {
  const s = startServer({ OPENAI_API_KEY: FAKE_KEY });
  const r = await s.ask({ question: "Why?", context: "const ts = 1700000000000; const port = 8080;" });
  assert.equal(r.isError, false);
  s.stop();
});

test("input size and session call limits are enforced", async () => {
  const s = startServer({ OPENAI_API_KEY: FAKE_KEY, OPENAI_ADVISOR_MAX_INPUT_CHARS: "50", OPENAI_ADVISOR_MAX_CALLS_PER_SESSION: "1" });
  const big = await s.ask({ question: "x".repeat(51) });
  assert.match(big.content[0].text, /limit is 50/);
  assert.equal((await s.ask({ question: "one" })).isError, false);
  const second = await s.ask({ question: "two" });
  assert.match(second.content[0].text, /Session limit reached/);
  s.stop();
});

test("API errors are surfaced with the key scrubbed", async () => {
  const s = startServer({ OPENAI_API_KEY: FAKE_KEY });
  const r = await s.ask({ question: "FAIL" });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /401/);
  assert.ok(!r.content[0].text.includes(FAKE_KEY));
  s.stop();
});
