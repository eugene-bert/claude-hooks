#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { homedir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "..");
const HOME = homedir();
const HOOKS_DIR = join(HOME, ".claude", "hooks");
const HOOKS_ENV = join(HOOKS_DIR, ".env");
const SETTINGS = join(HOME, ".claude", "settings.json");
const CLAUDE_MD = join(HOME, ".claude", "CLAUDE.md");

const [cmd, hook] = process.argv.slice(2);

function readSettings() {
  if (!existsSync(SETTINGS)) return {};
  try { return JSON.parse(readFileSync(SETTINGS, "utf8")); } catch (e) {
    console.error(`Failed to parse ${SETTINGS}: ${e.message}\nFix the JSON syntax error and re-run.`);
    process.exit(1);
  }
}

function writeSettings(settings) {
  writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + "\n");
}

function copyEnvExample(hookName) {
  const example = join(PACKAGE_ROOT, "hooks", hookName, ".env.example");
  if (!existsSync(example)) return;
  if (!existsSync(HOOKS_ENV)) {
    writeFileSync(HOOKS_ENV, readFileSync(example, "utf8"));
    console.log(`  Created ${HOOKS_ENV} from .env.example`);
    console.log("  Fill in your credentials.");
  } else {
    console.log(`  ${HOOKS_ENV} already exists — see hooks/${hookName}/.env.example for variables to add.`);
  }
}

const HOOKS = {
  notify: {
    description: "AI-summarized notifications to Telegram, Slack, Discord, ntfy, and macOS",
    install(tsxBin) {
      const script = join(PACKAGE_ROOT, "hooks", "notify", "src", "notify.ts");
      const notifyCmd = `"${tsxBin}" "${script}"`;
      const settings = readSettings();
      settings.hooks ??= {};
      if (!Array.isArray(settings.hooks.Notification)) settings.hooks.Notification = [];
      settings.hooks.Notification = settings.hooks.Notification.filter(
        e => !e.hooks?.some(h => h.command?.includes("notify.ts"))
      );
      settings.hooks.Notification.push({ matcher: "", hooks: [{ type: "command", command: notifyCmd }] });
      writeSettings(settings);
      console.log(`  Wired Notification hook into ${SETTINGS}`);
    },
    uninstall() {
      const settings = readSettings();
      settings.hooks ??= {};
      const prior = Array.isArray(settings.hooks.Notification) ? settings.hooks.Notification : [];
      const filtered = prior.filter(e => !e.hooks?.some(h => h.command?.includes("notify.ts")));
      if (filtered.length < prior.length) {
        if (filtered.length === 0) {
          delete settings.hooks.Notification;
          if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
        } else {
          settings.hooks.Notification = filtered;
        }
        writeSettings(settings);
        console.log("  Removed Notification hook.");
      } else {
        console.log("  Notification hook was not installed.");
      }
    },
  },

  advisor: {
    description: "Recommends switching Claude model tier based on task complexity",
    install(tsxBin) {
      const script = join(PACKAGE_ROOT, "hooks", "advisor", "src", "model-advisor.ts");
      const advisorCmd = `"${tsxBin}" "${script}"`;
      const settings = readSettings();
      settings.hooks ??= {};
      if (!Array.isArray(settings.hooks.UserPromptSubmit)) settings.hooks.UserPromptSubmit = [];
      settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit.filter(
        e => !e.hooks?.some(h => h.command?.includes("model-advisor.ts"))
      );
      settings.hooks.UserPromptSubmit.push({
        hooks: [{ type: "command", command: advisorCmd, timeout: 8, statusMessage: "Analyzing task complexity..." }],
      });
      writeSettings(settings);
      console.log(`  Wired UserPromptSubmit hook into ${SETTINGS}`);
    },
    uninstall() {
      const settings = readSettings();
      settings.hooks ??= {};
      const prior = Array.isArray(settings.hooks.UserPromptSubmit) ? settings.hooks.UserPromptSubmit : [];
      const filtered = prior.filter(e => !e.hooks?.some(h => h.command?.includes("model-advisor.ts")));
      if (filtered.length < prior.length) {
        if (filtered.length === 0) {
          delete settings.hooks.UserPromptSubmit;
          if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
        } else {
          settings.hooks.UserPromptSubmit = filtered;
        }
        writeSettings(settings);
        console.log("  Removed UserPromptSubmit hook.");
        console.log(`  Note: manually remove the model-advisor section from ${CLAUDE_MD} if desired.`);
      } else {
        console.log("  Advisor hook was not installed.");
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
  copyEnvExample(hook);

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
