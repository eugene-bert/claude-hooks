import type { Channel, Notification } from "./index.js";

export class DiscordChannel implements Channel {
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }

  async send(notification: Notification): Promise<void> {
    const ctx = notification.context ? `\`${notification.context}\` ` : "";
    const content = `${notification.emoji ?? "⚡"} ${ctx}${notification.summary}`;

    const res = await fetch(this.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Discord webhook error ${res.status}: ${body}`);
    }
  }
}
