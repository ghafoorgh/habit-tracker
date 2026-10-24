# openai_advisor (MCP server)

A dependency-free MCP server that lets Claude Code ask OpenAI GPT for a second
opinion through the **Responses API** (`POST /v1/responses`). It is registered
for this project in `/.mcp.json`. It is dev tooling only and is not part of the app bundle.

## Tool: `ask_openai`

| Argument | Notes |
|---|---|
| `question` (required) | The specific question. |
| `task_type` | `architecture_review`, `code_review`, `debugging`, `product_strategy` or `general`. |
| `context` | A small excerpt only (code, logs, notes). |
| `max_output_tokens` | Capped by the server. |
| `sensitive_data_approved` | Set `true` only after the user approves sending personal or customer data. |

## Safeguards

- The key comes only from the `OPENAI_API_KEY` environment variable. It is never logged or returned, and error text is scrubbed.
- Only what Claude passes in `question`/`context` is sent. The server never reads files, the repo or the conversation.
- Secrets (API keys, tokens, private keys, `password=` style assignments) are **always blocked**.
- Emails, phone numbers and payment-card numbers are blocked unless `sensitive_data_approved: true` is set.
- Requests use `store: false`.
- Claude Code asks for permission before each tool call unless you allow-list it.

## Limits (environment variables)

| Variable | Default |
|---|---|
| `OPENAI_ADVISOR_MODEL` | `gpt-5` |
| `OPENAI_ADVISOR_MAX_INPUT_CHARS` | `20000` |
| `OPENAI_ADVISOR_DEFAULT_OUTPUT_TOKENS` | `1500` |
| `OPENAI_ADVISOR_MAX_OUTPUT_TOKENS` | `4000` |
| `OPENAI_ADVISOR_MAX_CALLS_PER_SESSION` | `20` |
| `OPENAI_ADVISOR_MAX_CALLS_PER_DAY` | `50` (counted in `~/.cache/openai-advisor/usage.json`) |
| `OPENAI_ADVISOR_TIMEOUT_MS` | `90000` |

For a hard spend ceiling, also set a monthly budget limit on the OpenAI project that owns the key.

## Testing

```bash
node --test tools/openai-advisor/server.test.mjs            # offline, uses a mock API
NODE_USE_ENV_PROXY=1 node tools/openai-advisor/check-connection.mjs   # one real request (needs key + network)
```
