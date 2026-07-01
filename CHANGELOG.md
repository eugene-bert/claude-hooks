# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.6] - 2026-07-01

### Added
- Automated GitHub Releases via GitHub Actions on tag push
- CHANGELOG entries for 0.1.3–0.1.5

### Fixed
- `.claude/settings.local.json` excluded from npm package

## [0.1.5] - 2026-07-01

### Added
- Dynamic emoji per notification type: ⚡ done / ⏳ waiting / 🚫 blocked
- `[type]` keyword tag in messages for Slack notification filtering
- Slack Bot Token channel (`SLACK_BOT_TOKEN` + `SLACK_BOT_CHANNEL`) — supports DMs
- `notification_type` field in `HookInput` type
- Automated GitHub Releases via GitHub Actions on tag push

### Changed
- Default prompt detects situation (done / waiting / blocked) from last assistant message
- Per-channel formatting updated to use `emoji` and `type` fields from `Notification`

### Fixed
- CLI `install`: merge existing Notification hooks instead of overwriting
- CLI `uninstall`: filter only claude-hooks entry, preserve other hooks
- Multiple edge cases in `bin/cli.js` (array guards, error messages, path quoting)
- `content[0]` unsafe access in all LLM providers

## [0.1.4] - 2026-07-01

### Added
- Slack Bot Token channel (`SLACK_BOT_TOKEN` + `SLACK_BOT_CHANNEL`)
- Notification screenshots (Slack, Telegram) in README

## [0.1.3] - 2026-07-01

### Changed
- CLI refactored to multi-hook architecture: `claude-hooks install <hook>` / `claude-hooks uninstall <hook>` / `claude-hooks list`

## [0.1.2] - 2026-06-30

### Added
- ntfy channel support — no account needed (`NTFY_TOPIC`, `NTFY_SERVER`)
- ntfy documented in README configuration reference

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
