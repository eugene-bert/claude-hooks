# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm ci                                          # install all workspace deps
npm test --workspace=claude-hooks-notify        # run notify tests
npm run notify --workspace=claude-hooks-notify  # run notify hook manually (requires stdin JSON)
```

Tests use Node's built-in test runner (`node --import tsx/esm --test`), not Jest/Vitest. Run a single file: `node --import tsx/esm --test hooks/notify/src/notify.test.ts`.

Releasing: bump version with `npm version <patch|minor|major>` at root — the `version` script auto-syncs both workspace `package.json` files. Push the tag; CI publishes to npm.

## Architecture

Two independent hooks, each a self-contained directory under `hooks/`:

**`hooks/notify/`** — fires on `Notification` event (Claude finished, waiting for input). Flow: reads transcript JSONL → extracts last tool calls + assistant message → calls LLM to classify as finished/waiting/blocked → dispatches to configured channels. Each channel (`telegram`, `slack`, `slack-bot`, `discord`, `ntfy`, `macos`) implements the `Channel` interface from `channels/index.ts`. LLM provider is selected by env vars (Ollama → OpenRouter → Bedrock/Vertex/Anthropic API).

**`hooks/advisor/`** — fires on `UserPromptSubmit`. Classifies the incoming prompt into haiku/sonnet/opus tier using a small LLM, compares to current model (read from `~/.claude/settings.json`), and emits a `hookSpecificOutput` system instruction telling Claude to display a switch recommendation. Results cached for 7 days at `~/.claude/model-advisor-cache.json` by SHA-256 of prompt.

**`bin/cli.js`** — the `claude-hooks` installer. Reads/writes `~/.claude/settings.json` to wire hooks, creates `~/.claude/hooks/.env` from `.env.example`. No build step — runs directly as ESM.

Both hooks share the same pattern: `loadDotEnv()` reads `~/.claude/hooks/.env` before checking `process.env`, so env vars in that file take effect without shell export.

## Key conventions

- ESM throughout (`"type": "module"`), TypeScript run via `tsx` (no compile step).
- Both hooks are `private: true` workspaces; only the root package publishes to npm.
- `notify` has tests; `advisor` does not — keep them separate when adding tests.
