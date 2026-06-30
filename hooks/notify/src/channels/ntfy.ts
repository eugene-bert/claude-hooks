import type { Channel, Notification } from "./index.js";

export class NtfyChannel implements Channel {
  private url: string;

  constructor(topic: string, server = "https://ntfy.sh") {
    this.url = `${server.replace(/\/$/, "")}/${topic}`;
  }

  async send(notification: Notification): Promise<void> {
    const ctx = notification.context ? `[${notification.context}] ` : "";
    const body = `${ctx}${notification.summary}`;

    const res = await fetch(this.url, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "Title": "⚡ Claude Code",
      },
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ntfy error ${res.status}: ${text}`);
    }
  }
}
