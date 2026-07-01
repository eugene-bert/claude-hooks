import { execSync } from "child_process";
import type { Channel, Notification } from "./index.js";

export class MacOSChannel implements Channel {
  async send(notification: Notification): Promise<void> {
    const ctx = notification.context ? `[${notification.context}] ` : "";
    const title = `${notification.emoji ?? "⚡"} Claude Code`;
    const body = `${ctx}${notification.summary}`.replace(/'/g, "\\'");

    execSync(`osascript -e 'display notification "${body}" with title "${title}"'`, {
      stdio: "ignore",
    });
  }
}
