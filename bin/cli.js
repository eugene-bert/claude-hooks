#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "fs";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import { homedir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(__dirname, "..");
const HOME = homedir();
const HOOKS_DIR = join(HOME, ".claude", "hooks");
const HOOKS_ENV = join(HOOKS_DIR, ".env");
const SETTINGS = join(HOME, ".claude", "settings.json");

const cmd = process.argv[2];

if (!cmd || cmd === "help") {
  console.log(`
claude-hooks — AI-summarized notifications for Claude Code

Commands:
  claude-hooks install   Wire the Notification hook into Claude Code
  claude-hooks uninstall Remove the hook from Claude Code

After install, edit ~/.claude/hooks/.env with your channel credentials.
`);
  process.exit(0);
}

if (cmd === "install") {
  console.log("Installing claude-hooks...");

  // 1. Create hooks dir and .env
  mkdirSync(HOOKS_DIR, { recursive: true });
  if (!existsSync(HOOKS_ENV)) {
    copyFileSync(join(PACKAGE_ROOT, ".env.example"), HOOKS_ENV);
    console.log(`  Created ${HOOKS_ENV}`);
    console.log("  Fill in your TELEGRAM_BOT_TOKEN and/or SLACK_WEBHOOK_URL / DISCORD_WEBHOOK_URL");
  }

  // 2. Find tsx binary (bundled with this package)
  const tsxBin = join(PACKAGE_ROOT, "node_modules", ".bin", "tsx");
  const notifyScript = join(PACKAGE_ROOT, "hooks", "notify", "src", "notify.ts");
  const notifyCmd = `${tsxBin} ${notifyScript}`;

  // 3. Wire hook into settings.json
  let settings = {};
  if (existsSync(SETTINGS)) {
    try { settings = JSON.parse(readFileSync(SETTINGS, "utf8")); } catch {}
  }
  settings.hooks ??= {};
  settings.hooks.Notification = [{ matcher: "", hooks: [{ type: "command", command: notifyCmd }] }];
  writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + "\n");
  console.log(`  Wired Notification hook into ${SETTINGS}`);

  console.log("\nDone. Restart Claude Code.\n");
  process.exit(0);
}

if (cmd === "uninstall") {
  if (!existsSync(SETTINGS)) {
    console.log("settings.json not found, nothing to do.");
    process.exit(0);
  }
  let settings = {};
  try { settings = JSON.parse(readFileSync(SETTINGS, "utf8")); } catch {}
  if (settings.hooks?.Notification) {
    delete settings.hooks.Notification;
    writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + "\n");
    console.log("Removed Notification hook from settings.json.");
  } else {
    console.log("Hook not found in settings.json.");
  }
  process.exit(0);
}

console.error(`Unknown command: ${cmd}. Run 'claude-hooks help' for usage.`);
process.exit(1);
