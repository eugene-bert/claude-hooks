import { readFileSync } from "fs";
import { TelegramChannel } from "./channels/telegram.js";
import type { Channel } from "./channels/index.js";

function loadDotEnv(): void {
  const envFile = `${process.env.HOME}/.claude/hooks/.env`;
  try {
    const lines = readFileSync(envFile, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      process.env[key] ??= val;
    }
  } catch {
    // .env optional
  }
}

function buildChannel(): Channel | null {
  const ch = (process.env.NOTIFY_CHANNEL ?? "telegram").toLowerCase();
  if (ch === "telegram") {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return null;
    return new TelegramChannel(token, chatId);
  }
  return null;
}

async function main(): Promise<void> {
  loadDotEnv();

  const channel = buildChannel();
  if (!channel) {
    process.stderr.write("claude-hooks: no channel configured, skipping\n");
    process.exit(0);
  }

  await channel.send("⚡ Claude Code needs your attention");
}

main().catch((err) => {
  process.stderr.write(`claude-hooks error: ${err.message}\n`);
  process.exit(1);
});
