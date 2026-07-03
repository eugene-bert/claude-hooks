# notify

[![Test](https://github.com/eugene-bert/claude-hooks/actions/workflows/test.yml/badge.svg)](https://github.com/eugene-bert/claude-hooks/actions/workflows/test.yml)

AI-summarized notifications when Claude Code finishes a task — sent to Telegram, Slack, Discord, ntfy, or macOS.

## What it does

Fires on the `Notification` event (when Claude finishes and waits for input). Reads the session transcript, extracts the last tool calls and assistant message, detects the situation, and sends a formatted summary.

**Examples:**
> ⚡ `drone · main · 4m` Configured nginx reverse proxy for the API service, updated docker-compose.yml, and committed changes to main branch.

> ⏳ `drone · main · 2m` Waiting: need to know which port to use for the API service.

> 🚫 `drone · main · 1m` Blocked: npm install failed due to missing permissions.

## Installation

```bash
npx @eugene-bert/claude-hooks install notify
```

Then edit `~/.claude/hooks/.env` with your channel credentials (see `.env.example`).

## Channels

### Telegram
1. Message [@BotFather](https://t.me/botfather) → `/newbot`
2. Get your chat ID: `curl https://api.telegram.org/bot<TOKEN>/getUpdates`
3. Add to `.env`: `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`

### Slack (Webhook)
1. [api.slack.com/apps](https://api.slack.com/apps) → Incoming Webhooks → New Webhook
2. Add to `.env`: `SLACK_WEBHOOK_URL`

### Slack (Bot Token)
1. OAuth & Permissions → add `chat:write` → Install → copy token
2. Add to `.env`: `SLACK_BOT_TOKEN` + `SLACK_BOT_CHANNEL`

### Discord
1. Channel settings → Integrations → Webhooks → New Webhook
2. Add to `.env`: `DISCORD_WEBHOOK_URL`

### ntfy
1. Install [ntfy app](https://ntfy.sh), pick a topic name
2. Add to `.env`: `NTFY_TOPIC` (optionally `NTFY_SERVER` for self-hosted)

### macOS
```env
MACOS_NOTIFICATIONS=true
MACOS_FOCUS_TERMINAL=true    # optional
MACOS_TERMINAL_APP=iTerm2    # optional, auto-detected
```
Supported terminals: Ghostty, iTerm2, Terminal, Warp, Alacritty, kitty, Hyper.

## AI Summary

Sends tool calls + last message to an LLM which determines: finished / waiting / blocked.

| Provider | Env vars | Cost |
|----------|----------|------|
| Ollama | `OLLAMA_HOST` | Free (local) |
| OpenRouter | `OPENROUTER_API_KEY` | Pay per use |
| AWS Bedrock | `AWS_ACCESS_KEY_ID` or `AWS_PROFILE` | Pay per use |
| Google Vertex AI | `ANTHROPIC_VERTEX_PROJECT_ID` | Pay per use |
| Anthropic API | `ANTHROPIC_API_KEY` | Pay per use |

Falls back to plain tool call list if no LLM is configured.

### Custom prompt

```env
CLAUDE_NOTIFY_PROMPT_FILE=/path/to/prompt.txt
```

Placeholders: `{{TOOL_CALLS}}` and `{{LAST_MESSAGE}}`.

## Configuration

See [`.env.example`](.env.example) for all available variables.
