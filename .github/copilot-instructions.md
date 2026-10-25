# Copilot Instructions

Claude Code hooks — AI-summarized notifications to Telegram, Slack, Discord, and model tier advisor.

See [CLAUDE.md](../CLAUDE.md) for full architecture and [CONTRIBUTING.md](../CONTRIBUTING.md) for build/test/release.

## Key Points

- Three hooks: `notify` (Notification event), `advisor` (UserPromptSubmit), `session-color` (SessionStart)
- ESM + TypeScript via `tsx`, no compile step
- npm workspaces — root publishes to npm, hooks are `private: true`
- Tests: `npm test --workspace=claude-hooks-notify` (node:test, not Jest)
- Release: `npm version` at root → push `v*` tag → CI publishes to npm
- Env vars from `~/.claude/hooks/.env` via `loadDotEnv()`
- `bin/cli.js` installs hooks into `~/.claude/settings.json`
