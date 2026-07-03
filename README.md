# claude-hooks

[![Test](https://github.com/eugene-bert/claude-hooks/actions/workflows/test.yml/badge.svg)](https://github.com/eugene-bert/claude-hooks/actions/workflows/test.yml)
[![npm](https://img.shields.io/npm/v/@eugene-bert/claude-hooks)](https://www.npmjs.com/package/@eugene-bert/claude-hooks)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A collection of hooks for [Claude Code](https://claude.ai/code) that extend its behavior.

## Hooks

| Hook | Event | Description |
|------|-------|-------------|
| [notify](hooks/notify/) | `Notification` | AI-summarized notifications to Telegram, Slack, Discord, ntfy, and macOS |
| [advisor](hooks/advisor/) | `UserPromptSubmit` | Recommends switching Claude model tier based on task complexity |

## Installation

```bash
npx @eugene-bert/claude-hooks install notify
npx @eugene-bert/claude-hooks install advisor
```

See each hook's README for setup details and configuration.

## License

MIT
