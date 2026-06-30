#!/usr/bin/env bash
set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOKS_ENV="$HOME/.claude/hooks/.env"
SETTINGS="$HOME/.claude/settings.json"
NOTIFY_SCRIPT="$REPO_DIR/hooks/notify/src/notify.ts"
NOTIFY_CMD="npx --yes tsx $NOTIFY_SCRIPT"

echo "Installing claude-hooks..."

# 1. Install notify dependencies
cd "$REPO_DIR/hooks/notify" && npm install
cd "$REPO_DIR"

# 2. Create .env if missing
mkdir -p "$HOME/.claude/hooks"
if [ ! -f "$HOOKS_ENV" ]; then
  cp "$REPO_DIR/.env.example" "$HOOKS_ENV"
  echo ""
  echo "  Created $HOOKS_ENV"
  echo "  Fill in your TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID"
fi

# 3. Wire Notification hook into settings.json
node - "$SETTINGS" "$NOTIFY_CMD" <<'EOF'
const fs = require("fs");
const [,, settingsPath, cmd] = process.argv;
const s = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
s.hooks ??= {};
s.hooks.Notification = [{ matcher: "", hooks: [{ type: "command", command: cmd }] }];
fs.writeFileSync(settingsPath, JSON.stringify(s, null, 2) + "\n");
console.log("  Wired Notification hook into", settingsPath);
EOF

echo ""
echo "Done. Restart Claude Code."
