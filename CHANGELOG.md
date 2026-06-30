# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-06-30

### Added
- Smart prompt: detects done / waiting / blocked situation from last assistant message
- Session context in notifications: project name, git branch, task duration
- Discord channel support via Incoming Webhooks
- ntfy channel support (self-hosted or ntfy.sh)
- Per-channel HTML/Markdown formatting (Telegram uses `<code>`, Slack/Discord use backticks)
- Custom summary prompt via `CLAUDE_NOTIFY_PROMPT_FILE` or `CLAUDE_NOTIFY_PROMPT`
- Unit tests (32 passing)
- GitHub Actions CI
- npm package `@eugene-bert/claude-hooks`

### Changed
- Structured `Notification` object passed to channels instead of raw string
- All configured channels now receive notifications simultaneously (multi-channel)
- Channel errors are isolated — one failing channel does not block others

## [0.1.0] - 2026-06-28

### Added
- Initial release
- Telegram channel via Bot API
- Slack channel via Incoming Webhooks
- AI summarization with provider auto-detection (Ollama, OpenRouter, Bedrock, Vertex, Anthropic API)
- `install.sh` setup script
