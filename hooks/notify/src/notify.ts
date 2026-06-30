import { readFileSync } from "fs";
import { TelegramChannel } from "./channels/telegram.js";
import { summarizeActions } from "./summarize.js";
import type { Channel } from "./channels/index.js";

interface HookInput {
  session_id?: string;
  transcript_path?: string;
  message?: string;
  title?: string;
}

interface TranscriptEntry {
  message?: {
    role?: string;
    content?: unknown;
  };
}

interface ToolUseBlock {
  type: "tool_use";
  name: string;
  input?: Record<string, unknown>;
}

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

function readStdin(): string {
  try {
    return readFileSync("/dev/stdin", "utf8");
  } catch {
    return "";
  }
}

function extractToolCalls(transcriptPath: string): string[] {
  try {
    const lines = readFileSync(transcriptPath, "utf8").trim().split("\n");
    const toolCalls: string[] = [];

    for (const line of lines) {
      let entry: TranscriptEntry;
      try { entry = JSON.parse(line); } catch { continue; }

      if (entry.message?.role !== "assistant") continue;
      const content = entry.message.content;
      if (!Array.isArray(content)) continue;

      for (const block of content as ToolUseBlock[]) {
        if (block.type !== "tool_use") continue;
        const label = formatToolCall(block);
        if (label) toolCalls.push(label);
      }
    }

    return toolCalls.slice(-10);
  } catch {
    return [];
  }
}

function formatToolCall(block: ToolUseBlock): string {
  const input = block.input ?? {};
  const name = block.name;

  if (name === "Bash") return `Bash: ${String(input.command ?? "").slice(0, 60)}`;
  if (name === "Edit") return `Edit: ${basename(String(input.file_path ?? ""))}`;
  if (name === "Write") return `Write: ${basename(String(input.file_path ?? ""))}`;
  if (name === "Read") return `Read: ${basename(String(input.file_path ?? ""))}`;
  if (name === "WebFetch") return `Fetch: ${String(input.url ?? "").slice(0, 60)}`;
  if (name === "WebSearch") return `Search: ${String(input.query ?? "").slice(0, 50)}`;

  if (name.startsWith("mcp__")) {
    const parts = name.split("__");
    const server = parts[1] ?? "";
    const action = parts.slice(2).join("_");
    const url = input.url ? ` ${String(input.url).slice(0, 50)}` : "";
    return `${server}: ${action}${url}`;
  }

  return name;
}

function basename(p: string): string {
  return p.split("/").pop() ?? p;
}

async function main(): Promise<void> {
  loadDotEnv();

  const channel = buildChannel();
  if (!channel) {
    process.stderr.write("claude-hooks: no channel configured, skipping\n");
    process.exit(0);
  }

  const raw = readStdin();
  let hookInput: HookInput = {};
  try { hookInput = JSON.parse(raw); } catch {}

  let text = "⚡ Claude Code needs your attention";

  if (hookInput.transcript_path) {
    const toolCalls = extractToolCalls(hookInput.transcript_path);

    if (toolCalls.length > 0) {
      let aiSummary = "";
      try {
        aiSummary = await summarizeActions(toolCalls);
      } catch {
        // no LLM creds — skip summary
      }

      const detail = toolCalls.map(t => `• ${t}`).join("\n");

      if (aiSummary) {
        text = `⚡ Claude Code needs your attention\n\n${aiSummary}`;
      } else {
        text = `⚡ Claude Code needs your attention\n\n${detail}`;
      }
    }
  }

  await channel.send(text);
}

main().catch((err) => {
  process.stderr.write(`claude-hooks error: ${err.message}\n`);
  process.exit(1);
});
