# claude-hooks

[![Test](https://github.com/eugene-bert/claude-hooks/actions/workflows/test.yml/badge.svg)](https://github.com/eugene-bert/claude-hooks/actions/workflows/test.yml)
[![npm](https://img.shields.io/npm/v/@eugene-bert/claude-hooks)](https://www.npmjs.com/package/@eugene-bert/claude-hooks)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Claude Code hooks that send AI-summarized notifications to Telegram, Slack, and Discord when Claude finishes a task.

![Notification example](assets/notification-example.png)

## What it does

When Claude Code completes work and waits for your input, you get a notification with an AI-generated summary of what was done — not just a raw list of tool calls.

**Example message:**
> ⚡ Configured nginx reverse proxy for the API service, updated docker-compose.yml, and committed changes to main branch.

## Installation

```bash
npx @eugene-bert/claude-hooks install
```

Then edit `~/.claude/hooks/.env` and fill in your channel credentials.

Or clone manually:
```bash
git clone https://github.com/eugene-bert/claude-hooks
cd claude-hooks
bash install.sh
```

## Channels

Configure any combination — all active channels receive notifications simultaneously.

### Telegram

1. Message [@BotFather](https://t.me/botfather) → `/newbot`
2. Copy the token
3. Start a chat with your bot, then get your chat ID:
   ```bash
   curl https://api.telegram.org/bot<TOKEN>/getUpdates
   ```
4. Add to `.env`:
   ```env
   TELEGRAM_BOT_TOKEN=your_token
   TELEGRAM_CHAT_ID=your_chat_id
   ```

### Slack

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**
2. **Incoming Webhooks** → **Activate** → **Add New Webhook to Workspace**
3. Add to `.env`:
   ```env
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
   ```

### ntfy

The easiest option — no account, no bot, no token.

1. Install the [ntfy app](https://ntfy.sh) on your phone
2. Pick any topic name (e.g. `my-claude-123`)
3. Add to `.env`:
   ```env
   NTFY_TOPIC=my-claude-123
   # NTFY_SERVER=https://your-self-hosted-ntfy.com  # optional
   ```

> **Note:** ntfy.sh topics are public by default. Use a long random name or self-host for privacy.

### Discord

1. In your Discord server: right-click a channel → **Edit Channel** → **Integrations** → **Webhooks** → **New Webhook**
2. Copy the webhook URL
3. Add to `.env`:
   ```env
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
   ```

## AI Summary

By default, notifications include an AI-generated summary of what Claude did. Supports multiple LLM providers — pick one:

| Provider | Env vars needed | Cost |
|----------|----------------|------|
| Ollama | `OLLAMA_HOST` | Free (local) |
| OpenRouter | `OPENROUTER_API_KEY` | Pay per use |
| AWS Bedrock | `AWS_ACCESS_KEY_ID` or `AWS_PROFILE` | Pay per use |
| Google Vertex AI | `ANTHROPIC_VERTEX_PROJECT_ID` | Pay per use |
| Anthropic API | `ANTHROPIC_API_KEY` | Pay per use |

If no LLM is configured, notifications fall back to a plain list of tool calls.

### Custom prompt

Override the summary prompt via a file:

```env
CLAUDE_NOTIFY_PROMPT_FILE=/path/to/prompt.txt
```

Prompt format — use `{{TOOL_CALLS}}` as placeholder:

```
Summarize what the AI assistant did in one sentence in French.

{{TOOL_CALLS}}
```

Or a single-line prompt via env:
```env
CLAUDE_NOTIFY_PROMPT=Summarize in one sentence: {{TOOL_CALLS}}
```

## Configuration reference

```env
# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Slack
SLACK_WEBHOOK_URL=

# Discord
DISCORD_WEBHOOK_URL=

# LLM provider (pick one)
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.2

OPENROUTER_API_KEY=
OPENROUTER_MODEL=anthropic/claude-haiku-4-5

AWS_REGION=us-east-1

ANTHROPIC_VERTEX_PROJECT_ID=
ANTHROPIC_VERTEX_REGION=us-east5

ANTHROPIC_API_KEY=

# Custom summary prompt
CLAUDE_NOTIFY_PROMPT_FILE=
CLAUDE_NOTIFY_PROMPT=
```

## How it works

The `Notification` hook in Claude Code fires when Claude finishes a task and wants your attention. This hook:

1. Reads the session transcript
2. Extracts the last 10 tool calls
3. Sends them to the configured LLM for summarization
4. Posts the summary to all configured channels

## License

MIT
