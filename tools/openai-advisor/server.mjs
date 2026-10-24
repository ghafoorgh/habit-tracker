#!/usr/bin/env node
// openai_advisor — a minimal, dependency-free MCP server (stdio transport)
// exposing one tool, `ask_openai`, backed by the OpenAI Responses API.
//
// Safety properties:
// - The API key is read only from process.env.OPENAI_API_KEY and is never
//   logged, echoed, or returned. Error text is scrubbed before it leaves.
// - Only the text Claude explicitly passes in `question`/`context` is sent.
//   Nothing reads files, the repository, or the conversation on its own.
// - Credentials found in the payload block the request outright.
//   Personal data (emails, phone numbers) blocks it unless the caller sets
//   `sensitive_data_approved: true` after asking the user.
// - Input size, output tokens, per-session calls and per-day calls are capped.
// - Requests are sent with `store: false`.

import { createInterface } from "node:readline";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const SERVER_NAME = "openai_advisor";
const SERVER_VERSION = "1.0.0";
const PROTOCOL_VERSION = "2025-06-18";

const intEnv = (name, fallback) => {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const config = {
  model: process.env.OPENAI_ADVISOR_MODEL || "gpt-5",
  baseUrl: (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, ""),
  maxInputChars: intEnv("OPENAI_ADVISOR_MAX_INPUT_CHARS", 20000),
  defaultOutputTokens: intEnv("OPENAI_ADVISOR_DEFAULT_OUTPUT_TOKENS", 1500),
  maxOutputTokens: intEnv("OPENAI_ADVISOR_MAX_OUTPUT_TOKENS", 4000),
  maxCallsPerSession: intEnv("OPENAI_ADVISOR_MAX_CALLS_PER_SESSION", 20),
  maxCallsPerDay: intEnv("OPENAI_ADVISOR_MAX_CALLS_PER_DAY", 50),
  timeoutMs: intEnv("OPENAI_ADVISOR_TIMEOUT_MS", 90000),
  usageFile:
    process.env.OPENAI_ADVISOR_USAGE_FILE ||
    join(homedir(), ".cache", "openai-advisor", "usage.json"),
};

const TASK_INSTRUCTIONS = {
  architecture_review:
    "You are a senior software architect. Review the proposed architecture. Identify risks, scalability and maintainability concerns, and concrete alternatives. Be specific and prioritise.",
  code_review:
    "You are a meticulous senior code reviewer. Find correctness bugs, security issues, and performance problems first; style last. Reference the code you are commenting on.",
  debugging:
    "You are an expert debugger. Form hypotheses ranked by likelihood, explain how to confirm or rule out each, and propose a minimal fix.",
  product_strategy:
    "You are a pragmatic product strategist. Give clear recommendations with trade-offs, risks, and how to measure success.",
  general: "You are a concise, expert technical advisor.",
};

// --- Sensitive content detection -------------------------------------------

const CREDENTIAL_PATTERNS = [
  ["OpenAI-style API key", /\bsk-[A-Za-z0-9_-]{20,}/],
  ["Anthropic API key", /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ["AWS access key", /\b(AKIA|ASIA)[0-9A-Z]{16}\b/],
  ["GitHub token", /\b(ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}/],
  ["Slack token", /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["Stripe key", /\b(sk|rk)_(live|test)_[A-Za-z0-9]{16,}/],
  ["Private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["JWT", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  [
    "Secret assignment",
    /\b[A-Za-z0-9_]*(api[_-]?key|secret|password|passwd|access[_-]?token|auth[_-]?token)\b\s*[:=]\s*["']?[^\s"'<>{}$]{8,}/i,
  ],
];

const PERSONAL_DATA_PATTERNS = [
  ["Email address", /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/],
  // International (+971 52 855 0000) or separated local (052-855-0000) numbers.
  ["Phone number", /(?<![\w+])\+\d{1,3}[\s.-]?(?:\(?\d{1,4}\)?[\s.-]?){2,5}\d{2,4}\b|\b\(?0?\d{2,3}\)?[\s.-]\d{3,4}[\s.-]\d{3,4}\b/],
];

// Payment card numbers, validated with the Luhn checksum to avoid flagging
// arbitrary long integers such as timestamps.
function hasCardNumber(text) {
  for (const m of text.matchAll(/\b(?:\d[ -]?){12,18}\d\b/g)) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19) continue;
    let sum = 0;
    for (let i = 0; i < digits.length; i++) {
      let d = Number(digits[digits.length - 1 - i]);
      if (i % 2 === 1) d = d * 2 > 9 ? d * 2 - 9 : d * 2;
      sum += d;
    }
    if (sum % 10 === 0) return true;
  }
  return false;
}

export function scanSensitive(text) {
  const hits = (patterns) => patterns.filter(([, re]) => re.test(text)).map(([label]) => label);
  const personal = hits(PERSONAL_DATA_PATTERNS);
  if (hasCardNumber(text)) personal.push("Payment card number");
  return { credentials: hits(CREDENTIAL_PATTERNS), personal };
}

// Strip anything key-like from text we return (errors, upstream messages).
export function scrub(text) {
  let out = String(text);
  const key = process.env.OPENAI_API_KEY;
  if (key) out = out.split(key).join("[REDACTED]");
  return out.replace(/\bsk-[A-Za-z0-9_-]{8,}/g, "sk-[REDACTED]");
}

// --- Usage limits ------------------------------------------------------------

let sessionCalls = 0;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function readDailyUsage() {
  try {
    const data = JSON.parse(readFileSync(config.usageFile, "utf8"));
    if (data.date === today()) return data;
  } catch {}
  return { date: today(), calls: 0, input_tokens: 0, output_tokens: 0 };
}

function writeDailyUsage(data) {
  try {
    mkdirSync(join(config.usageFile, ".."), { recursive: true });
    writeFileSync(config.usageFile, JSON.stringify(data));
  } catch {}
}

// --- OpenAI Responses API ----------------------------------------------------

export function extractOutputText(body) {
  if (typeof body?.output_text === "string") return body.output_text;
  const parts = [];
  for (const item of body?.output ?? []) {
    if (item?.type !== "message") continue;
    for (const c of item.content ?? []) {
      if (c?.type === "output_text" && typeof c.text === "string") parts.push(c.text);
      else if (c?.type === "refusal" && typeof c.refusal === "string") parts.push(`[refusal] ${c.refusal}`);
    }
  }
  return parts.join("\n");
}

async function callResponsesApi({ instructions, input, maxOutputTokens }) {
  const res = await fetch(`${config.baseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      instructions,
      input,
      max_output_tokens: maxOutputTokens,
      store: false,
    }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  const raw = await res.text();
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    body = null;
  }
  if (!res.ok) {
    const msg = body?.error?.message || raw.slice(0, 300) || res.statusText;
    throw new Error(`OpenAI API error ${res.status}: ${scrub(msg)}`);
  }
  return body;
}

// --- Tool --------------------------------------------------------------------

export const ASK_OPENAI_TOOL = {
  name: "ask_openai",
  title: "Ask OpenAI GPT for a second opinion",
  description: [
    "Send a focused question to OpenAI GPT (Responses API) for an architecture review, code review, debugging advice, or product strategy.",
    "Only the `question` and `context` you pass are sent — include just the relevant excerpt, never whole repositories, files you have not read, or the conversation transcript.",
    "Never include API keys, passwords, tokens or other secrets: requests containing them are rejected.",
    "If the text contains customer or personal data (names with contact details, emails, phone numbers, financial data), you MUST ask the user for explicit approval first and only then set sensitive_data_approved to true.",
    "Calls cost money and are rate-limited per session and per day; use sparingly.",
  ].join(" "),
  inputSchema: {
    type: "object",
    properties: {
      question: { type: "string", description: "The specific question for GPT." },
      task_type: {
        type: "string",
        enum: Object.keys(TASK_INSTRUCTIONS),
        default: "general",
        description: "Kind of advice requested; selects the advisor's system instructions.",
      },
      context: {
        type: "string",
        description: "Optional minimal supporting material (code excerpt, error log, design notes).",
      },
      max_output_tokens: {
        type: "integer",
        minimum: 64,
        description: "Optional cap on the answer length (server enforces an upper limit).",
      },
      sensitive_data_approved: {
        type: "boolean",
        default: false,
        description: "Set true ONLY after the user explicitly approved sending personal/customer data in this request.",
      },
    },
    required: ["question"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
};

const textResult = (text, isError = false) => ({ content: [{ type: "text", text }], isError });

export async function askOpenai(args = {}) {
  const question = typeof args.question === "string" ? args.question.trim() : "";
  const context = typeof args.context === "string" ? args.context : "";
  const taskType = TASK_INSTRUCTIONS[args.task_type] ? args.task_type : "general";
  if (!question) return textResult("`question` is required.", true);

  if (!process.env.OPENAI_API_KEY) {
    return textResult(
      "OPENAI_API_KEY is not set in this environment. Add it as a secret environment variable and restart the session; do not paste it into chat.",
      true,
    );
  }

  const input = context ? `${question}\n\n--- Context ---\n${context}` : question;
  if (input.length > config.maxInputChars) {
    return textResult(
      `Request is ${input.length} characters; the limit is ${config.maxInputChars}. Send a smaller, more focused excerpt.`,
      true,
    );
  }

  const { credentials, personal } = scanSensitive(input);
  if (credentials.length) {
    return textResult(
      `Blocked: the request appears to contain secrets (${credentials.join(", ")}). Remove or replace them with placeholders and try again. Nothing was sent.`,
      true,
    );
  }
  if (personal.length && args.sensitive_data_approved !== true) {
    return textResult(
      `Approval required: the request appears to contain personal or customer data (${personal.join(", ")}). Ask the user for explicit approval, or redact it, before retrying. Nothing was sent.`,
      true,
    );
  }

  if (sessionCalls >= config.maxCallsPerSession) {
    return textResult(`Session limit reached (${config.maxCallsPerSession} calls). Nothing was sent.`, true);
  }
  const usage = readDailyUsage();
  if (usage.calls >= config.maxCallsPerDay) {
    return textResult(`Daily limit reached (${config.maxCallsPerDay} calls). Nothing was sent.`, true);
  }

  const requested = Number.isInteger(args.max_output_tokens) ? args.max_output_tokens : config.defaultOutputTokens;
  const maxOutputTokens = Math.min(Math.max(requested, 64), config.maxOutputTokens);

  sessionCalls += 1;
  usage.calls += 1;
  writeDailyUsage(usage);

  let body;
  try {
    body = await callResponsesApi({ instructions: TASK_INSTRUCTIONS[taskType], input, maxOutputTokens });
  } catch (err) {
    const reason = err?.name === "TimeoutError" ? `timed out after ${config.timeoutMs} ms` : err?.message;
    return textResult(`OpenAI request failed: ${scrub(reason ?? "unknown error")}`, true);
  }

  usage.input_tokens += body?.usage?.input_tokens ?? 0;
  usage.output_tokens += body?.usage?.output_tokens ?? 0;
  writeDailyUsage(usage);

  const answer = extractOutputText(body).trim();
  const meta = [
    `model: ${body?.model ?? config.model}`,
    `status: ${body?.status ?? "unknown"}`,
    body?.incomplete_details?.reason ? `incomplete: ${body.incomplete_details.reason}` : null,
    `tokens in/out: ${body?.usage?.input_tokens ?? "?"}/${body?.usage?.output_tokens ?? "?"}`,
    `calls this session: ${sessionCalls}/${config.maxCallsPerSession}, today: ${usage.calls}/${config.maxCallsPerDay}`,
  ]
    .filter(Boolean)
    .join(" | ");

  if (!answer) return textResult(`GPT returned no text output. (${meta})`, true);
  return textResult(`${answer}\n\n---\n[openai_advisor] ${meta}`);
}

// --- MCP JSON-RPC over stdio -------------------------------------------------

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function handle(msg) {
  const { id, method, params } = msg;
  const isRequest = id !== undefined && id !== null;
  const reply = (result) => isRequest && send({ jsonrpc: "2.0", id, result });
  const fail = (code, message) => isRequest && send({ jsonrpc: "2.0", id, error: { code, message } });

  switch (method) {
    case "initialize":
      return reply({
        protocolVersion: params?.protocolVersion || PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: [ASK_OPENAI_TOOL] });
    case "tools/call":
      if (params?.name !== ASK_OPENAI_TOOL.name) return fail(-32602, `Unknown tool: ${params?.name}`);
      return reply(await askOpenai(params?.arguments));
    default:
      if (method?.startsWith("notifications/")) return;
      return fail(-32601, `Method not found: ${method}`);
  }
}

function main() {
  const rl = createInterface({ input: process.stdin });
  rl.on("line", (line) => {
    if (!line.trim()) return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
    }
    handle(msg).catch((err) =>
      send({ jsonrpc: "2.0", id: msg.id ?? null, error: { code: -32603, message: scrub(err?.message ?? err) } }),
    );
  });
  rl.on("close", () => process.exit(0));
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) main();
