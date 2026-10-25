# Contributing

## Prerequisites

- Node.js 24+
- npm

## Setup

```bash
npm ci                          # install all workspace deps
```

## Development

No build step — ESM + TypeScript run via `tsx` directly.

```bash
npm test --workspace=claude-hooks-notify   # run notify tests
```

Run a single test:
```bash
node --import tsx/esm --test hooks/notify/src/notify.test.ts
```

## Project Structure

```
hooks/
  notify/     — Notification hook (LLM classify → Telegram/Slack/Discord)
  advisor/    — UserPromptSubmit hook (model tier recommendation)
  session-color/ — SessionStart hook (terminal tab color)
bin/
  cli.js      — Installer (wires hooks into ~/.claude/settings.json)
```

## Release

1. `npm version <patch|minor|major>` at root (auto-syncs workspace package.json files)
2. Push the tag: `git push origin v<version>`
3. CI publishes to npm + creates GitHub Release

Tag format: `v*` (e.g. `v1.2.3`)

## Key Conventions

- ESM throughout (`"type": "module"`)
- TypeScript via `tsx` (no compile step)
- Both hooks are `private: true` workspaces; only root publishes to npm
- Env vars loaded from `~/.claude/hooks/.env` via `loadDotEnv()`
- `notify` has tests; `advisor` and `session-color` do not
