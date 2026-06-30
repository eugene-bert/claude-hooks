import { readFileSync } from "fs";
import { execSync } from "child_process";
import { TelegramChannel } from "./channels/telegram.js";
import { SlackChannel } from "./channels/slack.js";
import { DiscordChannel } from "./channels/discord.js";
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

function buildChannels(): Channel[] {
  const channels: Channel[] = [];

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (token && chatId) channels.push(new TelegramChannel(token, chatId));

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (webhookUrl) channels.push(new SlackChannel(webhookUrl));

  const discordUrl = process.env.DISCORD_WEBHOOK_URL;
  if (discordUrl) channels.push(new DiscordChannel(discordUrl));

  return channels;
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

interface SessionContext {
  project: string;
  branch: string;
  duration: string;
}

function getSessionContext(transcriptPath: string): SessionContext {
  // Project name from transcript path: ~/.claude/projects/-Users-...-myproject/session.jsonl
  const parts = transcriptPath.split("/");
  const projectDir = parts[parts.length - 2] ?? "";
  const project = projectDir.split("-").pop() ?? "";

  // Git branch — run in process cwd (where Claude Code was launched)
  let branch = "";
  try {
    branch = execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
  } catch {}

  // Duration: time since first entry in transcript
  let duration = "";
  try {
    const lines = readFileSync(transcriptPath, "utf8").trim().split("\n");
    const first = JSON.parse(lines[0] ?? "{}") as { timestamp?: number };
    const last = JSON.parse(lines[lines.length - 1] ?? "{}") as { timestamp?: number };
    if (first.timestamp && last.timestamp) {
      const secs = Math.round((last.timestamp - first.timestamp) / 1000);
      if (secs < 60) duration = `${secs}s`;
      else if (secs < 3600) duration = `${Math.round(secs / 60)}m`;
      else duration = `${Math.round(secs / 3600)}h`;
    }
  } catch {}

  return { project, branch, duration };
}

async function main(): Promise<void> {
  loadDotEnv();

  const channels = buildChannels();
  if (channels.length === 0) {
    process.stderr.write("claude-hooks: no channel configured, skipping\n");
    process.exit(0);
  }

  const raw = readStdin();
  let hookInput: HookInput = {};
  try { hookInput = JSON.parse(raw); } catch {}

  let text = "⚡ Claude Code needs your attention";

  if (hookInput.transcript_path) {
    const ctx = getSessionContext(hookInput.transcript_path);
    const ctxParts = [ctx.project, ctx.branch, ctx.duration].filter(Boolean);
    const ctxTag = ctxParts.length > 0 ? `<code>${ctxParts.join(" · ")}</code> ` : "";

    const toolCalls = extractToolCalls(hookInput.transcript_path);

    if (toolCalls.length > 0) {
      let aiSummary = "";
      try {
        aiSummary = await summarizeActions(toolCalls);
      } catch {
        // no LLM creds — skip summary
      }

      const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      if (aiSummary) {
        text = `⚡ ${ctxTag}${aiSummary}`;
      } else {
        text = `⚡ ${ctxTag}\n${toolCalls.map(t => `• ${escHtml(t)}`).join("\n")}`;
      }
    }
  }

  await Promise.all(channels.map(ch => ch.send(text).catch(err => {
    process.stderr.write(`claude-hooks: channel error: ${err.message}\n`);
  })));
}

main().catch((err) => {
  process.stderr.write(`claude-hooks error: ${err.message}\n`);
  process.exit(1);
});
