#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { homedir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "..");
const HOME = homedir();
const HOOKS_DIR = join(HOME, ".claude", "hooks");
const HOOKS_ENV = join(HOOKS_DIR, ".env");
const SETTINGS = join(HOME, ".claude", "settings.json");

const [cmd, hook] = process.argv.slice(2);

const HOOKS = {
  notify: {
    description: "AI-summarized notifications to Telegram, Slack, Discord, and ntfy",
    install(tsxBin) {
      const script = join(PACKAGE_ROOT, "hooks", "notify", "src", "notify.ts");
      const notifyCmd = `"${tsxBin}" "${script}"`;
      let settings = {};
      if (existsSync(SETTINGS)) {
        try { settings = JSON.parse(readFileSync(SETTINGS, "utf8")); } catch (e) {
          console.error(`Failed to parse ${SETTINGS}: ${e.message}\nFix the JSON syntax error and re-run.`);
          process.exit(1);
        }
      }
      settings.hooks ??= {};
      if (!Array.isArray(settings.hooks.Notification)) settings.hooks.Notification = [];
      settings.hooks.Notification = settings.hooks.Notification.filter(
        e => !e.hooks?.some(h => h.command?.includes("claude-hooks"))
      );
      settings.hooks.Notification.push({ matcher: "", hooks: [{ type: "command", command: notifyCmd }] });
      writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + "\n");
      console.log(`  Wired Notification hook into ${SETTINGS}`);
    },
    uninstall() {
      if (!existsSync(SETTINGS)) return;
      let settings = {};
      try { settings = JSON.parse(readFileSync(SETTINGS, "utf8")); } catch (e) {
        console.error(`Failed to parse ${SETTINGS}: ${e.message}`);
        process.exit(1);
      }
      settings.hooks ??= {};
      const prior = Array.isArray(settings.hooks.Notification) ? settings.hooks.Notification : [];
      const filtered = prior.filter(
        e => !e.hooks?.some(h => h.command?.includes("claude-hooks"))
      );
      if (filtered.length < prior.length) {
        if (filtered.length === 0) {
          delete settings.hooks.Notification;
          if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
        } else {
          settings.hooks.Notification = filtered;
        }
        writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + "\n");
        console.log("  Removed Notification hook.");
      } else {
        console.log("  Notification hook was not installed.");
      }
    },
  },
};

function printHelp() {
  console.log(`
claude-hooks — a collection of hooks for Claude Code

Commands:
  claude-hooks install <hook>    Install a hook
  claude-hooks uninstall <hook>  Uninstall a hook
  claude-hooks list              List available hooks

Available hooks:`);
  for (const [name, h] of Object.entries(HOOKS)) {
    console.log(`  ${name.padEnd(12)} ${h.description}`);
  }
  console.log(`
After install, edit ~/.claude/hooks/.env with your credentials.
`);
}

if (!cmd || cmd === "help") { printHelp(); process.exit(0); }

if (cmd === "list") {
  for (const [name, h] of Object.entries(HOOKS)) {
    console.log(`${name.padEnd(12)} ${h.description}`);
  }
  process.exit(0);
}

if (cmd === "install") {
  if (!hook) { console.error("Usage: claude-hooks install <hook>\nRun 'claude-hooks list' to see available hooks."); process.exit(1); }
  if (!Object.hasOwn(HOOKS, hook)) { console.error(`Unknown hook: ${hook}\nRun 'claude-hooks list' to see available hooks.`); process.exit(1); }

  console.log(`Installing ${hook} hook...`);
  mkdirSync(HOOKS_DIR, { recursive: true });
  if (!existsSync(HOOKS_ENV)) {
    try {
      copyFileSync(join(PACKAGE_ROOT, ".env.example"), HOOKS_ENV);
      console.log(`  Created ${HOOKS_ENV}`);
      console.log("  Fill in your credentials.");
    } catch (e) {
      console.error(`  Warning: could not create ${HOOKS_ENV}: ${e.message}`);
    }
  }

  const tsxBin = join(PACKAGE_ROOT, "node_modules", ".bin", "tsx");
  if (!existsSync(tsxBin)) {
    console.error(`tsx not found at ${tsxBin}\nRun 'npm install' inside the package directory first.`);
    process.exit(1);
  }
  HOOKS[hook].install(tsxBin);
  console.log(`\nDone. Restart Claude Code.\n`);
  process.exit(0);
}

if (cmd === "uninstall") {
  if (!hook) { console.error("Usage: claude-hooks uninstall <hook>\nRun 'claude-hooks list' to see available hooks."); process.exit(1); }
  if (!Object.hasOwn(HOOKS, hook)) { console.error(`Unknown hook: ${hook}\nRun 'claude-hooks list' to see available hooks.`); process.exit(1); }
  HOOKS[hook].uninstall();
  process.exit(0);
}

console.error(`Unknown command: ${cmd}. Run 'claude-hooks help' for usage.`);
process.exit(1);
