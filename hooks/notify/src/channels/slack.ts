import type { Channel, Notification } from "./index.js";

export class SlackChannel implements Channel {
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }

  async send(notification: Notification): Promise<void> {
    const ctx = notification.context ? `\`${notification.context}\` ` : "";
    const tag = notification.type ? `[${notification.type}] ` : "";
    const text = `${notification.emoji ?? "⚡"} ${tag}${ctx}${notification.summary}`;

    const res = await fetch(this.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Slack webhook error ${res.status}: ${body}`);
    }
  }
}
