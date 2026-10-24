// Live end-to-end check: starts the MCP server over stdio exactly as Claude Code
// does, then makes ONE small real request to the OpenAI Responses API.
// Usage: NODE_USE_ENV_PROXY=1 node tools/openai-advisor/check-connection.mjs
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const server = spawn(process.execPath, [fileURLToPath(new URL("./server.mjs", import.meta.url))], {
  stdio: ["pipe", "pipe", "inherit"],
});

const pending = new Map();
let buf = "";
server.stdout.on("data", (chunk) => {
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
    server.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });

const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "check" } });
console.log(`MCP server: ${init.result.serverInfo.name} ${init.result.serverInfo.version}`);
const { result } = await rpc("tools/call", {
  name: "ask_openai",
  arguments: { question: "Reply with exactly: OPENAI_ADVISOR_OK", max_output_tokens: 64 },
});
console.log(result.content[0].text);
server.kill();
process.exit(!result.isError && result.content[0].text.includes("OPENAI_ADVISOR_OK") ? 0 : 1);
