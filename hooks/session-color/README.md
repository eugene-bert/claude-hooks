# session-color

Auto-tints your terminal tab and background when a Claude Code session starts — each project directory gets a deterministic color, so you can tell sessions apart at a glance.

## Features

- **iTerm2**: sets tab color + subtle background tint + optional badge
- **Any terminal**: sets tab/window title to `claude: <project>`
- Deterministic: same directory = same color, every time
- Zero dependencies, runs in <100ms

## How it works

On `SessionStart`, the hook hashes your working directory to pick one of 10 distinct colors. It finds the terminal's pty device by walking up the process tree, then writes iTerm2 proprietary escape sequences directly to the pty — bypassing Claude Code's TUI, which would otherwise swallow them.

## Configuration

All env vars go in `~/.claude/hooks/.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `SESSION_COLOR_ENABLED` | `true` | Set `false` to disable |
| `SESSION_COLOR_TERMINAL` | `auto` | `auto`, `iterm2`, `basic`, or `none` |
| `SESSION_COLOR_BG` | `true` | Tint background color |
| `SESSION_COLOR_BG_STRENGTH` | `0.12` | How much accent mixes into background (0.0–1.0) |
| `SESSION_COLOR_BADGE` | `false` | Show project name as iTerm2 badge (opt-in) |
| `SESSION_COLOR_TITLE` | `true` | Set terminal title to `claude: <project>` |

## Color palette

| Index | Color | RGB |
|-------|-------|-----|
| 0 | Red | 255, 80, 80 |
| 1 | Blue | 80, 140, 255 |
| 2 | Green | 80, 220, 100 |
| 3 | Yellow | 240, 200, 60 |
| 4 | Magenta | 220, 80, 200 |
| 5 | Cyan | 60, 220, 220 |
| 6 | Orange | 255, 140, 50 |
| 7 | Violet | 150, 100, 255 |
| 8 | Teal | 60, 200, 180 |
| 9 | Coral | 255, 120, 100 |

The color is determined by `MD5(cwd) mod 10`.
