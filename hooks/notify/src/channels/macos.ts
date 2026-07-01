import { execSync } from "child_process";
import type { Channel, Notification } from "./index.js";

const KNOWN_TERMINALS = ["Ghostty", "iTerm2", "Terminal", "Warp", "Alacritty", "kitty", "Hyper"];

function detectTerminal(): string | null {
  // Check env override first
  const override = process.env.MACOS_TERMINAL_APP;
  if (override) return override;

  try {
    // Walk up process tree to find terminal app
    let pid = process.ppid;
    for (let i = 0; i < 10; i++) {
      const comm = execSync(`ps -p ${pid} -o comm= 2>/dev/null`, { encoding: "utf8" }).trim();
      const name = comm.split("/").pop() ?? "";
      const match = KNOWN_TERMINALS.find(t => name.includes(t));
      if (match) return match;
      const ppid = execSync(`ps -p ${pid} -o ppid= 2>/dev/null`, { encoding: "utf8" }).trim().replace(/\s/g, "");
      if (!ppid || ppid === pid.toString()) break;
      pid = parseInt(ppid);
    }
  } catch {}
  return null;
}

export class MacOSChannel implements Channel {
  private focusTerminal: boolean;

  constructor(focusTerminal = false) {
    this.focusTerminal = focusTerminal;
  }

  async send(notification: Notification): Promise<void> {
    const ctx = notification.context ? `[${notification.context}] ` : "";
    const title = `${notification.emoji ?? "⚡"} Claude Code`;
    const body = `${ctx}${notification.summary}`.replace(/['"\\]/g, " ");

    execSync(`osascript -e 'display notification "${body}" with title "${title}"'`, {
      stdio: "ignore",
    });

    if (this.focusTerminal) {
      const terminal = detectTerminal();
      if (terminal) {
        try {
          execSync(`osascript -e 'tell application "${terminal}" to activate'`, { stdio: "ignore" });
        } catch {}
      }
    }
  }
}
