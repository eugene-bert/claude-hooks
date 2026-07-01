import type { Channel, Notification } from "./index.js";

export class SlackBotChannel implements Channel {
  private token: string;
  private channel: string;

  constructor(token: string, channel: string) {
    this.token = token;
    this.channel = channel;
  }

  async send(notification: Notification): Promise<void> {
    const ctx = notification.context ? `\`${notification.context}\` ` : "";
    const text = `⚡ ${ctx}${notification.summary}`;

    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.token}`,
      },
      body: JSON.stringify({ channel: this.channel, text }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Slack API error ${res.status}: ${body}`);
    }
    const data = await res.json() as { ok: boolean; error?: string };
    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error ?? "unknown"}`);
    }
  }
}
